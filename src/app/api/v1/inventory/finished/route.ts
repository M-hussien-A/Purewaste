import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkPermission } from '@/lib/rbac';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'inventory_finished', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const products = await prisma.finishedProduct.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return successResponse(products);
  } catch (error) {
    console.error('List finished products error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch finished products', null, 500);
  }
}
