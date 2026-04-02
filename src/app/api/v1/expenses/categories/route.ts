import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-response';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }

    const categories = await prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return successResponse(categories);
  } catch (error) {
    console.error('List expense categories error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch categories', null, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userRole = (session.user as any).role;
    if (userRole !== 'ADMIN') {
      return errorResponse('FORBIDDEN', 'Admin only', null, 403);
    }

    const body = await request.json();
    const { name, nameAr, type } = body;

    if (!name || !nameAr || !type) {
      return errorResponse('VALIDATION_ERROR', 'Name, nameAr, and type are required', null, 400);
    }

    const category = await prisma.expenseCategory.create({
      data: { name, nameAr, type },
    });

    return successResponse(category);
  } catch (error) {
    console.error('Create expense category error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to create category', null, 500);
  }
}
