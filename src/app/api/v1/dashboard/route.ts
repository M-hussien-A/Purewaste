import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { checkPermission } from '@/lib/rbac';
import { successResponse, errorResponse } from '@/lib/api-response';
import Decimal from 'decimal.js';
export const dynamic = 'force-dynamic';

function getWeekBounds(now: Date, weekStartDay: number = 6): { start: Date; end: Date } {
  // weekStartDay: 0=Sun, 1=Mon, ..., 6=Sat (default Saturday)
  const dayOfWeek = now.getDay();
  const daysFromStart = (dayOfWeek - weekStartDay + 7) % 7;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromStart);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
  return { start, end };
}

function getPrevWeekBounds(currentStart: Date): { start: Date; end: Date } {
  const prevStart = new Date(currentStart.getFullYear(), currentStart.getMonth(), currentStart.getDate() - 7);
  const prevEnd = new Date(prevStart.getFullYear(), prevStart.getMonth(), prevStart.getDate() + 6, 23, 59, 59, 999);
  return { start: prevStart, end: prevEnd };
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

    // Fetch weekStartDay from settings
    const settings = await prisma.systemSettings.findUnique({ where: { id: 'system' } });
    const weekStartDay = (settings as any)?.weekStartDay ?? 6;

    const now = new Date();

    let periodStart: Date;
    let periodEnd: Date;
    let prevPeriodStart: Date;
    let prevPeriodEnd: Date;

    if (period === 'week') {
      const current = getWeekBounds(now, weekStartDay);
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

    // Period costs: daily expenses + monthly overhead
    const dailyExpenses = await prisma.dailyExpense.findMany({
      where: { date: { gte: periodStart, lte: periodEnd } },
    });
    const totalDailyExpenses = dailyExpenses.reduce(
      (sum, e) => sum.plus(new Decimal(e.amount.toString())),
      new Decimal(0)
    );

    const now2 = new Date();
    const monthlyOverheads = await prisma.monthlyOverhead.findMany({
      where: period === 'month'
        ? { month: now2.getMonth() + 1, year: now2.getFullYear() }
        : { month: now2.getMonth() + 1, year: now2.getFullYear() },
    });
    const totalMonthlyOverhead = monthlyOverheads.reduce(
      (sum, o) => sum.plus(new Decimal(o.amount.toString())),
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

    const totalCosts = totalMaterialCost.plus(totalLaborCost).plus(totalFuelCost).plus(totalOtherCost).plus(totalDailyExpenses).plus(totalMonthlyOverhead);

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
        dailyExpenses: totalDailyExpenses.toNumber(),
        monthlyOverhead: totalMonthlyOverhead.toNumber(),
        total: totalCosts.toNumber(),
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
