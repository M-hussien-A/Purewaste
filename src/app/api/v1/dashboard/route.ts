import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { checkPermission } from '@/lib/rbac';
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
    if (!checkPermission(userRole, 'dashboard', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Fetch all data in parallel
    const [
      rawMaterials,
      finishedProducts,
      currentMonthSales,
      prevMonthSales,
      currentMonthBatches,
      prevMonthBatches,
      recentSales,
      recentBatches,
    ] = await Promise.all([
      prisma.rawMaterial.aggregate({
        _sum: { currentStock: true },
      }),
      prisma.finishedProduct.aggregate({
        _sum: { currentStock: true },
      }),
      prisma.sale.findMany({
        where: { date: { gte: currentMonthStart, lte: currentMonthEnd } },
      }),
      prisma.sale.findMany({
        where: { date: { gte: prevMonthStart, lte: prevMonthEnd } },
      }),
      prisma.smeltingBatch.findMany({
        where: { date: { gte: currentMonthStart, lte: currentMonthEnd } },
      }),
      prisma.smeltingBatch.findMany({
        where: { date: { gte: prevMonthStart, lte: prevMonthEnd } },
      }),
      prisma.sale.findMany({
        where: { date: { gte: currentMonthStart, lte: currentMonthEnd } },
        orderBy: { date: 'asc' },
        select: { date: true, totalRevenue: true, grossProfit: true },
      }),
      prisma.smeltingBatch.findMany({
        where: { date: { gte: currentMonthStart, lte: currentMonthEnd } },
        orderBy: { date: 'asc' },
        select: { date: true, lossRatio: true, totalCost: true, batchNumber: true },
      }),
    ]);

    // KPI calculations
    const totalRawStock = new Decimal(rawMaterials._sum.currentStock?.toString() || '0');
    const totalFinishedStock = new Decimal(finishedProducts._sum.currentStock?.toString() || '0');
    const totalInventory = totalRawStock.plus(totalFinishedStock);

    const currentRevenue = currentMonthSales.reduce(
      (sum, s) => sum.plus(new Decimal(s.totalRevenue.toString())),
      new Decimal(0)
    );
    const prevRevenue = prevMonthSales.reduce(
      (sum, s) => sum.plus(new Decimal(s.totalRevenue.toString())),
      new Decimal(0)
    );

    const currentProfit = currentMonthSales.reduce(
      (sum, s) => sum.plus(new Decimal(s.grossProfit.toString())),
      new Decimal(0)
    );
    const prevProfit = prevMonthSales.reduce(
      (sum, s) => sum.plus(new Decimal(s.grossProfit.toString())),
      new Decimal(0)
    );

    const currentAvgLoss = currentMonthBatches.length > 0
      ? currentMonthBatches
          .reduce((sum, b) => sum.plus(new Decimal(b.lossRatio.toString())), new Decimal(0))
          .div(currentMonthBatches.length)
      : new Decimal(0);
    const prevAvgLoss = prevMonthBatches.length > 0
      ? prevMonthBatches
          .reduce((sum, b) => sum.plus(new Decimal(b.lossRatio.toString())), new Decimal(0))
          .div(prevMonthBatches.length)
      : new Decimal(0);

    // Percentage change helper
    const pctChange = (current: Decimal, previous: Decimal): number => {
      if (previous.isZero()) return current.isZero() ? 0 : 100;
      return current.minus(previous).div(previous).mul(100).toDecimalPlaces(2).toNumber();
    };

    // Chart data
    const revenueChartData = recentSales.map((s) => ({
      date: s.date.toISOString().split('T')[0],
      revenue: Number(s.totalRevenue),
      profit: Number(s.grossProfit),
    }));

    const batchChartData = recentBatches.map((b) => ({
      batch: b.batchNumber,
      date: b.date.toISOString().split('T')[0],
      lossRatio: Number(b.lossRatio),
      totalCost: Number(b.totalCost),
    }));

    return successResponse({
      kpis: {
        totalInventory: {
          value: totalInventory.toNumber(),
          rawStock: totalRawStock.toNumber(),
          finishedStock: totalFinishedStock.toNumber(),
        },
        monthlyRevenue: {
          value: currentRevenue.toNumber(),
          change: pctChange(currentRevenue, prevRevenue),
        },
        monthlyProfit: {
          value: currentProfit.toNumber(),
          change: pctChange(currentProfit, prevProfit),
        },
        avgLossRatio: {
          value: currentAvgLoss.toDecimalPlaces(4).toNumber(),
          change: pctChange(currentAvgLoss, prevAvgLoss),
        },
      },
      charts: {
        revenue: revenueChartData,
        batches: batchChartData,
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch dashboard data', null, 500);
  }
}
