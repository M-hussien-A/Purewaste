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
    if (!checkPermission(userRole, 'accounts_customers', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: {
          orderBy: { date: 'desc' },
          take: 10,
          include: { product: true },
        },
      },
    });

    if (!customer) {
      return errorResponse('NOT_FOUND', 'Customer not found', null, 404);
    }

    const salesAgg = await prisma.sale.aggregate({
      where: { customerId: id },
      _sum: { totalRevenue: true, paidAmount: true },
    });

    const totalSales = new Decimal(salesAgg._sum.totalRevenue?.toString() || '0');
    const totalPaid = new Decimal(salesAgg._sum.paidAmount?.toString() || '0');
    const outstandingBalance = totalSales.minus(totalPaid);

    return successResponse({
      ...customer,
      totalSales,
      totalPaid,
      outstandingBalance,
    });
  } catch (error) {
    console.error('Get customer error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch customer', null, 500);
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
    if (!checkPermission(userRole, 'accounts_customers', 'update')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;
    const body = await request.json();
    const { name, nameAr, phone, address, paymentTerms, isActive } = body;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Customer not found', null, 404);
    }

    const updated = await prisma.customer.update({
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
      module: 'accounts_customers',
      recordId: id,
      oldValue: existing as any,
      newValue: updated as any,
    });

    return successResponse(updated);
  } catch (error) {
    console.error('Update customer error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to update customer', null, 500);
  }
}
