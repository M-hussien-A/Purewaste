import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { checkPermission } from '@/lib/rbac';
import { successResponse, errorResponse } from '@/lib/api-response';
import Decimal from 'decimal.js';
export const dynamic = 'force-dynamic';

function getWeekBounds(now: Date): { start: Date; end: Date } {
  // Monday-Sunday week
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function getPrevWeekBounds(currentStart: Date): { start: Date; end: Date } {
  const prevMonday = new Date(currentStart.getFullYear(), currentStart.getMonth(), currentStart.getDate() - 7);
  const prevSunday = new Date(prevMonday.getFullYear(), prevMonday.getMonth(), prevMonday.getDate() + 6, 23, 59, 59, 999);
  return { start: prevMonday, end: prevSunday };
}

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

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') === 'week' ? 'week' : 'month';

    const now = new Date();

    let periodStart: Date;
    let periodEnd: Date;
    let prevPeriodStart: Date;
    let prevPeriodEnd: Date;

    if (period === 'week') {
      const current = getWeekBounds(now);
      const previous = getPrevWeekBounds(current.start);
      periodStart = current.start;
      periodEnd = current.end;
      prevPeriodStart = previous.start;
      prevPeriodEnd = previous.end;
    } else {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      prevPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    }

    // Fetch all data in parallel
    const [
      rawMaterials,
      finishedProducts,
      currentPeriodSales,
      prevPeriodSales,
      currentPeriodBatches,
      prevPeriodBatches,
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
        where: { date: { gte: periodStart, lte: periodEnd } },
      }),
      prisma.sale.findMany({
        where: { date: { gte: prevPeriodStart, lte: prevPeriodEnd } },
      }),
      prisma.smeltingBatch.findMany({
        where: { date: { gte: periodStart, lte: periodEnd } },
      }),
      prisma.smeltingBatch.findMany({
        where: { date: { gte: prevPeriodStart, lte: prevPeriodEnd } },
      }),
      prisma.sale.findMany({
        where: { date: { gte: periodStart, lte: periodEnd } },
        orderBy: { date: 'asc' },
        select: { date: true, totalRevenue: true, grossProfit: true },
      }),
      prisma.smeltingBatch.findMany({
        where: { date: { gte: periodStart, lte: periodEnd } },
        orderBy: { date: 'asc' },
        select: { date: true, lossRatio: true, totalCost: true, batchNumber: true },
      }),
    ]);

    // KPI calculations
    const totalRawStock = new Decimal(rawMaterials._sum.currentStock?.toString() || '0');
    const totalFinishedStock = new Decimal(finishedProducts._sum.currentStock?.toString() || '0');
    const totalInventory = totalRawStock.plus(totalFinishedStock);

    const currentRevenue = currentPeriodSales.reduce(
      (sum, s) => sum.plus(new Decimal(s.totalRevenue.toString())),
      new Decimal(0)
    );
    const prevRevenue = prevPeriodSales.reduce(
      (sum, s) => sum.plus(new Decimal(s.totalRevenue.toString())),
      new Decimal(0)
    );

    const currentProfit = currentPeriodSales.reduce(
      (sum, s) => sum.plus(new Decimal(s.grossProfit.toString())),
      new Decimal(0)
    );
    const prevProfit = prevPeriodSales.reduce(
      (sum, s) => sum.plus(new Decimal(s.grossProfit.toString())),
      new Decimal(0)
    );

    const currentAvgLoss = currentPeriodBatches.length > 0
      ? currentPeriodBatches
          .reduce((sum, b) => sum.plus(new Decimal(b.lossRatio.toString())), new Decimal(0))
          .div(currentPeriodBatches.length)
      : new Decimal(0);
    const prevAvgLoss = prevPeriodBatches.length > 0
      ? prevPeriodBatches
          .reduce((sum, b) => sum.plus(new Decimal(b.lossRatio.toString())), new Decimal(0))
          .div(prevPeriodBatches.length)
      : new Decimal(0);

    // Percentage change helper
    const pctChange = (current: Decimal, previous: Decimal): number => {
      if (previous.isZero()) return current.isZero() ? 0 : 100;
      return current.minus(previous).div(previous).mul(100).toDecimalPlaces(2).toNumber();
    };

    // Cost breakdown from batches in current period
    const totalLaborCost = currentPeriodBatches.reduce(
      (sum, b) => sum.plus(new Decimal((b as any).laborCost?.toString() || '0')),
      new Decimal(0)
    );
    const totalFuelCost = currentPeriodBatches.reduce(
      (sum, b) => sum.plus(new Decimal((b as any).fuelCost?.toString() || '0')),
      new Decimal(0)
    );
    const totalMaterialCost = currentPeriodBatches.reduce(
      (sum, b) => sum.plus(new Decimal(b.materialCost.toString())),
      new Decimal(0)
    );
    const totalOtherCost = currentPeriodBatches.reduce(
      (sum, b) => {
        const operating = new Decimal(b.operatingCost.toString());
        const labor = new Decimal((b as any).laborCost?.toString() || '0');
        const fuel = new Decimal((b as any).fuelCost?.toString() || '0');
        // other = operating - labor - fuel (electricity + other expenses)
        return sum.plus(operating.minus(labor).minus(fuel));
      },
      new Decimal(0)
    );

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
      period,
      periodStart: periodStart.toISOString().split('T')[0],
      periodEnd: periodEnd.toISOString().split('T')[0],
      kpis: {
        totalInventory: {
          value: totalInventory.toNumber(),
          change: 0,
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
      costBreakdown: {
        labor: totalLaborCost.toNumber(),
        fuel: totalFuelCost.toNumber(),
        material: totalMaterialCost.toNumber(),
        other: totalOtherCost.toNumber(),
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
