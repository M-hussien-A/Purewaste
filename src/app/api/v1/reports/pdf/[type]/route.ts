import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkPermission } from '@/lib/rbac';
import { successResponse, errorResponse } from '@/lib/api-response';
import Decimal from 'decimal.js';

type RouteContext = { params: Promise<{ type: string }> };

const VALID_TYPES = ['batch', 'invoice', 'statement', 'pnl'];

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'reports', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { type } = await context.params;
    if (!VALID_TYPES.includes(type)) {
      return errorResponse('VALIDATION_ERROR', `Invalid report type. Must be one of: ${VALID_TYPES.join(', ')}`, null, 400);
    }

    const { searchParams } = new URL(request.url);
    const settings = await prisma.systemSettings.findUnique({ where: { id: 'system' } });

    switch (type) {
      case 'batch': {
        const batchId = searchParams.get('batchId');
        if (!batchId) {
          return errorResponse('VALIDATION_ERROR', 'batchId is required', null, 400);
        }

        const batch = await prisma.smeltingBatch.findUnique({
          where: { id: batchId },
          include: {
            inputs: { include: { material: true } },
            outputs: { include: { product: true } },
            creator: { select: { id: true, fullName: true } },
          },
        });

        if (!batch) {
          return errorResponse('NOT_FOUND', 'Batch not found', null, 404);
        }

        return successResponse({
          reportType: 'batch',
          generatedAt: new Date().toISOString(),
          foundryName: settings?.foundryName || 'The Foundry',
          foundryNameEn: settings?.foundryNameEn || 'The Foundry',
          data: batch,
        });
      }

      case 'invoice': {
        const saleId = searchParams.get('saleId');
        if (!saleId) {
          return errorResponse('VALIDATION_ERROR', 'saleId is required', null, 400);
        }

        const sale = await prisma.sale.findUnique({
          where: { id: saleId },
          include: {
            customer: true,
            product: true,
            batch: { select: { id: true, batchNumber: true } },
            payments: true,
            creator: { select: { id: true, fullName: true } },
          },
        });

        if (!sale) {
          return errorResponse('NOT_FOUND', 'Sale not found', null, 404);
        }

        return successResponse({
          reportType: 'invoice',
          generatedAt: new Date().toISOString(),
          foundryName: settings?.foundryName || 'The Foundry',
          foundryNameEn: settings?.foundryNameEn || 'The Foundry',
          data: sale,
        });
      }

      case 'statement': {
        const entityType = searchParams.get('entityType'); // 'supplier' or 'customer'
        const entityId = searchParams.get('entityId');
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');

        if (!entityType || !entityId) {
          return errorResponse('VALIDATION_ERROR', 'entityType and entityId are required', null, 400);
        }

        if (entityType === 'supplier') {
          const supplier = await prisma.supplier.findUnique({ where: { id: entityId } });
          if (!supplier) {
            return errorResponse('NOT_FOUND', 'Supplier not found', null, 404);
          }

          const dateFilter: any = {};
          if (dateFrom) dateFilter.gte = new Date(dateFrom);
          if (dateTo) dateFilter.lte = new Date(dateTo);

          const purchases = await prisma.purchase.findMany({
            where: {
              supplierId: entityId,
              ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
            },
            orderBy: { date: 'asc' },
            include: { material: { select: { name: true } } },
          });

          const payments = await prisma.payment.findMany({
            where: {
              supplierId: entityId,
              type: 'PAYABLE',
              ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
            },
            orderBy: { date: 'asc' },
          });

          const totalPurchases = purchases.reduce(
            (sum, p) => sum.plus(new Decimal(p.totalCost.toString())),
            new Decimal(0)
          );
          const totalPayments = payments.reduce(
            (sum, p) => sum.plus(new Decimal(p.amount.toString())),
            new Decimal(0)
          );

          return successResponse({
            reportType: 'statement',
            generatedAt: new Date().toISOString(),
            foundryName: settings?.foundryName || 'The Foundry',
            foundryNameEn: settings?.foundryNameEn || 'The Foundry',
            data: {
              entity: supplier,
              entityType: 'supplier',
              purchases,
              payments,
              totalPurchases,
              totalPayments,
              balance: totalPurchases.minus(totalPayments),
            },
          });
        } else {
          const customer = await prisma.customer.findUnique({ where: { id: entityId } });
          if (!customer) {
            return errorResponse('NOT_FOUND', 'Customer not found', null, 404);
          }

          const dateFilter: any = {};
          if (dateFrom) dateFilter.gte = new Date(dateFrom);
          if (dateTo) dateFilter.lte = new Date(dateTo);

          const sales = await prisma.sale.findMany({
            where: {
              customerId: entityId,
              ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
            },
            orderBy: { date: 'asc' },
            include: { product: { select: { name: true } } },
          });

          const payments = await prisma.payment.findMany({
            where: {
              customerId: entityId,
              type: 'RECEIVABLE',
              ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
            },
            orderBy: { date: 'asc' },
          });

          const totalSales = sales.reduce(
            (sum, s) => sum.plus(new Decimal(s.totalRevenue.toString())),
            new Decimal(0)
          );
          const totalPayments = payments.reduce(
            (sum, p) => sum.plus(new Decimal(p.amount.toString())),
            new Decimal(0)
          );

          return successResponse({
            reportType: 'statement',
            generatedAt: new Date().toISOString(),
            foundryName: settings?.foundryName || 'The Foundry',
            foundryNameEn: settings?.foundryNameEn || 'The Foundry',
            data: {
              entity: customer,
              entityType: 'customer',
              sales,
              payments,
              totalSales,
              totalPayments,
              balance: totalSales.minus(totalPayments),
            },
          });
        }
      }

      case 'pnl': {
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

        const [salesAgg, purchasesAgg, batchesInRange] = await Promise.all([
          prisma.sale.aggregate({
            where: dateFilter,
            _sum: { totalRevenue: true, grossProfit: true },
            _count: true,
          }),
          prisma.purchase.aggregate({
            where: dateFilter,
            _sum: { totalCost: true },
            _count: true,
          }),
          prisma.smeltingBatch.findMany({
            where: dateFilter,
            select: {
              operatingCost: true,
              maintenanceAlloc: true,
              otherExpenses: true,
            },
          }),
        ]);

        const totalRevenue = new Decimal(salesAgg._sum.totalRevenue?.toString() || '0');
        const totalGrossProfit = new Decimal(salesAgg._sum.grossProfit?.toString() || '0');
        const totalMaterialCost = new Decimal(purchasesAgg._sum.totalCost?.toString() || '0');

        const totalOperatingCost = batchesInRange.reduce(
          (sum, b) => sum.plus(new Decimal(b.operatingCost.toString())),
          new Decimal(0)
        );
        const totalMaintenance = batchesInRange.reduce(
          (sum, b) => sum.plus(new Decimal(b.maintenanceAlloc.toString())),
          new Decimal(0)
        );
        const totalOtherExpenses = batchesInRange.reduce(
          (sum, b) => sum.plus(new Decimal(b.otherExpenses.toString())),
          new Decimal(0)
        );

        return successResponse({
          reportType: 'pnl',
          generatedAt: new Date().toISOString(),
          foundryName: settings?.foundryName || 'The Foundry',
          foundryNameEn: settings?.foundryNameEn || 'The Foundry',
          data: {
            period: { from: dateFrom, to: dateTo },
            revenue: {
              totalRevenue,
              salesCount: salesAgg._count,
            },
            costs: {
              totalMaterialCost,
              totalOperatingCost,
              totalMaintenance,
              totalOtherExpenses,
              purchasesCount: purchasesAgg._count,
            },
            profit: {
              grossProfit: totalGrossProfit,
              profitMargin: totalRevenue.gt(0)
                ? totalGrossProfit.div(totalRevenue).mul(100).toDecimalPlaces(2)
                : new Decimal(0),
            },
          },
        });
      }

      default:
        return errorResponse('VALIDATION_ERROR', 'Invalid report type', null, 400);
    }
  } catch (error) {
    console.error('PDF report data error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to generate report data', null, 500);
  }
}
