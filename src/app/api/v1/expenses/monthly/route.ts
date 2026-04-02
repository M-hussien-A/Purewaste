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
    if (!checkPermission(userRole, 'expenses_monthly', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : new Date().getMonth() + 1;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear();

    const overheads = await prisma.monthlyOverhead.findMany({
      where: { month, year },
      include: {
        category: true,
        creator: { select: { id: true, fullName: true } },
      },
      orderBy: { category: { name: 'asc' } },
    });

    const totalAmount = overheads.reduce(
      (sum, o) => sum.plus(new Decimal(o.amount.toString())),
      new Decimal(0)
    );

    return successResponse({ overheads, totalAmount: totalAmount.toNumber(), month, year });
  } catch (error) {
    console.error('List monthly overheads error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch overheads', null, 500);
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
    if (!checkPermission(userRole, 'expenses_monthly', 'create')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const body = await request.json();
    const { month, year, categoryId, amount, notes } = body;

    if (!month || !year || !categoryId || amount === undefined) {
      return errorResponse('VALIDATION_ERROR', 'Month, year, categoryId, and amount are required', null, 400);
    }

    // Upsert: if entry for this month/year/category exists, update it
    const overhead = await prisma.monthlyOverhead.upsert({
      where: {
        month_year_categoryId: { month, year, categoryId },
      },
      update: {
        amount: parseFloat(amount),
        notes: notes || null,
      },
      create: {
        month,
        year,
        categoryId,
        amount: parseFloat(amount),
        notes: notes || null,
        createdBy: userId,
      },
    });

    await logAction({
      userId,
      action: 'CREATE',
      module: 'expenses_monthly',
      recordId: overhead.id,
      newValue: overhead as any,
    });

    return successResponse(overhead);
  } catch (error) {
    console.error('Create/update monthly overhead error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to save overhead', null, 500);
  }
}
