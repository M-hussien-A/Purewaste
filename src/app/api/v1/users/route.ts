import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkPermission } from '@/lib/rbac';
import { logAction } from '@/lib/audit';
import { successResponse, errorResponse } from '@/lib/api-response';
import bcrypt from 'bcryptjs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'users', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        languagePref: true,
        themePref: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return successResponse(users);
  } catch (error) {
    console.error('List users error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch users', null, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'users', 'create')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const body = await request.json();
    const { username, email, fullName, phone, password, role, languagePref, themePref } = body;

    if (!username || !email || !fullName || !password) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Missing required fields: username, email, fullName, password',
        null,
        400
      );
    }

    // Check for existing username or email
    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    if (existing) {
      const field = existing.username === username ? 'username' : 'email';
      return errorResponse('VALIDATION_ERROR', `A user with this ${field} already exists`, null, 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        fullName,
        phone: phone || null,
        passwordHash,
        role: role || 'VIEWER',
        languagePref: languagePref || 'ar',
        themePref: themePref || 'light',
      },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        languagePref: true,
        themePref: true,
        isActive: true,
        createdAt: true,
      },
    });

    await logAction({
      userId,
      action: 'CREATE',
      module: 'users',
      recordId: user.id,
      newValue: user as any,
    });

    return successResponse(user);
  } catch (error) {
    console.error('Create user error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to create user', null, 500);
  }
}
