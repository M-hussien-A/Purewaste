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
    if (!checkPermission(userRole, 'settings', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    let settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' },
    });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: { id: 'system' },
      });
    }

    return successResponse(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch settings', null, 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'settings', 'update')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const body = await request.json();
    const {
      electricityRate,
      laborRate,
      monthlyMaintenance,
      defaultLanguage,
      defaultTheme,
      foundryName,
      foundryNameEn,
    } = body;

    const existing = await prisma.systemSettings.findUnique({
      where: { id: 'system' },
    });

    const updated = await prisma.systemSettings.upsert({
      where: { id: 'system' },
      create: {
        id: 'system',
        ...(electricityRate !== undefined && { electricityRate: new Decimal(electricityRate) }),
        ...(laborRate !== undefined && { laborRate: new Decimal(laborRate) }),
        ...(monthlyMaintenance !== undefined && { monthlyMaintenance: new Decimal(monthlyMaintenance) }),
        ...(defaultLanguage !== undefined && { defaultLanguage }),
        ...(defaultTheme !== undefined && { defaultTheme }),
        ...(foundryName !== undefined && { foundryName }),
        ...(foundryNameEn !== undefined && { foundryNameEn }),
      },
      update: {
        ...(electricityRate !== undefined && { electricityRate: new Decimal(electricityRate) }),
        ...(laborRate !== undefined && { laborRate: new Decimal(laborRate) }),
        ...(monthlyMaintenance !== undefined && { monthlyMaintenance: new Decimal(monthlyMaintenance) }),
        ...(defaultLanguage !== undefined && { defaultLanguage }),
        ...(defaultTheme !== undefined && { defaultTheme }),
        ...(foundryName !== undefined && { foundryName }),
        ...(foundryNameEn !== undefined && { foundryNameEn }),
      },
    });

    await logAction({
      userId,
      action: 'UPDATE',
      module: 'settings',
      recordId: 'system',
      oldValue: existing as any,
      newValue: updated as any,
    });

    return successResponse(updated);
  } catch (error) {
    console.error('Update settings error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to update settings', null, 500);
  }
}
