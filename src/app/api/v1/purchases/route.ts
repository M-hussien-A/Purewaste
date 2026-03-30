import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { checkPermission } from '@/lib/rbac';
import { logAction } from '@/lib/audit';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { purchaseSchema } from '@/lib/validations/purchase';
import { calculateWeightedAverage } from '@/lib/calculations';
import Decimal from 'decimal.js';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'purchases', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') || 'desc';
    const search = searchParams.get('search') || '';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
        { material: { name: { contains: search, mode: 'insensitive' } } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    const [data, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        include: { supplier: true, material: true, creator: { select: { id: true, fullName: true } } },
      }),
      prisma.purchase.count({ where }),
    ]);

    return paginatedResponse(data, page, limit, total);
  } catch (error) {
    console.error('List purchases error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch purchases', null, 500);
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
    if (!checkPermission(userRole, 'purchases', 'create')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const body = await request.json();
    const validation = purchaseSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid input', validation.error.flatten(), 400);
    }

    const { date, supplierId, materialId, quantity, unitPrice, notes } = validation.data;
    const totalCost = new Decimal(quantity).mul(new Decimal(unitPrice));

    const result = await prisma.$transaction(async (tx) => {
      // Create the purchase
      const purchase = await tx.purchase.create({
        data: {
          date: new Date(date),
          supplierId,
          materialId,
          quantity: new Decimal(quantity),
          unitPrice: new Decimal(unitPrice),
          totalCost,
          notes,
          createdBy: userId,
        },
        include: { supplier: true, material: true },
      });

      // Update raw material stock and weighted average cost
      const material = await tx.rawMaterial.findUniqueOrThrow({ where: { id: materialId } });
      const newAvgCost = calculateWeightedAverage(
        material.currentStock.toString(),
        material.avgCostPerKg.toString(),
        quantity,
        unitPrice
      );

      await tx.rawMaterial.update({
        where: { id: materialId },
        data: {
          currentStock: { increment: new Decimal(quantity) },
          avgCostPerKg: newAvgCost,
        },
      });

      // Create inventory movement
      await tx.inventoryMovement.create({
        data: {
          date: new Date(date),
          type: 'IN',
          rawMaterialId: materialId,
          quantity: new Decimal(quantity),
          reason: 'PURCHASE',
          referenceId: purchase.id,
          userId,
        },
      });

      return purchase;
    });

    await logAction({
      userId,
      action: 'CREATE',
      module: 'purchases',
      recordId: result.id,
      newValue: result as any,
    });

    return successResponse(result);
  } catch (error) {
    console.error('Create purchase error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to create purchase', null, 500);
  }
}
