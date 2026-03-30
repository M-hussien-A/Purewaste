import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-response';
import { logAction } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return errorResponse(
        'INVALID_CREDENTIALS',
        'Username and password are required',
        undefined,
        400
      );
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.isActive) {
      return errorResponse(
        'INVALID_CREDENTIALS',
        'Invalid username or password',
        undefined,
        401
      );
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMs = user.lockedUntil.getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      return errorResponse(
        'ACCOUNT_LOCKED',
        `Account is locked. Try again in ${remainingMin} minute(s).`,
        undefined,
        423
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      // Increment failed logins
      const failedLogins = user.failedLogins + 1;
      const updateData: any = { failedLogins };

      // Lock account after 5 failed attempts for 15 minutes
      if (failedLogins >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        updateData.failedLogins = 0;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      // Log failed login attempt
      await logAction({
        userId: user.id,
        action: 'FAILED_LOGIN',
        module: 'auth',
        ipAddress:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });

      return errorResponse(
        'INVALID_CREDENTIALS',
        'Invalid username or password',
        undefined,
        401
      );
    }

    // Reset failed logins on successful auth
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        languagePref: user.languagePref,
        themePref: user.themePref,
      },
      process.env.NEXTAUTH_SECRET!,
      { expiresIn: '24h' }
    );

    // Log successful login
    await logAction({
      userId: user.id,
      action: 'LOGIN',
      module: 'auth',
      ipAddress:
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return successResponse({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        languagePref: user.languagePref,
        themePref: user.themePref,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse(
      'INTERNAL_ERROR',
      'An unexpected error occurred',
      undefined,
      500
    );
  }
}
