import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireUploader } from '@/lib/auth';

const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_STORAGE_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
const BUNNY_STORAGE_PASSWORD = process.env.BUNNY_STORAGE_PASSWORD;

/**
 * PUT /api/versions/upload-proxy
 * Proxies file uploads to Bunny Storage with server-side authentication.
 * Uses Node.js runtime with streaming to handle large files.
 * Query params: path (required) - the storage path to upload to
 */
export async function PUT(request: NextRequest) {
  console.log('[upload-proxy] Starting upload...');
  
  try {
    // Auth check
    const auth = await authenticateRequest(request);
    if (auth.error) {
      console.log('[upload-proxy] Auth failed');
      return auth.error;
    }
    console.log('[upload-proxy] Auth passed for user:', auth.user.email);

    const storagePath = request.nextUrl.searchParams.get('path');
    if (!storagePath) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }
    console.log('[upload-proxy] Storage path:', storagePath);

    if (!BUNNY_STORAGE_ZONE || !BUNNY_STORAGE_PASSWORD) {
      console.log('[upload-proxy] Storage not configured - zone:', !!BUNNY_STORAGE_ZONE, 'password:', !!BUNNY_STORAGE_PASSWORD);
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    // Get content length for progress tracking
    const contentLength = request.headers.get('content-length');
    console.log('[upload-proxy] Content-Length:', contentLength);

    // Get request body as a stream
    const body = request.body;
    if (!body) {
      return NextResponse.json({ error: 'No file data provided' }, { status: 400 });
    }

    // Upload to Bunny Storage
    const normalizedPath = storagePath.startsWith('/') ? storagePath : `/${storagePath}`;
    const bunnyUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}${normalizedPath}`;
    console.log('[upload-proxy] Uploading to:', bunnyUrl);

    // Build headers
    const headers: Record<string, string> = {
      'AccessKey': BUNNY_STORAGE_PASSWORD,
      'Content-Type': 'application/octet-stream',
    };
    if (contentLength) {
      headers['Content-Length'] = contentLength;
    }

    // Stream the request body directly to Bunny
    const bunnyResponse = await fetch(bunnyUrl, {
      method: 'PUT',
      headers,
      // @ts-expect-error - ReadableStream body is valid
      body: body,
      duplex: 'half',
    } as RequestInit);

    console.log('[upload-proxy] Bunny response status:', bunnyResponse.status);

    if (!bunnyResponse.ok) {
      const errorText = await bunnyResponse.text();
      console.error('[upload-proxy] Bunny Storage error:', bunnyResponse.status, errorText);
      return NextResponse.json(
        { error: `Storage upload failed: ${bunnyResponse.status} - ${errorText}` },
        { status: bunnyResponse.status }
      );
    }

    console.log('[upload-proxy] Upload successful');
    return NextResponse.json({ 
      success: true, 
      path: normalizedPath,
    }, { status: 201 });

  } catch (error) {
    console.error('[upload-proxy] Error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Node.js runtime for full streaming support
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes
