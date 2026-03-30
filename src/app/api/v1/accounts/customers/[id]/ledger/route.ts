import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkPermission } from '@/lib/rbac';
import { successResponse, errorResponse } from '@/lib/api-response';
import Decimal from 'decimal.js';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'accounts_customers', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      return errorResponse('NOT_FOUND', 'Customer not found', null, 404);
    }

    const [sales, payments] = await Promise.all([
      prisma.sale.findMany({
        where: { customerId: id },
        orderBy: { date: 'asc' },
        include: { product: { select: { name: true } } },
      }),
      prisma.payment.findMany({
        where: { customerId: id, type: 'RECEIVABLE' },
        orderBy: { date: 'asc' },
      }),
    ]);

    const entries: Array<{
      date: Date;
      type: 'sale' | 'payment';
      amount: Decimal;
      reference: string;
      runningBalance: Decimal;
    }> = [];

    for (const s of sales) {
      entries.push({
        date: s.date,
        type: 'sale',
        amount: new Decimal(s.totalRevenue.toString()),
        reference: `Sale - ${s.product.name} (${s.quantity}kg)`,
        runningBalance: new Decimal(0),
      });
    }

    for (const p of payments) {
      entries.push({
        date: p.date,
        type: 'payment',
        amount: new Decimal(p.amount.toString()),
        reference: `Payment - ${p.method}${p.notes ? ` (${p.notes})` : ''}`,
        runningBalance: new Decimal(0),
      });
    }

    // Sort by date ascending, then compute running balance
    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    let balance = new Decimal(0);
    for (const entry of entries) {
      if (entry.type === 'sale') {
        balance = balance.plus(entry.amount);
      } else {
        balance = balance.minus(entry.amount);
      }
      entry.runningBalance = balance;
    }

    // Reverse to return newest first
    entries.reverse();

    return successResponse({
      customer: { id: customer.id, name: customer.name },
      currentBalance: balance,
      entries,
    });
  } catch (error) {
    console.error('Customer ledger error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch customer ledger', null, 500);
  }
}
