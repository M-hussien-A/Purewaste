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
export const dynamic = 'force-dynamic';

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

    const { date, inputMaterials: inputs, outputProducts: outputs, workerIds, electricityHrs, laborHrs, fuelCost, otherExpenses, notes } = validation.data;

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
          data: { currentStock: { decrement: inputQty.toNumber() } },
        });

        inputRecords.push({ materialId: input.materialId, quantity: inputQty, unitCost });
      }

      // Calculate total output quantity
      let totalOutputQty = new Decimal(0);
      for (const output of outputs) {
        totalOutputQty = totalOutputQty.plus(new Decimal(output.quantity));
      }

      // Fetch selected workers and calculate labor cost from costPerKg
      let laborCostFromWorkers = new Decimal(0);
      const workerRecords: Array<{ workerId: string; costPerKg: Decimal }> = [];
      if (workerIds && workerIds.length > 0) {
        const selectedWorkers = await tx.worker.findMany({
          where: { id: { in: workerIds } },
        });
        for (const w of selectedWorkers) {
          const wpk = new Decimal(w.costPerKg.toString());
          laborCostFromWorkers = laborCostFromWorkers.plus(wpk.mul(totalOutputQty));
          workerRecords.push({ workerId: w.id, costPerKg: wpk });
        }
      }

      // Calculate operating cost (includes laborHrs*rate + worker-based labor + fuel + other)
      const electricityCost = new Decimal(electricityHrs).mul(new Decimal(settings.electricityRate.toString()));
      const laborHrsCost = new Decimal(laborHrs).mul(new Decimal(settings.laborRate.toString()));
      const totalLaborCost = laborHrsCost.plus(laborCostFromWorkers);
      const fuelCostDec = new Decimal(fuelCost || 0);
      const operatingCost = electricityCost.plus(totalLaborCost).plus(fuelCostDec).plus(new Decimal(otherExpenses));

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
          totalInputQty: totalInputQty.toNumber(),
          totalOutputQty: totalOutputQty.toNumber(),
          lossRatio: lossRatio.toNumber(),
          electricityHrs,
          laborHrs,
          otherExpenses,
          materialCost: materialCost.toNumber(),
          laborCost: totalLaborCost.toNumber(),
          fuelCost: fuelCostDec.toNumber(),
          operatingCost: operatingCost.toNumber(),
          maintenanceAlloc: maintenanceAlloc.toNumber(),
          totalCost: totalCost.toNumber(),
          costPerKg: costPerKg.toNumber(),
          notes,
          createdBy: userId,
          inputs: {
            create: inputRecords.map((r) => ({
              materialId: r.materialId,
              quantity: r.quantity.toNumber(),
              unitCost: r.unitCost.toNumber(),
            })),
          },
          outputs: {
            create: outputs.map((o) => ({
              productId: o.productId,
              quantity: o.quantity,
              costPerKg: costPerKg.toNumber(),
            })),
          },
          workers: {
            create: workerRecords.map((wr) => ({
              workerId: wr.workerId,
              costPerKg: wr.costPerKg.toNumber(),
            })),
          },
        },
        include: {
          inputs: { include: { material: true } },
          outputs: { include: { product: true } },
          workers: { include: { worker: true } },
        },
      });

      // Create inventory movements for inputs (OUT from raw materials)
      for (const input of inputRecords) {
        await tx.inventoryMovement.create({
          data: {
            date: new Date(date),
            type: 'OUT',
            rawMaterialId: input.materialId,
            quantity: input.quantity.toNumber(),
            reason: 'SMELTING',
            referenceId: batch.id,
            userId,
          },
        });
      }

      // Process outputs: update finished product stock and create movements
      for (const output of outputs) {
        const product = await tx.finishedProduct.findUniqueOrThrow({ where: { id: output.productId } });
        const outputQty = output.quantity;

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
            avgCostPerKg: newAvgCost.toNumber(),
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
    console.error('Create operation error:', error?.message || error);
    console.error('Full error:', JSON.stringify(error, null, 2));
    if (error.message?.includes('Insufficient stock') || error.message?.includes('System settings not found')) {
      return errorResponse('BUSINESS_ERROR', error.message, null, 400);
    }
    return errorResponse('INTERNAL_ERROR', error?.message || 'Failed to create smelting batch', null, 500);
  }
}
