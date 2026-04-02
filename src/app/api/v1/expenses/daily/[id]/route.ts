import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkPermission } from '@/lib/rbac';
import { logAction } from '@/lib/audit';
import { successResponse, errorResponse } from '@/lib/api-response';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'expenses_daily', 'update')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;
    const body = await request.json();
    const existing = await prisma.dailyExpense.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Expense not found', null, 404);
    }

    const updated = await prisma.dailyExpense.update({
      where: { id },
      data: {
        ...(body.date && { date: new Date(body.date) }),
        ...(body.categoryId && { categoryId: body.categoryId }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.amount !== undefined && { amount: parseFloat(body.amount) }),
      },
    });

    await logAction({ userId, action: 'UPDATE', module: 'expenses_daily', recordId: id, oldValue: existing as any, newValue: updated as any });
    return successResponse(updated);
  } catch (error) {
    console.error('Update daily expense error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to update expense', null, 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'expenses_daily', 'delete')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;
    const existing = await prisma.dailyExpense.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Expense not found', null, 404);
    }

    await prisma.dailyExpense.delete({ where: { id } });
    await logAction({ userId, action: 'DELETE', module: 'expenses_daily', recordId: id, oldValue: existing as any });
    return successResponse({ message: 'Expense deleted' });
  } catch (error) {
    console.error('Delete daily expense error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to delete expense', null, 500);
  }
}
