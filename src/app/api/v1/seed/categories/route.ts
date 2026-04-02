import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dailyCategories = [
      { name: 'Maintenance & Repairs', nameAr: 'صيانة وإصلاحات', type: 'DAILY' as const },
      { name: 'Transport & Delivery', nameAr: 'نقل وتوصيل', type: 'DAILY' as const },
      { name: 'Food & Beverages', nameAr: 'طعام ومشروبات', type: 'DAILY' as const },
      { name: 'Miscellaneous', nameAr: 'متنوعات', type: 'DAILY' as const },
      { name: 'Tools & Supplies', nameAr: 'أدوات ومستلزمات', type: 'DAILY' as const },
    ];

    const monthlyCategories = [
      { name: 'Rent', nameAr: 'إيجار', type: 'MONTHLY' as const },
      { name: 'Electricity Bill', nameAr: 'فاتورة كهرباء', type: 'MONTHLY' as const },
      { name: 'Environment Fees', nameAr: 'رسوم بيئية', type: 'MONTHLY' as const },
      { name: 'Security', nameAr: 'أمن وحراسة', type: 'MONTHLY' as const },
      { name: 'Insurance', nameAr: 'تأمين', type: 'MONTHLY' as const },
    ];

    const allCategories = [...dailyCategories, ...monthlyCategories];

    for (const cat of allCategories) {
      await prisma.expenseCategory.upsert({
        where: { name: cat.name },
        update: { nameAr: cat.nameAr, type: cat.type },
        create: cat,
      });
    }

    const count = await prisma.expenseCategory.count();

    return NextResponse.json({
      success: true,
      message: `Seeded ${allCategories.length} expense categories. Total in DB: ${count}`,
    });
  } catch (error: any) {
    console.error('Seed categories error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
