import { NextRequest, NextResponse } from 'next/server';

/**
 * Admin API proxy route.
 *
 * Forwards requests from /api/admin/* to the backend FastAPI server at
 * NEXT_PUBLIC_API_BASE_URL/api/v1/admin/*. The caller's own session (the
 * httpOnly access_token cookie, set by the backend and attached by the
 * browser automatically since this is a same-origin request) rides through
 * untouched via the forwarded headers below — the backend's own
 * authentication/RBAC decides what that session is allowed to do.
 *
 * This route must never attach any credential of its own (e.g. a shared
 * service/admin token) on behalf of the caller — doing so would grant
 * admin authority to every request through this proxy regardless of
 * whether the caller has a valid (or any) session. See
 * security-audit/REPORT.md finding #1.
 */

const BACKEND_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.abidii.app';

async function handleRequest(request: NextRequest, method: string) {
  try {
    // Extract the path after /api/admin/
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\/admin\//, '');

    // Build the backend URL
    const backendUrl = `${BACKEND_BASE}/api/v1/admin/${path}${url.search}`;

    // Forward headers (skip host, connection, etc.)
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('connection');
    headers.delete('content-length');

    const requestBody = method !== 'GET' && method !== 'HEAD'
      ? Buffer.from(await request.arrayBuffer())
      : undefined;

    // Forward the request to the backend
    const response = await fetch(backendUrl, {
      method,
      headers,
      body: requestBody,
    });

    // Read the response body
    const body = await response.text();

    // Return the response with the same status and headers
    return new NextResponse(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error) {
    console.error('Admin API proxy error:', error);
    return NextResponse.json(
      { error: { type: 'proxy_error', message: 'Failed to forward request to backend' } },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  return handleRequest(request, 'POST');
}

export async function PUT(request: NextRequest) {
  return handleRequest(request, 'PUT');
}

export async function PATCH(request: NextRequest) {
  return handleRequest(request, 'PATCH');
}

export async function DELETE(request: NextRequest) {
  return handleRequest(request, 'DELETE');
}
