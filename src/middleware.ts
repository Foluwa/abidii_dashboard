import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to handle authentication redirects
 * Client-side auth checks are handled by useRequireAuth hook in layouts
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/signin', '/signup'];
  const isPublicRoute = publicRoutes.includes(pathname);

  // Coarse presence check on the httpOnly access_token cookie the backend
  // sets on login. Middleware runs server-side/at the Edge, so it can read
  // this even though client JS can't — no decoding needed, same
  // presence-only check this middleware always did, just against the real
  // auth cookie now instead of a separate client-set mirror of it.
  const accessTokenCookie = request.cookies.get('access_token')?.value;
  const isAuthenticated = !!accessTokenCookie;

  // If authenticated and trying to access login/signin page, redirect to dashboard
  // BUT: Add check to prevent redirect if we just came from dashboard (prevent loop)
  if (isAuthenticated && (pathname === '/' || pathname === '/signin')) {
    const referer = request.headers.get('referer');
    const isDashboardReferer = referer?.includes('/dashboard');
    
    // Only redirect if NOT coming from dashboard (prevents loop)
    if (!isDashboardReferer) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } else {
    }
  }

  // Protect admin routes from unauthenticated access server-side
  const isAdminRoute = pathname === '/dashboard' ||
    pathname.startsWith('/content/') ||
    pathname.startsWith('/curriculum/') ||
    pathname.startsWith('/media/') ||
    pathname.startsWith('/community/') ||
    pathname.startsWith('/subscriptions/') ||
    pathname.startsWith('/notifications/') ||
    pathname.startsWith('/settings/') ||
    pathname.startsWith('/operations/') ||
    pathname.startsWith('/system/') ||
    pathname.startsWith('/analytics/') ||
    pathname.startsWith('/enforcement');

  if (isAdminRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL('/signin', request.url));
  }

  // Allow all other requests to proceed
  // Protected route checks are handled client-side by useRequireAuth
  return NextResponse.next();
}

/**
 * Matcher configuration - which routes to apply middleware to
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|images|.*\\..*|api).*)',
  ],
};
