import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkPermission } from '@/lib/rbac';
import { logAction } from '@/lib/audit';
import { successResponse, errorResponse } from '@/lib/api-response';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'expenses_monthly', 'delete')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;
    const existing = await prisma.monthlyOverhead.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Overhead not found', null, 404);
    }

    await prisma.monthlyOverhead.delete({ where: { id } });
    await logAction({ userId, action: 'DELETE', module: 'expenses_monthly', recordId: id, oldValue: existing as any });
    return successResponse({ message: 'Overhead deleted' });
  } catch (error) {
    console.error('Delete monthly overhead error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to delete overhead', null, 500);
  }
}
