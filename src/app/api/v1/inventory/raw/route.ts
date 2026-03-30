import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkPermission } from '@/lib/rbac';
import { successResponse, errorResponse } from '@/lib/api-response';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'inventory_raw', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const materials = await prisma.rawMaterial.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return successResponse(materials);
  } catch (error) {
    console.error('List raw materials error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch raw materials', null, 500);
  }
}
