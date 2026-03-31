import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check if already seeded - block re-seeding
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      return NextResponse.json(
        { success: false, message: 'Database already seeded. Seed endpoint is now locked.' },
        { status: 403 }
      );
    }

    // 1. Create Users
    const adminHash = await bcrypt.hash('Admin@2026', 12);
    const operatorHash = await bcrypt.hash('Operator@2026', 12);
    const accountantHash = await bcrypt.hash('Account@2026', 12);

    const admin = await prisma.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        email: 'admin@foundry.local',
        fullName: 'مدير النظام',
        passwordHash: adminHash,
        role: 'ADMIN',
        languagePref: 'ar',
        themePref: 'light',
      },
    });

    await prisma.user.upsert({
      where: { username: 'operator' },
      update: {},
      create: {
        username: 'operator',
        email: 'operator@foundry.local',
        fullName: 'محمد المشغل',
        passwordHash: operatorHash,
        role: 'OPERATOR',
        languagePref: 'ar',
        themePref: 'light',
      },
    });

    await prisma.user.upsert({
      where: { username: 'accountant' },
      update: {},
      create: {
        username: 'accountant',
        email: 'accountant@foundry.local',
        fullName: 'أحمد المحاسب',
        passwordHash: accountantHash,
        role: 'ACCOUNTANT',
        languagePref: 'ar',
        themePref: 'light',
      },
    });

    // 2. System Settings
    await prisma.systemSettings.upsert({
      where: { id: 'system' },
      update: {},
      create: {
        id: 'system',
        electricityRate: 5,
        laborRate: 20,
        monthlyMaintenance: 1500,
        defaultLanguage: 'ar',
        defaultTheme: 'light',
        foundryName: 'المسبك',
        foundryNameEn: 'The Foundry',
      },
    });

    // 3. Raw Materials
    const cans = await prisma.rawMaterial.create({
      data: { name: 'Cans', nameAr: 'كانز', category: 'CANS', unit: 'kg', minStockLevel: 100, currentStock: 500, avgCostPerKg: 18.5 },
    });
    const plates = await prisma.rawMaterial.create({
      data: { name: 'Plates', nameAr: 'أطباق', category: 'PLATES', unit: 'kg', minStockLevel: 100, currentStock: 300, avgCostPerKg: 20.0 },
    });
    const crystal = await prisma.rawMaterial.create({
      data: { name: 'Crystal', nameAr: 'كريستال', category: 'CRYSTAL', unit: 'kg', minStockLevel: 50, currentStock: 200, avgCostPerKg: 22.0 },
    });
    const wire = await prisma.rawMaterial.create({
      data: { name: 'Wire', nameAr: 'سلك', category: 'WIRE', unit: 'kg', minStockLevel: 50, currentStock: 150, avgCostPerKg: 24.0 },
    });
    const mixed = await prisma.rawMaterial.create({
      data: { name: 'Mixed', nameAr: 'خليط', category: 'MIXED', unit: 'kg', minStockLevel: 100, currentStock: 400, avgCostPerKg: 15.0 },
    });

    // 4. Finished Products
    const ingot5 = await prisma.finishedProduct.create({
      data: { name: 'Ingot 5kg', nameAr: 'سبيكة 5 كجم', category: 'INGOT', sizeType: '5kg', unit: 'kg', minStockLevel: 50, currentStock: 200, avgCostPerKg: 28.0 },
    });
    const ingot10 = await prisma.finishedProduct.create({
      data: { name: 'Ingot 10kg', nameAr: 'سبيكة 10 كجم', category: 'INGOT', sizeType: '10kg', unit: 'kg', minStockLevel: 50, currentStock: 150, avgCostPerKg: 27.5 },
    });
    const ingot25 = await prisma.finishedProduct.create({
      data: { name: 'Ingot 25kg', nameAr: 'سبيكة 25 كجم', category: 'INGOT', sizeType: '25kg', unit: 'kg', minStockLevel: 30, currentStock: 100, avgCostPerKg: 27.0 },
    });
    const dross = await prisma.finishedProduct.create({
      data: { name: 'Dross', nameAr: 'خبث', category: 'DROSS', unit: 'kg', minStockLevel: 0, currentStock: 50, avgCostPerKg: 5.0 },
    });
    const slag = await prisma.finishedProduct.create({
      data: { name: 'Slag', nameAr: 'خبث ثقيل', category: 'SLAG', unit: 'kg', minStockLevel: 0, currentStock: 30, avgCostPerKg: 2.0 },
    });

    // 5. Suppliers
    const supplier1 = await prisma.supplier.create({
      data: { name: 'Mohamed Ahmed Scrap', nameAr: 'محمد أحمد للخردة', phone: '01012345678', address: 'القاهرة، مصر', paymentTerms: 15 },
    });
    const supplier2 = await prisma.supplier.create({
      data: { name: 'Al-Safa Aluminum Factory', nameAr: 'مصنع الصفا للألمنيوم', phone: '01123456789', address: 'الجيزة، مصر', paymentTerms: 30 },
    });
    const supplier3 = await prisma.supplier.create({
      data: { name: 'Al-Nour Metals Co.', nameAr: 'شركة النور للمعادن', phone: '01234567890', address: 'الإسكندرية، مصر', paymentTerms: 0 },
    });

    // 6. Customers
    const customer1 = await prisma.customer.create({
      data: { name: 'Al-Amal Aluminum Factory', nameAr: 'مصنع الأمل للألمنيوم', phone: '01098765432', address: 'القاهرة، مصر', paymentTerms: 15 },
    });
    const customer2 = await prisma.customer.create({
      data: { name: 'Modern Construction Co.', nameAr: 'شركة البناء الحديث', phone: '01187654321', address: 'الجيزة، مصر', paymentTerms: 30 },
    });
    const customer3 = await prisma.customer.create({
      data: { name: 'Al-Fajr Trading Est.', nameAr: 'مؤسسة الفجر التجارية', phone: '01276543210', address: 'الإسكندرية، مصر', paymentTerms: 0 },
    });

    // 7. Sample Purchases
    const purchases = [];
    const purchaseData = [
      { supplierId: supplier1.id, materialId: cans.id, quantity: 200, unitPrice: 18, date: new Date('2026-03-01') },
      { supplierId: supplier1.id, materialId: mixed.id, quantity: 300, unitPrice: 15, date: new Date('2026-03-05') },
      { supplierId: supplier2.id, materialId: plates.id, quantity: 150, unitPrice: 20, date: new Date('2026-03-10') },
      { supplierId: supplier2.id, materialId: crystal.id, quantity: 100, unitPrice: 22, date: new Date('2026-03-15') },
      { supplierId: supplier3.id, materialId: wire.id, quantity: 80, unitPrice: 24, date: new Date('2026-03-20') },
    ];

    for (const pd of purchaseData) {
      const totalCost = pd.quantity * pd.unitPrice;
      const purchase = await prisma.purchase.create({
        data: {
          date: pd.date,
          supplierId: pd.supplierId,
          materialId: pd.materialId,
          quantity: pd.quantity,
          unitPrice: pd.unitPrice,
          totalCost,
          paymentStatus: 'PENDING',
          paidAmount: 0,
          createdBy: admin.id,
        },
      });
      purchases.push(purchase);

      await prisma.inventoryMovement.create({
        data: {
          date: pd.date,
          type: 'IN',
          rawMaterialId: pd.materialId,
          quantity: pd.quantity,
          reason: 'PURCHASE',
          referenceId: purchase.id,
          userId: admin.id,
        },
      });
    }

    // 8. Sample Smelting Batches
    const batch1 = await prisma.smeltingBatch.create({
      data: {
        batchNumber: 1, date: new Date('2026-03-08'), status: 'COMPLETED',
        totalInputQty: 400, totalOutputQty: 352, lossRatio: 0.12,
        electricityHrs: 8, laborHrs: 6, otherExpenses: 50,
        materialCost: 6700, operatingCost: 210, maintenanceAlloc: 500,
        totalCost: 7410, costPerKg: 21.05, createdBy: admin.id,
      },
    });
    await prisma.batchInput.createMany({
      data: [
        { batchId: batch1.id, materialId: cans.id, quantity: 200, unitCost: 18.5 },
        { batchId: batch1.id, materialId: mixed.id, quantity: 200, unitCost: 15.0 },
      ],
    });
    await prisma.batchOutput.createMany({
      data: [
        { batchId: batch1.id, productId: ingot10.id, quantity: 300, costPerKg: 21.05 },
        { batchId: batch1.id, productId: dross.id, quantity: 52, costPerKg: 5.0 },
      ],
    });

    const batch2 = await prisma.smeltingBatch.create({
      data: {
        batchNumber: 2, date: new Date('2026-03-18'), status: 'COMPLETED',
        totalInputQty: 250, totalOutputQty: 225, lossRatio: 0.10,
        electricityHrs: 6, laborHrs: 5, otherExpenses: 30,
        materialCost: 5200, operatingCost: 160, maintenanceAlloc: 500,
        totalCost: 5860, costPerKg: 26.04, createdBy: admin.id,
      },
    });
    await prisma.batchInput.createMany({
      data: [
        { batchId: batch2.id, materialId: plates.id, quantity: 150, unitCost: 20.0 },
        { batchId: batch2.id, materialId: crystal.id, quantity: 100, unitCost: 22.0 },
      ],
    });
    await prisma.batchOutput.createMany({
      data: [
        { batchId: batch2.id, productId: ingot25.id, quantity: 200, costPerKg: 26.04 },
        { batchId: batch2.id, productId: dross.id, quantity: 25, costPerKg: 5.0 },
      ],
    });

    const batch3 = await prisma.smeltingBatch.create({
      data: {
        batchNumber: 3, date: new Date('2026-03-25'), status: 'COMPLETED',
        totalInputQty: 180, totalOutputQty: 155, lossRatio: 0.1389,
        electricityHrs: 5, laborHrs: 4, otherExpenses: 20,
        materialCost: 3770, operatingCost: 125, maintenanceAlloc: 500,
        totalCost: 4395, costPerKg: 28.35, createdBy: admin.id,
      },
    });
    await prisma.batchInput.createMany({
      data: [
        { batchId: batch3.id, materialId: wire.id, quantity: 80, unitCost: 24.0 },
        { batchId: batch3.id, materialId: cans.id, quantity: 100, unitCost: 18.5 },
      ],
    });
    await prisma.batchOutput.createMany({
      data: [
        { batchId: batch3.id, productId: ingot5.id, quantity: 135, costPerKg: 28.35 },
        { batchId: batch3.id, productId: slag.id, quantity: 20, costPerKg: 2.0 },
      ],
    });

    // 9. Sample Sales
    const sale1 = await prisma.sale.create({
      data: {
        date: new Date('2026-03-12'), customerId: customer1.id, productId: ingot10.id,
        batchId: batch1.id, quantity: 100, pricePerKg: 38, totalRevenue: 3800,
        costPerKg: 21.05, grossProfit: 1695, paymentStatus: 'PAID', paidAmount: 3800, createdBy: admin.id,
      },
    });
    const sale2 = await prisma.sale.create({
      data: {
        date: new Date('2026-03-20'), customerId: customer2.id, productId: ingot25.id,
        batchId: batch2.id, quantity: 100, pricePerKg: 40, totalRevenue: 4000,
        costPerKg: 26.04, grossProfit: 1396, paymentStatus: 'PARTIAL', paidAmount: 2000, createdBy: admin.id,
      },
    });
    const sale3 = await prisma.sale.create({
      data: {
        date: new Date('2026-03-26'), customerId: customer3.id, productId: ingot5.id,
        quantity: 50, pricePerKg: 42, totalRevenue: 2100,
        costPerKg: 28.35, grossProfit: 682.5, paymentStatus: 'PENDING', paidAmount: 0, createdBy: admin.id,
      },
    });
    const sale4 = await prisma.sale.create({
      data: {
        date: new Date('2026-03-28'), customerId: customer1.id, productId: dross.id,
        quantity: 30, pricePerKg: 8, totalRevenue: 240,
        costPerKg: 5.0, grossProfit: 90, paymentStatus: 'PAID', paidAmount: 240, createdBy: admin.id,
      },
    });

    // 10. Sample Payments
    await prisma.payment.create({
      data: { date: new Date('2026-03-03'), type: 'PAYABLE', amount: 3600, method: 'CASH', supplierId: supplier1.id, purchaseId: purchases[0].id, createdBy: admin.id },
    });
    await prisma.purchase.update({ where: { id: purchases[0].id }, data: { paidAmount: 3600, paymentStatus: 'PAID' } });

    await prisma.payment.create({
      data: { date: new Date('2026-03-08'), type: 'PAYABLE', amount: 2000, method: 'BANK_TRANSFER', supplierId: supplier1.id, purchaseId: purchases[1].id, createdBy: admin.id },
    });
    await prisma.purchase.update({ where: { id: purchases[1].id }, data: { paidAmount: 2000, paymentStatus: 'PARTIAL' } });

    await prisma.payment.create({
      data: { date: new Date('2026-03-12'), type: 'PAYABLE', amount: 3000, method: 'CHECK', supplierId: supplier2.id, purchaseId: purchases[2].id, createdBy: admin.id },
    });
    await prisma.purchase.update({ where: { id: purchases[2].id }, data: { paidAmount: 3000, paymentStatus: 'PAID' } });

    await prisma.payment.create({
      data: { date: new Date('2026-03-14'), type: 'RECEIVABLE', amount: 3800, method: 'CASH', customerId: customer1.id, saleId: sale1.id, createdBy: admin.id },
    });
    await prisma.payment.create({
      data: { date: new Date('2026-03-22'), type: 'RECEIVABLE', amount: 2000, method: 'BANK_TRANSFER', customerId: customer2.id, saleId: sale2.id, createdBy: admin.id },
    });
    await prisma.payment.create({
      data: { date: new Date('2026-03-28'), type: 'RECEIVABLE', amount: 240, method: 'CASH', customerId: customer1.id, saleId: sale4.id, createdBy: admin.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully!',
      credentials: {
        admin: { username: 'admin', password: 'Admin@2026' },
        operator: { username: 'operator', password: 'Operator@2026' },
        accountant: { username: 'accountant', password: 'Account@2026' },
      },
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
