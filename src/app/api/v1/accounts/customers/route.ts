import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkPermission } from '@/lib/rbac';
import { logAction } from '@/lib/audit';
import { successResponse, errorResponse } from '@/lib/api-response';
import Decimal from 'decimal.js';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'accounts_customers', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const customers = await prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { sales: true } },
      },
    });

    const customersWithBalance = await Promise.all(
      customers.map(async (customer) => {
        const salesAgg = await prisma.sale.aggregate({
          where: { customerId: customer.id },
          _sum: { totalRevenue: true, paidAmount: true },
        });

        const totalSales = new Decimal(salesAgg._sum.totalRevenue?.toString() || '0');
        const totalPaid = new Decimal(salesAgg._sum.paidAmount?.toString() || '0');
        const outstandingBalance = totalSales.minus(totalPaid);

        return {
          ...customer,
          totalSales,
          totalPaid,
          outstandingBalance,
        };
      })
    );

    return successResponse(customersWithBalance);
  } catch (error) {
    console.error('List customers error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch customers', null, 500);
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
    if (!checkPermission(userRole, 'accounts_customers', 'create')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const body = await request.json();
    const { name, nameAr, phone, address, paymentTerms } = body;

    if (!name) {
      return errorResponse('VALIDATION_ERROR', 'Customer name is required', null, 400);
    }

    const customer = await prisma.customer.create({
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
      module: 'accounts_customers',
      recordId: customer.id,
      newValue: customer as any,
    });

    return successResponse(customer);
  } catch (error) {
    console.error('Create customer error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to create customer', null, 500);
  }
}
