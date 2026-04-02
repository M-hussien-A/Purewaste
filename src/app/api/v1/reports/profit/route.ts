import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
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
    if (!checkPermission(userRole, 'reports', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (!dateFrom || !dateTo) {
      return errorResponse('VALIDATION_ERROR', 'dateFrom and dateTo are required', null, 400);
    }

    const dateFilter = {
      date: {
        gte: new Date(dateFrom),
        lte: new Date(dateTo),
      },
    };

    // Aggregate sales in the date range
    const salesAgg = await prisma.sale.aggregate({
      where: dateFilter,
      _sum: {
        totalRevenue: true,
        grossProfit: true,
      },
      _count: true,
    });

    // Compute total cost from individual sales (revenue - profit = cost)
    const totalRevenue = new Decimal(salesAgg._sum.totalRevenue?.toString() || '0');
    const totalGrossProfit = new Decimal(salesAgg._sum.grossProfit?.toString() || '0');
    const totalCosts = totalRevenue.minus(totalGrossProfit);

    // Per-batch breakdown: get all sales in range grouped by batch
    const salesInRange = await prisma.sale.findMany({
      where: dateFilter,
      include: {
        batch: { select: { id: true, batchNumber: true, costPerKg: true } },
        product: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    });

    // Group by batchId
    const batchMap = new Map<string, {
      batchId: string | null;
      batchNumber: number | null;
      sales: typeof salesInRange;
      totalRevenue: Decimal;
      totalCost: Decimal;
      grossProfit: Decimal;
    }>();

    for (const sale of salesInRange) {
      const key = sale.batchId || 'no-batch';
      if (!batchMap.has(key)) {
        batchMap.set(key, {
          batchId: sale.batchId,
          batchNumber: sale.batch?.batchNumber || null,
          sales: [],
          totalRevenue: new Decimal(0),
          totalCost: new Decimal(0),
          grossProfit: new Decimal(0),
        });
      }
      const entry = batchMap.get(key)!;
      entry.sales.push(sale);
      entry.totalRevenue = entry.totalRevenue.plus(new Decimal(sale.totalRevenue.toString()));
      entry.grossProfit = entry.grossProfit.plus(new Decimal(sale.grossProfit.toString()));
      entry.totalCost = entry.totalRevenue.minus(entry.grossProfit);
    }

    const batchBreakdown = Array.from(batchMap.values()).map((b) => ({
      batchId: b.batchId,
      batchNumber: b.batchNumber,
      salesCount: b.sales.length,
      totalRevenue: b.totalRevenue,
      totalCost: b.totalCost,
      grossProfit: b.grossProfit,
    }));

    // Daily expenses in the date range
    const dailyExpensesInRange = await prisma.dailyExpense.findMany({
      where: dateFilter,
      include: { category: true },
    });

    const totalDailyExpenses = dailyExpensesInRange.reduce(
      (sum, e) => sum.plus(new Decimal(e.amount.toString())),
      new Decimal(0)
    );

    // Group daily expenses by category
    const dailyByCategory = new Map<string, { name: string; nameAr: string; total: Decimal }>();
    for (const exp of dailyExpensesInRange) {
      const key = exp.categoryId;
      if (!dailyByCategory.has(key)) {
        dailyByCategory.set(key, {
          name: exp.category.name,
          nameAr: exp.category.nameAr,
          total: new Decimal(0),
        });
      }
      const entry = dailyByCategory.get(key)!;
      entry.total = entry.total.plus(new Decimal(exp.amount.toString()));
    }

    // Monthly overhead for the month
    const startDate = new Date(dateFrom);
    const monthlyOverheads = await prisma.monthlyOverhead.findMany({
      where: {
        month: startDate.getMonth() + 1,
        year: startDate.getFullYear(),
      },
      include: { category: true },
    });

    const totalMonthlyOverhead = monthlyOverheads.reduce(
      (sum, o) => sum.plus(new Decimal(o.amount.toString())),
      new Decimal(0)
    );

    const totalPeriodCosts = totalDailyExpenses.plus(totalMonthlyOverhead);
    const netProfit = totalGrossProfit.minus(totalPeriodCosts);

    return successResponse({
      dateFrom,
      dateTo,
      summary: {
        totalRevenue,
        totalCosts,
        grossProfit: totalGrossProfit,
        grossMargin: totalRevenue.gt(0)
          ? totalGrossProfit.div(totalRevenue).mul(100).toDecimalPlaces(2)
          : new Decimal(0),
        totalDailyExpenses,
        totalMonthlyOverhead,
        totalPeriodCosts,
        netProfit,
        netMargin: totalRevenue.gt(0)
          ? netProfit.div(totalRevenue).mul(100).toDecimalPlaces(2)
          : new Decimal(0),
        salesCount: salesAgg._count,
      },
      dailyExpenseBreakdown: Array.from(dailyByCategory.values()).map((c) => ({
        name: c.name,
        nameAr: c.nameAr,
        total: c.total,
      })),
      monthlyOverheadBreakdown: monthlyOverheads.map((o) => ({
        name: o.category.name,
        nameAr: o.category.nameAr,
        total: o.amount,
      })),
      batchBreakdown,
    });
  } catch (error) {
    console.error('Profit report error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to generate profit report', null, 500);
  }
}
