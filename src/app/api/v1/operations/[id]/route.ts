import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
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
    if (!checkPermission(userRole, 'operations', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;
    const batch = await prisma.smeltingBatch.findUnique({
      where: { id },
      include: {
        inputs: { include: { material: true } },
        outputs: { include: { product: true } },
        sales: { include: { customer: true } },
        creator: { select: { id: true, fullName: true } },
      },
    });

    if (!batch) {
      return errorResponse('NOT_FOUND', 'Smelting batch not found', null, 404);
    }

    return successResponse(batch);
  } catch (error) {
    console.error('Get operation error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch operation', null, 500);
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
    if (!checkPermission(userRole, 'operations', 'update')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;
    const body = await request.json();

    // Only allow updating notes and status on an existing batch
    const existing = await prisma.smeltingBatch.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Smelting batch not found', null, 404);
    }

    const updateData: any = {};
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status !== undefined) updateData.status = body.status;

    const updated = await prisma.smeltingBatch.update({
      where: { id },
      data: updateData,
      include: {
        inputs: { include: { material: true } },
        outputs: { include: { product: true } },
        creator: { select: { id: true, fullName: true } },
      },
    });

    await logAction({
      userId,
      action: 'UPDATE',
      module: 'operations',
      recordId: id,
      oldValue: existing as any,
      newValue: updated as any,
    });

    return successResponse(updated);
  } catch (error) {
    console.error('Update operation error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to update operation', null, 500);
  }
}
