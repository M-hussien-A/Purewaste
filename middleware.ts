import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';

const intlMiddleware = createMiddleware(routing);

// Routes that don't require authentication
const publicPatterns = [
  /^\/[a-z]{2}\/login$/,
  /^\/login$/,
  /^\/api\/auth\//,
  /^\/api\/v1\/auth\/login$/,
];

function isPublicRoute(pathname: string): boolean {
  return publicPatterns.some((pattern) => pattern.test(pathname));
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip locale handling for API routes
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Apply next-intl middleware for locale handling
  const intlResponse = intlMiddleware(request);

  // Check if route is public
  if (isPublicRoute(pathname)) {
    return intlResponse;
  }

  // For protected routes, check authentication via next-auth session token
  const token =
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value;

  if (!token) {
    // Extract locale from pathname or use default
    const localeMatch = pathname.match(/^\/([a-z]{2})\//);
    const locale = localeMatch?.[1] || routing.defaultLocale;

    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlResponse;
}

export const config = {
  matcher: [
    // Match all pathnames except static files and Next.js internals
    '/((?!_next|.*\\..*).*)',
  ],
};
