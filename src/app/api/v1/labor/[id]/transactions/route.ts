import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkPermission } from '@/lib/rbac';
import { logAction } from '@/lib/audit';
import { successResponse, errorResponse } from '@/lib/api-response';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'labor', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;

    const transactions = await prisma.laborTransaction.findMany({
      where: { workerId: id },
      orderBy: { date: 'desc' },
    });

    return successResponse(transactions);
  } catch (error) {
    console.error('List labor transactions error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch transactions', null, 500);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
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

    const { id } = await context.params;
    const body = await request.json();
    const { date, type, amount, notes } = body;

    if (!date || !type || !amount) {
      return errorResponse('VALIDATION_ERROR', 'Date, type, and amount are required', null, 400);
    }

    if (!['ADVANCE', 'SETTLEMENT'].includes(type)) {
      return errorResponse('VALIDATION_ERROR', 'Type must be ADVANCE or SETTLEMENT', null, 400);
    }

    const worker = await prisma.worker.findUnique({ where: { id } });
    if (!worker) {
      return errorResponse('NOT_FOUND', 'Worker not found', null, 404);
    }

    const transaction = await prisma.laborTransaction.create({
      data: {
        workerId: id,
        date: new Date(date),
        type,
        amount: parseFloat(amount),
        notes: notes || null,
        createdBy: userId,
      },
    });

    await logAction({
      userId,
      action: 'CREATE',
      module: 'labor',
      recordId: transaction.id,
      newValue: transaction as any,
    });

    return successResponse(transaction);
  } catch (error) {
    console.error('Create labor transaction error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to create transaction', null, 500);
  }
}
