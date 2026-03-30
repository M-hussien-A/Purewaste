import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { checkPermission } from '@/lib/rbac';
import { logAction } from '@/lib/audit';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { smeltingBatchSchema } from '@/lib/validations/operation';
import {
  calculateWeightedAverage,
  calculateLossRatio,
  calculateOperatingCost,
  calculateBatchCost,
  calculateCostPerKg,
} from '@/lib/calculations';
import Decimal from 'decimal.js';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'operations', 'read')) {
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
        { notes: { contains: search, mode: 'insensitive' } },
        { batchNumber: !isNaN(Number(search)) ? Number(search) : undefined },
      ].filter(Boolean);
    }
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    const [data, total] = await Promise.all([
      prisma.smeltingBatch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        include: {
          inputs: { include: { material: true } },
          outputs: { include: { product: true } },
          creator: { select: { id: true, fullName: true } },
        },
      }),
      prisma.smeltingBatch.count({ where }),
    ]);

    return paginatedResponse(data, page, limit, total);
  } catch (error) {
    console.error('List operations error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch operations', null, 500);
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
    if (!checkPermission(userRole, 'operations', 'create')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const body = await request.json();
    const validation = smeltingBatchSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid input', validation.error.flatten(), 400);
    }

    const { date, inputs, outputs, electricityHrs, laborHrs, otherExpenses, notes } = validation.data;

    const result = await prisma.$transaction(async (tx) => {
      // Get system settings for rates
      const settings = await tx.systemSettings.findFirst({ where: { id: 'system' } });
      if (!settings) {
        throw new Error('System settings not found. Please configure system settings first.');
      }

      // Process inputs: deduct stock, snapshot avgCostPerKg
      let materialCost = new Decimal(0);
      let totalInputQty = new Decimal(0);
      const inputRecords: Array<{ materialId: string; quantity: Decimal; unitCost: Decimal }> = [];

      for (const input of inputs) {
        const material = await tx.rawMaterial.findUniqueOrThrow({ where: { id: input.materialId } });
        const inputQty = new Decimal(input.quantity);

        // Check sufficient stock
        if (new Decimal(material.currentStock.toString()).lt(inputQty)) {
          throw new Error(`Insufficient stock for ${material.name}. Available: ${material.currentStock}, Requested: ${input.quantity}`);
        }

        const unitCost = new Decimal(material.avgCostPerKg.toString());
        materialCost = materialCost.plus(inputQty.mul(unitCost));
        totalInputQty = totalInputQty.plus(inputQty);

        // Deduct from stock
        await tx.rawMaterial.update({
          where: { id: input.materialId },
          data: { currentStock: { decrement: inputQty } },
        });

        inputRecords.push({ materialId: input.materialId, quantity: inputQty, unitCost });
      }

      // Calculate total output quantity
      let totalOutputQty = new Decimal(0);
      for (const output of outputs) {
        totalOutputQty = totalOutputQty.plus(new Decimal(output.quantity));
      }

      // Calculate operating cost
      const operatingCost = calculateOperatingCost(
        electricityHrs,
        settings.electricityRate.toString(),
        laborHrs,
        settings.laborRate.toString(),
        otherExpenses
      );

      // Calculate maintenance allocation: monthlyMaintenance / batchCount this month
      const batchDate = new Date(date);
      const monthStart = new Date(batchDate.getFullYear(), batchDate.getMonth(), 1);
      const monthEnd = new Date(batchDate.getFullYear(), batchDate.getMonth() + 1, 0, 23, 59, 59, 999);
      const batchCountThisMonth = await tx.smeltingBatch.count({
        where: { date: { gte: monthStart, lte: monthEnd } },
      });
      const maintenanceAlloc = new Decimal(settings.monthlyMaintenance.toString()).div(
        Math.max(batchCountThisMonth + 1, 1)
      );

      // Calculate total cost and loss ratio
      const totalCost = calculateBatchCost(materialCost.toString(), operatingCost.toString(), maintenanceAlloc.toString());
      const lossRatio = calculateLossRatio(totalInputQty.toString(), totalOutputQty.toString());
      const costPerKg = calculateCostPerKg(totalCost.toString(), totalOutputQty.toString());

      // Create the smelting batch
      const batch = await tx.smeltingBatch.create({
        data: {
          date: new Date(date),
          status: 'COMPLETED',
          totalInputQty,
          totalOutputQty,
          lossRatio,
          electricityHrs: new Decimal(electricityHrs),
          laborHrs: new Decimal(laborHrs),
          otherExpenses: new Decimal(otherExpenses),
          materialCost,
          operatingCost,
          maintenanceAlloc,
          totalCost,
          costPerKg,
          notes,
          createdBy: userId,
          inputs: {
            create: inputRecords.map((r) => ({
              materialId: r.materialId,
              quantity: r.quantity,
              unitCost: r.unitCost,
            })),
          },
          outputs: {
            create: outputs.map((o) => ({
              productId: o.productId,
              quantity: new Decimal(o.quantity),
              costPerKg,
            })),
          },
        },
        include: {
          inputs: { include: { material: true } },
          outputs: { include: { product: true } },
        },
      });

      // Create inventory movements for inputs (OUT from raw materials)
      for (const input of inputRecords) {
        await tx.inventoryMovement.create({
          data: {
            date: new Date(date),
            type: 'OUT',
            rawMaterialId: input.materialId,
            quantity: input.quantity,
            reason: 'SMELTING',
            referenceId: batch.id,
            userId,
          },
        });
      }

      // Process outputs: update finished product stock and create movements
      for (const output of outputs) {
        const product = await tx.finishedProduct.findUniqueOrThrow({ where: { id: output.productId } });
        const outputQty = new Decimal(output.quantity);

        const newAvgCost = calculateWeightedAverage(
          product.currentStock.toString(),
          product.avgCostPerKg.toString(),
          outputQty.toString(),
          costPerKg.toString()
        );

        await tx.finishedProduct.update({
          where: { id: output.productId },
          data: {
            currentStock: { increment: outputQty },
            avgCostPerKg: newAvgCost,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            date: new Date(date),
            type: 'IN',
            finishedProductId: output.productId,
            quantity: outputQty,
            reason: 'SMELTING',
            referenceId: batch.id,
            userId,
          },
        });
      }

      return batch;
    });

    await logAction({
      userId,
      action: 'CREATE',
      module: 'operations',
      recordId: result.id,
      newValue: result as any,
    });

    return successResponse(result);
  } catch (error: any) {
    console.error('Create operation error:', error);
    if (error.message?.includes('Insufficient stock') || error.message?.includes('System settings not found')) {
      return errorResponse('BUSINESS_ERROR', error.message, null, 400);
    }
    return errorResponse('INTERNAL_ERROR', 'Failed to create smelting batch', null, 500);
  }
}
