import { NextRequest, NextResponse } from 'next/server';

/**
 * Admin API proxy route.
 * 
 * Forwards requests from /api/admin/* to the backend FastAPI server at
 * NEXT_PUBLIC_API_BASE_URL/api/v1/admin/*, attaching the admin monitoring
 * token from the server-side environment variable (NOT exposed to the client).
 * 
 * This prevents the ADMIN_MONITORING_TOKEN from being embedded in browser
 * JavaScript bundles via NEXT_PUBLIC_ prefix.
 */

const BACKEND_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.abidii.app';
// Server-only var — never fall back to a NEXT_PUBLIC_-prefixed copy here,
// or the token would ship in the client bundle the moment one is set.
const ADMIN_TOKEN = process.env.ADMIN_MONITORING_TOKEN || '';

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

    // Attach admin token (server-side only)
    if (ADMIN_TOKEN) {
      headers.set('x-admin-token', ADMIN_TOKEN);
    }

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
