import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { checkPermission } from '@/lib/rbac';
import { successResponse, errorResponse } from '@/lib/api-response';
import Decimal from 'decimal.js';
export const dynamic = 'force-dynamic';

interface Alert {
  type: 'LOW_STOCK_RAW' | 'LOW_STOCK_FINISHED' | 'OVERDUE_SUPPLIER_PAYMENT' | 'OVERDUE_CUSTOMER_PAYMENT';
  severity: 'warning' | 'critical';
  message: string;
  details: Record<string, unknown>;
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

    const alerts: Alert[] = [];

    // Check raw materials below minimum stock level
    const rawMaterials = await prisma.rawMaterial.findMany({
      where: { isActive: true },
    });

    for (const material of rawMaterials) {
      const current = new Decimal(material.currentStock.toString());
      const min = new Decimal(material.minStockLevel.toString());
      if (min.gt(0) && current.lt(min)) {
        const severity = current.lt(min.mul(0.5)) ? 'critical' : 'warning';
        alerts.push({
          type: 'LOW_STOCK_RAW',
          severity,
          message: `Raw material "${material.name}" is below minimum stock level (${current.toNumber()} / ${min.toNumber()} ${material.unit})`,
          details: { materialId: material.id, name: material.name, currentStock: current.toNumber(), minStockLevel: min.toNumber() },
        });
      }
    }

    // Check finished products below minimum stock level
    const finishedProducts = await prisma.finishedProduct.findMany({
      where: { isActive: true },
    });

    for (const product of finishedProducts) {
      const current = new Decimal(product.currentStock.toString());
      const min = new Decimal(product.minStockLevel.toString());
      if (min.gt(0) && current.lt(min)) {
        const severity = current.lt(min.mul(0.5)) ? 'critical' : 'warning';
        alerts.push({
          type: 'LOW_STOCK_FINISHED',
          severity,
          message: `Finished product "${product.name}" is below minimum stock level (${current.toNumber()} / ${min.toNumber()} ${product.unit})`,
          details: { productId: product.id, name: product.name, currentStock: current.toNumber(), minStockLevel: min.toNumber() },
        });
      }
    }

    // Check overdue supplier payments (purchases past payment terms that are not fully paid)
    const unpaidPurchases = await prisma.purchase.findMany({
      where: {
        paymentStatus: { in: ['PENDING', 'PARTIAL'] },
      },
      include: { supplier: true },
    });

    const now = new Date();
    for (const purchase of unpaidPurchases) {
      const dueDate = new Date(purchase.date);
      dueDate.setDate(dueDate.getDate() + purchase.supplier.paymentTerms);
      if (now > dueDate) {
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const severity = daysOverdue > 30 ? 'critical' : 'warning';
        const remaining = new Decimal(purchase.totalCost.toString()).minus(new Decimal(purchase.paidAmount.toString()));
        alerts.push({
          type: 'OVERDUE_SUPPLIER_PAYMENT',
          severity,
          message: `Payment to "${purchase.supplier.name}" is ${daysOverdue} days overdue (${remaining.toNumber()} remaining)`,
          details: { purchaseId: purchase.id, supplierId: purchase.supplierId, supplierName: purchase.supplier.name, daysOverdue, remainingAmount: remaining.toNumber() },
        });
      }
    }

    // Check overdue customer payments (sales past payment terms that are not fully paid)
    const unpaidSales = await prisma.sale.findMany({
      where: {
        paymentStatus: { in: ['PENDING', 'PARTIAL'] },
      },
      include: { customer: true },
    });

    for (const sale of unpaidSales) {
      const dueDate = new Date(sale.date);
      dueDate.setDate(dueDate.getDate() + sale.customer.paymentTerms);
      if (now > dueDate) {
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const severity = daysOverdue > 30 ? 'critical' : 'warning';
        const remaining = new Decimal(sale.totalRevenue.toString()).minus(new Decimal(sale.paidAmount.toString()));
        alerts.push({
          type: 'OVERDUE_CUSTOMER_PAYMENT',
          severity,
          message: `Payment from "${sale.customer.name}" is ${daysOverdue} days overdue (${remaining.toNumber()} remaining)`,
          details: { saleId: sale.id, customerId: sale.customerId, customerName: sale.customer.name, daysOverdue, remainingAmount: remaining.toNumber() },
        });
      }
    }

    return successResponse(alerts);
  } catch (error) {
    console.error('Alerts error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch alerts', null, 500);
  }
}
