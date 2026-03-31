import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkPermission } from '@/lib/rbac';
import { logAction } from '@/lib/audit';
import { successResponse, errorResponse } from '@/lib/api-response';
import bcrypt from 'bcryptjs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const USER_SELECT = {
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
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'users', 'read')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });

    if (!user) {
      return errorResponse('NOT_FOUND', 'User not found', null, 404);
    }

    return successResponse(user);
  } catch (error) {
    console.error('Get user error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch user', null, 500);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const currentUserId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'users', 'update')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;
    const body = await request.json();
    const { username, email, fullName, phone, password, role, languagePref, themePref, isActive } = body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'User not found', null, 404);
    }

    // Check uniqueness if changing username or email
    if (username && username !== existing.username) {
      const dup = await prisma.user.findUnique({ where: { username } });
      if (dup) {
        return errorResponse('VALIDATION_ERROR', 'Username already taken', null, 409);
      }
    }
    if (email && email !== existing.email) {
      const dup = await prisma.user.findUnique({ where: { email } });
      if (dup) {
        return errorResponse('VALIDATION_ERROR', 'Email already taken', null, 409);
      }
    }

    const updateData: any = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (fullName !== undefined) updateData.fullName = fullName;
    if (phone !== undefined) updateData.phone = phone;
    if (role !== undefined) updateData.role = role;
    if (languagePref !== undefined) updateData.languagePref = languagePref;
    if (themePref !== undefined) updateData.themePref = themePref;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: USER_SELECT,
    });

    const auditAction = password ? 'PASSWORD_CHANGE' : 'UPDATE';
    await logAction({
      userId: currentUserId,
      action: auditAction as any,
      module: 'users',
      recordId: id,
      oldValue: { ...existing, passwordHash: '[REDACTED]' } as any,
      newValue: updated as any,
    });

    return successResponse(updated);
  } catch (error) {
    console.error('Update user error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to update user', null, 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', null, 401);
    }
    const currentUserId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (!checkPermission(userRole, 'users', 'delete')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', null, 403);
    }

    const { id } = await context.params;

    if (id === currentUserId) {
      return errorResponse('VALIDATION_ERROR', 'Cannot delete your own account', null, 400);
    }

    const existing = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'User not found', null, 404);
    }

    // Deactivate instead of hard delete to preserve audit trail
    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: USER_SELECT,
    });

    await logAction({
      userId: currentUserId,
      action: 'DELETE',
      module: 'users',
      recordId: id,
      oldValue: existing as any,
      newValue: updated as any,
    });

    return successResponse({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to delete user', null, 500);
  }
}
