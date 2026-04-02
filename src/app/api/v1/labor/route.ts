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
    if (!checkPermission(userRole, 'labor', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const workers = await prisma.worker.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
        },
        batches: {
          include: {
            batch: {
              select: { totalOutputQty: true },
            },
          },
        },
      },
    });

    const workersWithBalance = workers.map((worker) => {
      let totalAdvances = new Decimal(0);
      let totalSettlements = new Decimal(0);

      for (const tx of worker.transactions) {
        if (tx.type === 'ADVANCE') {
          totalAdvances = totalAdvances.plus(tx.amount.toString());
        } else {
          totalSettlements = totalSettlements.plus(tx.amount.toString());
        }
      }

      const balance = totalAdvances.minus(totalSettlements);

      // Calculate total labor cost from batch assignments
      let totalLaborCost = new Decimal(0);
      for (const bw of (worker as any).batches || []) {
        const costPerKg = new Decimal(bw.costPerKg?.toString() || '0');
        const outputQty = new Decimal(bw.batch?.totalOutputQty?.toString() || '0');
        totalLaborCost = totalLaborCost.plus(costPerKg.mul(outputQty));
      }

      const { batches, ...workerWithoutBatches } = worker as any;
      return {
        ...workerWithoutBatches,
        totalAdvances: totalAdvances.toNumber(),
        totalSettlements: totalSettlements.toNumber(),
        balance: balance.toNumber(),
        totalLaborCost: totalLaborCost.toNumber(),
      };
    });

    return successResponse(workersWithBalance);
  } catch (error) {
    console.error('List workers error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch workers', null, 500);
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
    if (!checkPermission(userRole, 'labor', 'create')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const body = await request.json();
    const { name, nameAr, phone, costPerKg } = body;

    if (!nameAr) {
      return errorResponse('VALIDATION_ERROR', 'Worker name is required', null, 400);
    }

    const worker = await prisma.worker.create({
      data: {
        name: name || nameAr,
        nameAr,
        phone: phone || null,
        costPerKg: costPerKg || 0,
      },
    });

    await logAction({
      userId,
      action: 'CREATE',
      module: 'labor',
      recordId: worker.id,
      newValue: worker as any,
    });

    return successResponse(worker);
  } catch (error) {
    console.error('Create worker error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to create worker', null, 500);
  }
}
