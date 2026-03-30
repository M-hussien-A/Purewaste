import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkPermission } from '@/lib/rbac';
import { logAction } from '@/lib/audit';
import { successResponse, errorResponse } from '@/lib/api-response';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userRole = (session.user as any).role;

    const { id } = await context.params;
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        supplier: true,
        customer: true,
        purchase: true,
        sale: true,
        creator: { select: { id: true, fullName: true } },
      },
    });

    if (!payment) {
      return errorResponse('NOT_FOUND', 'Payment not found', null, 404);
    }

    const permModule =payment.type === 'RECEIVABLE' ? 'payments_receivable' : 'payments_payable';
    if (!checkPermission(userRole, permModule, 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    return successResponse(payment);
  } catch (error) {
    console.error('Get payment error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch payment', null, 500);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;

    const { id } = await context.params;

    const existing = await prisma.payment.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Payment not found', null, 404);
    }

    const permModule =existing.type === 'RECEIVABLE' ? 'payments_receivable' : 'payments_payable';
    if (!checkPermission(userRole, permModule, 'update')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const body = await request.json();
    const { date, method, notes } = body;

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        ...(date !== undefined && { date: new Date(date) }),
        ...(method !== undefined && { method }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        supplier: true,
        customer: true,
      },
    });

    await logAction({
      userId,
      action: 'UPDATE',
      module: permModule,
      recordId: id,
      oldValue: existing as any,
      newValue: updated as any,
    });

    return successResponse(updated);
  } catch (error) {
    console.error('Update payment error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to update payment', null, 500);
  }
}
