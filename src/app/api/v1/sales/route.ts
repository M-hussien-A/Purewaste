import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { checkPermission } from '@/lib/rbac';
import { logAction } from '@/lib/audit';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { saleSchema } from '@/lib/validations/sale';
import { calculateGrossProfit } from '@/lib/calculations';
import Decimal from 'decimal.js';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'sales', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20') || 20, 100);
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') || 'desc';
    const search = searchParams.get('search') || '';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    const [data, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        include: {
          customer: true,
          product: true,
          batch: { select: { id: true, batchNumber: true } },
          creator: { select: { id: true, fullName: true } },
        },
      }),
      prisma.sale.count({ where }),
    ]);

    return paginatedResponse(data, page, limit, total);
  } catch (error) {
    console.error('List sales error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch sales', null, 500);
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
    if (!checkPermission(userRole, 'sales', 'create')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const body = await request.json();
    const validation = saleSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid input', validation.error.flatten(), 400);
    }

    const { date, customerId, productId, batchId, quantity, pricePerKg, notes } = validation.data;
    const totalRevenue = new Decimal(quantity).mul(new Decimal(pricePerKg));

    const result = await prisma.$transaction(async (tx) => {
      // Get cost per kg from batch or product average
      let costPerKg: Decimal;
      if (batchId) {
        const batch = await tx.smeltingBatch.findUniqueOrThrow({ where: { id: batchId } });
        costPerKg = new Decimal(batch.costPerKg.toString());
      } else {
        const product = await tx.finishedProduct.findUniqueOrThrow({ where: { id: productId } });
        costPerKg = new Decimal(product.avgCostPerKg.toString());
      }

      // Check sufficient stock
      const product = await tx.finishedProduct.findUniqueOrThrow({ where: { id: productId } });
      const saleQty = new Decimal(quantity);
      if (new Decimal(product.currentStock.toString()).lt(saleQty)) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.currentStock}, Requested: ${quantity}`);
      }

      const grossProfit = calculateGrossProfit(totalRevenue.toString(), quantity.toString(), costPerKg.toString());

      // Create the sale
      const sale = await tx.sale.create({
        data: {
          date: new Date(date),
          customerId,
          productId,
          batchId: batchId || null,
          quantity: saleQty,
          pricePerKg: new Decimal(pricePerKg),
          totalRevenue,
          costPerKg,
          grossProfit,
          notes,
          createdBy: userId,
        },
        include: { customer: true, product: true },
      });

      // Deduct from finished product stock
      await tx.finishedProduct.update({
        where: { id: productId },
        data: { currentStock: { decrement: saleQty } },
      });

      // Create inventory movement
      await tx.inventoryMovement.create({
        data: {
          date: new Date(date),
          type: 'OUT',
          finishedProductId: productId,
          quantity: saleQty,
          reason: 'SALE',
          referenceId: sale.id,
          userId,
        },
      });

      return sale;
    });

    await logAction({
      userId,
      action: 'CREATE',
      module: 'sales',
      recordId: result.id,
      newValue: result as any,
    });

    return successResponse(result);
  } catch (error: any) {
    console.error('Create sale error:', error);
    if (error.message?.includes('Insufficient stock')) {
      return errorResponse('BUSINESS_ERROR', error.message, null, 400);
    }
    return errorResponse('INTERNAL_ERROR', 'Failed to create sale', null, 500);
  }
}
