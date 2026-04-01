import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkPermission } from '@/lib/rbac';
import { logAction } from '@/lib/audit';
import { successResponse, errorResponse } from '@/lib/api-response';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'labor', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;
    const worker = await prisma.worker.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!worker) {
      return errorResponse('NOT_FOUND', 'Worker not found', null, 404);
    }

    return successResponse(worker);
  } catch (error) {
    console.error('Get worker error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch worker', null, 500);
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
    if (!checkPermission(userRole, 'labor', 'update')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;
    const body = await request.json();
    const { name, nameAr, phone, costPerKg, isActive } = body;

    const existing = await prisma.worker.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Worker not found', null, 404);
    }

    const updated = await prisma.worker.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(nameAr !== undefined && { nameAr }),
        ...(phone !== undefined && { phone }),
        ...(costPerKg !== undefined && { costPerKg }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    await logAction({
      userId,
      action: 'UPDATE',
      module: 'labor',
      recordId: id,
      oldValue: existing as any,
      newValue: updated as any,
    });

    return successResponse(updated);
  } catch (error) {
    console.error('Update worker error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to update worker', null, 500);
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
    if (!checkPermission(userRole, 'labor', 'delete')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;
    const existing = await prisma.worker.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Worker not found', null, 404);
    }

    const txCount = await prisma.laborTransaction.count({ where: { workerId: id } });
    if (txCount > 0) {
      await prisma.worker.update({ where: { id }, data: { isActive: false } });
      await logAction({ userId, action: 'UPDATE', module: 'labor', recordId: id, oldValue: existing as any, newValue: { ...existing, isActive: false } as any });
      return successResponse({ message: 'Worker deactivated (has transactions)' });
    }

    await prisma.worker.delete({ where: { id } });
    await logAction({ userId, action: 'DELETE', module: 'labor', recordId: id, oldValue: existing as any });

    return successResponse({ message: 'Worker deleted successfully' });
  } catch (error) {
    console.error('Delete worker error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to delete worker', null, 500);
  }
}
