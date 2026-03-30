import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkPermission } from '@/lib/rbac';
import { logAction } from '@/lib/audit';
import { successResponse, errorResponse } from '@/lib/api-response';
import Decimal from 'decimal.js';

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
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchases: {
          orderBy: { date: 'desc' },
          take: 10,
          include: { material: true },
        },
      },
    });

    if (!supplier) {
      return errorResponse('NOT_FOUND', 'Supplier not found', null, 404);
    }

    const purchaseAgg = await prisma.purchase.aggregate({
      where: { supplierId: id },
      _sum: { totalCost: true, paidAmount: true },
    });

    const totalPurchases = new Decimal(purchaseAgg._sum.totalCost?.toString() || '0');
    const totalPaid = new Decimal(purchaseAgg._sum.paidAmount?.toString() || '0');
    const outstandingBalance = totalPurchases.minus(totalPaid);

    return successResponse({
      ...supplier,
      totalPurchases,
      totalPaid,
      outstandingBalance,
    });
  } catch (error) {
    console.error('Get supplier error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch supplier', null, 500);
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
    if (!checkPermission(userRole, 'accounts_suppliers', 'update')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;
    const body = await request.json();
    const { name, nameAr, phone, address, paymentTerms, isActive } = body;

    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Supplier not found', null, 404);
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(nameAr !== undefined && { nameAr }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(paymentTerms !== undefined && { paymentTerms }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    await logAction({
      userId,
      action: 'UPDATE',
      module: 'accounts_suppliers',
      recordId: id,
      oldValue: existing as any,
      newValue: updated as any,
    });

    return successResponse(updated);
  } catch (error) {
    console.error('Update supplier error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to update supplier', null, 500);
  }
}
