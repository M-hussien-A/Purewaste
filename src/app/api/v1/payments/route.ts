import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkPermission } from '@/lib/rbac';
import { logAction } from '@/lib/audit';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import Decimal from 'decimal.js';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userRole = (session.user as any).role;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type') as 'PAYABLE' | 'RECEIVABLE' | null;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const skip = (page - 1) * limit;

    // Check permissions based on type filter
    const permModule =type === 'RECEIVABLE' ? 'payments_receivable' : 'payments_payable';
    if (!checkPermission(userRole, permModule, 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const where: any = {};
    if (type) {
      where.type = type;
    }
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          supplier: true,
          customer: true,
          purchase: { select: { id: true, totalCost: true } },
          sale: { select: { id: true, totalRevenue: true } },
          creator: { select: { id: true, fullName: true } },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return paginatedResponse(data, page, limit, total);
  } catch (error) {
    console.error('List payments error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch payments', null, 500);
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

    const body = await request.json();
    const { date, type, amount, method, supplierId, customerId, purchaseId, saleId, notes } = body;

    if (!date || !type || !amount || !method) {
      return errorResponse('VALIDATION_ERROR', 'Missing required fields: date, type, amount, method', null, 400);
    }

    const permModule =type === 'RECEIVABLE' ? 'payments_receivable' : 'payments_payable';
    if (!checkPermission(userRole, permModule, 'create')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const paymentAmount = new Decimal(amount);

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          date: new Date(date),
          type,
          amount: paymentAmount,
          method,
          supplierId: supplierId || null,
          customerId: customerId || null,
          purchaseId: purchaseId || null,
          saleId: saleId || null,
          notes: notes || null,
          createdBy: userId,
        },
        include: {
          supplier: true,
          customer: true,
        },
      });

      // Update linked purchase payment status
      if (purchaseId) {
        const purchase = await tx.purchase.findUniqueOrThrow({ where: { id: purchaseId } });
        const newPaidAmount = new Decimal(purchase.paidAmount.toString()).plus(paymentAmount);
        const totalCost = new Decimal(purchase.totalCost.toString());

        let paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING';
        if (newPaidAmount.gte(totalCost)) {
          paymentStatus = 'PAID';
        } else if (newPaidAmount.gt(0)) {
          paymentStatus = 'PARTIAL';
        } else {
          paymentStatus = 'PENDING';
        }

        await tx.purchase.update({
          where: { id: purchaseId },
          data: {
            paidAmount: newPaidAmount,
            paymentStatus,
          },
        });
      }

      // Update linked sale payment status
      if (saleId) {
        const sale = await tx.sale.findUniqueOrThrow({ where: { id: saleId } });
        const newPaidAmount = new Decimal(sale.paidAmount.toString()).plus(paymentAmount);
        const totalRevenue = new Decimal(sale.totalRevenue.toString());

        let paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING';
        if (newPaidAmount.gte(totalRevenue)) {
          paymentStatus = 'PAID';
        } else if (newPaidAmount.gt(0)) {
          paymentStatus = 'PARTIAL';
        } else {
          paymentStatus = 'PENDING';
        }

        await tx.sale.update({
          where: { id: saleId },
          data: {
            paidAmount: newPaidAmount,
            paymentStatus,
          },
        });
      }

      return payment;
    });

    await logAction({
      userId,
      action: 'CREATE',
      module: permModule,
      recordId: result.id,
      newValue: result as any,
    });

    return successResponse(result);
  } catch (error) {
    console.error('Create payment error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to create payment', null, 500);
  }
}
