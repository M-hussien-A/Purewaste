import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkPermission } from '@/lib/rbac';
import { logAction } from '@/lib/audit';
import { successResponse, errorResponse } from '@/lib/api-response';
import Decimal from 'decimal.js';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;

    const body = await request.json();
    const { type, itemId, quantity, reason } = body;

    if (!type || !itemId || quantity === undefined || !reason) {
      return errorResponse('VALIDATION_ERROR', 'Missing required fields: type, itemId, quantity, reason', null, 400);
    }

    if (type !== 'raw' && type !== 'finished') {
      return errorResponse('VALIDATION_ERROR', 'type must be "raw" or "finished"', null, 400);
    }

    const permModule =type === 'raw' ? 'inventory_raw' : 'inventory_finished';
    if (!checkPermission(userRole, permModule, 'update')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const adjustmentQty = new Decimal(quantity);

    const result = await prisma.$transaction(async (tx) => {
      if (type === 'raw') {
        const material = await tx.rawMaterial.findUniqueOrThrow({ where: { id: itemId } });
        const newStock = new Decimal(material.currentStock.toString()).plus(adjustmentQty);
        if (newStock.lt(0)) {
          throw new Error(`Adjustment would result in negative stock. Current: ${material.currentStock}, Adjustment: ${quantity}`);
        }

        await tx.rawMaterial.update({
          where: { id: itemId },
          data: { currentStock: newStock },
        });

        const movement = await tx.inventoryMovement.create({
          data: {
            date: new Date(),
            type: 'ADJUSTMENT',
            rawMaterialId: itemId,
            quantity: adjustmentQty,
            reason,
            userId,
          },
        });

        return { item: material.name, previousStock: material.currentStock, newStock, movement };
      } else {
        const product = await tx.finishedProduct.findUniqueOrThrow({ where: { id: itemId } });
        const newStock = new Decimal(product.currentStock.toString()).plus(adjustmentQty);
        if (newStock.lt(0)) {
          throw new Error(`Adjustment would result in negative stock. Current: ${product.currentStock}, Adjustment: ${quantity}`);
        }

        await tx.finishedProduct.update({
          where: { id: itemId },
          data: { currentStock: newStock },
        });

        const movement = await tx.inventoryMovement.create({
          data: {
            date: new Date(),
            type: 'ADJUSTMENT',
            finishedProductId: itemId,
            quantity: adjustmentQty,
            reason,
            userId,
          },
        });

        return { item: product.name, previousStock: product.currentStock, newStock, movement };
      }
    });

    await logAction({
      userId,
      action: 'UPDATE',
      module: permModule,
      recordId: itemId,
      newValue: { type, itemId, quantity, reason, ...result } as any,
    });

    return successResponse(result);
  } catch (error: any) {
    console.error('Stock adjustment error:', error);
    if (error.message?.includes('negative stock')) {
      return errorResponse('BUSINESS_ERROR', error.message, null, 400);
    }
    return errorResponse('INTERNAL_ERROR', 'Failed to perform stock adjustment', null, 500);
  }
}
