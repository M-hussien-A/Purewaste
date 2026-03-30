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
    if (!checkPermission(userRole, 'accounts_suppliers', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;

    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      return errorResponse('NOT_FOUND', 'Supplier not found', null, 404);
    }

    const [purchases, payments] = await Promise.all([
      prisma.purchase.findMany({
        where: { supplierId: id },
        orderBy: { date: 'asc' },
        include: { material: { select: { name: true } } },
      }),
      prisma.payment.findMany({
        where: { supplierId: id, type: 'PAYABLE' },
        orderBy: { date: 'asc' },
      }),
    ]);

    // Combine and sort all entries chronologically
    const entries: Array<{
      date: Date;
      type: 'purchase' | 'payment';
      amount: Decimal;
      reference: string;
      runningBalance: Decimal;
    }> = [];

    for (const p of purchases) {
      entries.push({
        date: p.date,
        type: 'purchase',
        amount: new Decimal(p.totalCost.toString()),
        reference: `Purchase - ${p.material.name} (${p.quantity}kg)`,
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
      if (entry.type === 'purchase') {
        balance = balance.plus(entry.amount);
      } else {
        balance = balance.minus(entry.amount);
      }
      entry.runningBalance = balance;
    }

    // Reverse to return newest first
    entries.reverse();

    return successResponse({
      supplier: { id: supplier.id, name: supplier.name },
      currentBalance: balance,
      entries,
    });
  } catch (error) {
    console.error('Supplier ledger error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch supplier ledger', null, 500);
  }
}
