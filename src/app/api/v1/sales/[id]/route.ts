import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { checkPermission } from '@/lib/rbac';
import { logAction } from '@/lib/audit';
import { successResponse, errorResponse } from '@/lib/api-response';
import { saleSchema } from '@/lib/validations/sale';
import { calculateGrossProfit } from '@/lib/calculations';
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
    if (!checkPermission(userRole, 'sales', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        product: true,
        batch: true,
        creator: { select: { id: true, fullName: true } },
        payments: true,
      },
    });

    if (!sale) {
      return errorResponse('NOT_FOUND', 'Sale not found', null, 404);
    }

    return successResponse(sale);
  } catch (error) {
    console.error('Get sale error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch sale', null, 500);
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
    if (!checkPermission(userRole, 'sales', 'update')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;
    const body = await request.json();
    const validation = saleSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid input', validation.error.flatten(), 400);
    }

    const { date, customerId, productId, batchId, quantity, pricePerKg, notes } = validation.data;
    const totalRevenue = new Decimal(quantity).mul(new Decimal(pricePerKg));

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.sale.findUniqueOrThrow({ where: { id } });

      // Reverse old inventory: add back to OLD product's stock
      await tx.finishedProduct.update({
        where: { id: existing.productId },
        data: { currentStock: { increment: existing.quantity } },
      });

      // Get cost per kg
      let costPerKg: Decimal;
      if (batchId) {
        const batch = await tx.smeltingBatch.findUniqueOrThrow({ where: { id: batchId } });
        costPerKg = new Decimal(batch.costPerKg.toString());
      } else {
        // Re-fetch the NEW product (after old stock was reversed)
        const prodForCost = await tx.finishedProduct.findUniqueOrThrow({ where: { id: productId } });
        costPerKg = new Decimal(prodForCost.avgCostPerKg.toString());
      }

      // Check sufficient stock on the NEW product
      const product = await tx.finishedProduct.findUniqueOrThrow({ where: { id: productId } });
      const saleQty = new Decimal(quantity);
      // If same product, stock was already incremented above, so available = current stock
      // If different product, stock reflects actual available quantity
      if (new Decimal(product.currentStock.toString()).lt(saleQty)) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.currentStock}, Requested: ${quantity}`);
      }

      const grossProfit = calculateGrossProfit(totalRevenue.toString(), quantity.toString(), costPerKg.toString());

      // Update the sale
      const updated = await tx.sale.update({
        where: { id },
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
        },
        include: { customer: true, product: true },
      });

      // Deduct new quantity from stock
      await tx.finishedProduct.update({
        where: { id: productId },
        data: { currentStock: { decrement: saleQty } },
      });

      return { existing, updated };
    });

    await logAction({
      userId,
      action: 'UPDATE',
      module: 'sales',
      recordId: id,
      oldValue: result.existing as any,
      newValue: result.updated as any,
    });

    return successResponse(result.updated);
  } catch (error: any) {
    console.error('Update sale error:', error);
    if (error.message?.includes('Insufficient stock')) {
      return errorResponse('BUSINESS_ERROR', error.message, null, 400);
    }
    return errorResponse('INTERNAL_ERROR', 'Failed to update sale', null, 500);
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
    if (!checkPermission(userRole, 'sales', 'delete')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.sale.findUniqueOrThrow({ where: { id } });

      // Reverse inventory: add back to stock
      await tx.finishedProduct.update({
        where: { id: existing.productId },
        data: { currentStock: { increment: existing.quantity } },
      });

      // Remove related inventory movements
      await tx.inventoryMovement.deleteMany({
        where: { referenceId: id },
      });

      // Delete the sale
      await tx.sale.delete({ where: { id } });

      return existing;
    });

    await logAction({
      userId,
      action: 'DELETE',
      module: 'sales',
      recordId: id,
      oldValue: result as any,
    });

    return successResponse({ message: 'Sale deleted successfully' });
  } catch (error) {
    console.error('Delete sale error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to delete sale', null, 500);
  }
}
