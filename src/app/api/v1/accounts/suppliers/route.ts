import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkPermission } from '@/lib/rbac';
import { logAction } from '@/lib/audit';
import { successResponse, errorResponse } from '@/lib/api-response';
import Decimal from 'decimal.js';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'accounts_suppliers', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { purchases: true } },
      },
    });

    const suppliersWithBalance = await Promise.all(
      suppliers.map(async (supplier) => {
        const purchaseAgg = await prisma.purchase.aggregate({
          where: { supplierId: supplier.id },
          _sum: { totalCost: true, paidAmount: true },
        });

        const totalPurchases = new Decimal(purchaseAgg._sum.totalCost?.toString() || '0');
        const totalPaid = new Decimal(purchaseAgg._sum.paidAmount?.toString() || '0');
        const outstandingBalance = totalPurchases.minus(totalPaid);

        return {
          ...supplier,
          totalPurchases,
          totalPaid,
          outstandingBalance,
        };
      })
    );

    return successResponse(suppliersWithBalance);
  } catch (error) {
    console.error('List suppliers error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch suppliers', null, 500);
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
    if (!checkPermission(userRole, 'accounts_suppliers', 'create')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const body = await request.json();
    const { name, nameAr, phone, address, paymentTerms } = body;

    if (!name) {
      return errorResponse('VALIDATION_ERROR', 'Supplier name is required', null, 400);
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        nameAr: nameAr || null,
        phone: phone || null,
        address: address || null,
        paymentTerms: paymentTerms || 0,
      },
    });

    await logAction({
      userId,
      action: 'CREATE',
      module: 'accounts_suppliers',
      recordId: supplier.id,
      newValue: supplier as any,
    });

    return successResponse(supplier);
  } catch (error) {
    console.error('Create supplier error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to create supplier', null, 500);
  }
}
