import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { checkPermission } from '@/lib/rbac';
import { logAction } from '@/lib/audit';
import { successResponse, errorResponse } from '@/lib/api-response';
import { purchaseSchema } from '@/lib/validations/purchase';
import { calculateWeightedAverage } from '@/lib/calculations';
import Decimal from 'decimal.js';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'purchases', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        material: true,
        creator: { select: { id: true, fullName: true } },
        payments: true,
      },
    });

    if (!purchase) {
      return errorResponse('NOT_FOUND', 'Purchase not found', null, 404);
    }

    return successResponse(purchase);
  } catch (error) {
    console.error('Get purchase error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch purchase', null, 500);
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
    if (!checkPermission(userRole, 'purchases', 'update')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;
    const body = await request.json();
    const validation = purchaseSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid input', validation.error.flatten(), 400);
    }

    const { date, supplierId, materialId, quantity, unitPrice, notes } = validation.data;
    const totalCost = new Decimal(quantity).mul(new Decimal(unitPrice));

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.purchase.findUniqueOrThrow({ where: { id } });

      // Reverse the old inventory effect
      await tx.rawMaterial.update({
        where: { id: existing.materialId },
        data: {
          currentStock: { decrement: existing.quantity },
        },
      });

      // Apply new inventory effect
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

      const updated = await tx.purchase.update({
        where: { id },
        data: {
          date: new Date(date),
          supplierId,
          materialId,
          quantity: new Decimal(quantity),
          unitPrice: new Decimal(unitPrice),
          totalCost,
          notes,
        },
        include: { supplier: true, material: true },
      });

      return { existing, updated };
    });

    await logAction({
      userId,
      action: 'UPDATE',
      module: 'purchases',
      recordId: id,
      oldValue: result.existing as any,
      newValue: result.updated as any,
    });

    return successResponse(result.updated);
  } catch (error) {
    console.error('Update purchase error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to update purchase', null, 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'purchases', 'delete')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.purchase.findUniqueOrThrow({ where: { id } });

      // Reverse inventory: decrement stock
      await tx.rawMaterial.update({
        where: { id: existing.materialId },
        data: {
          currentStock: { decrement: existing.quantity },
        },
      });

      // Remove related inventory movements
      await tx.inventoryMovement.deleteMany({
        where: { referenceId: id },
      });

      // Delete the purchase
      await tx.purchase.delete({ where: { id } });

      return existing;
    });

    await logAction({
      userId,
      action: 'DELETE',
      module: 'purchases',
      recordId: id,
      oldValue: result as any,
    });

    return successResponse({ message: 'Purchase deleted successfully' });
  } catch (error) {
    console.error('Delete purchase error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to delete purchase', null, 500);
  }
}
