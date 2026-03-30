import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getModulesForRole } from '@/lib/rbac';
import { UserRole } from '@prisma/client';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return errorResponse(
        'UNAUTHORIZED',
        'Not authenticated',
        undefined,
        401
      );
    }

    const user = session.user as any;
    const role = user.role as UserRole;
    const allowedModules = getModulesForRole(role);

    return successResponse({
      id: user.id,
      username: user.username,
      fullName: user.name,
      email: user.email,
      role: user.role,
      languagePref: user.languagePref,
      themePref: user.themePref,
      permissions: {
        allowedModules,
      },
    });
  } catch (error) {
    console.error('Me endpoint error:', error);
    return errorResponse(
      'INTERNAL_ERROR',
      'An unexpected error occurred',
      undefined,
      500
    );
  }
}
