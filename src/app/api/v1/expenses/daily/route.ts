import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkPermission } from '@/lib/rbac';
import { logAction } from '@/lib/audit';
import { successResponse, errorResponse } from '@/lib/api-response';
import Decimal from 'decimal.js';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'expenses_daily', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: any = {};
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo + 'T23:59:59.999Z');
    }

    const expenses = await prisma.dailyExpense.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        category: true,
        creator: { select: { id: true, fullName: true } },
      },
    });

    // Calculate totals
    const totalAmount = expenses.reduce(
      (sum, e) => sum.plus(new Decimal(e.amount.toString())),
      new Decimal(0)
    );

    return successResponse({ expenses, totalAmount: totalAmount.toNumber() });
  } catch (error) {
    console.error('List daily expenses error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch expenses', null, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'expenses_daily', 'create')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const body = await request.json();
    const { entries } = body; // Array of { date, categoryId, description, amount }

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return errorResponse('VALIDATION_ERROR', 'At least one expense entry is required', null, 400);
    }

    const created = await prisma.$transaction(
      entries.map((entry: any) =>
        prisma.dailyExpense.create({
          data: {
            date: new Date(entry.date),
            categoryId: entry.categoryId,
            description: entry.description || null,
            amount: new Decimal(entry.amount.toString()),
            createdBy: userId,
          },
        })
      )
    );

    for (const expense of created) {
      await logAction({
        userId,
        action: 'CREATE',
        module: 'expenses_daily',
        recordId: expense.id,
        newValue: expense as any,
      });
    }

    return successResponse(created);
  } catch (error) {
    console.error('Create daily expenses error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to create expenses', null, 500);
  }
}
