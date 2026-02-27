import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireUploader } from '@/lib/auth';

const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_STORAGE_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
const BUNNY_STORAGE_PASSWORD = process.env.BUNNY_STORAGE_PASSWORD;

/**
 * PUT /api/versions/upload-proxy
 * Proxies file uploads to Bunny Storage with server-side authentication.
 * Uses streaming to avoid buffering large files in memory.
 * Query params: path (required) - the storage path to upload to
 */
export async function PUT(request: NextRequest) {
  try {
    // Auth check
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const roleCheck = requireUploader(auth.user);
    if (roleCheck) return roleCheck;

    const storagePath = request.nextUrl.searchParams.get('path');
    if (!storagePath) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    if (!BUNNY_STORAGE_ZONE || !BUNNY_STORAGE_PASSWORD) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    // Get request body as a stream - don't buffer!
    const body = request.body;
    if (!body) {
      return NextResponse.json({ error: 'No file data provided' }, { status: 400 });
    }

    // Upload to Bunny Storage - stream directly without buffering
    const normalizedPath = storagePath.startsWith('/') ? storagePath : `/${storagePath}`;
    const bunnyUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}${normalizedPath}`;

    // Stream the request body directly to Bunny
    const bunnyResponse = await fetch(bunnyUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_STORAGE_PASSWORD,
        'Content-Type': 'application/octet-stream',
        // Forward content-length if available
        ...(request.headers.get('content-length') 
          ? { 'Content-Length': request.headers.get('content-length')! }
          : {}),
      },
      // @ts-expect-error - Node fetch supports ReadableStream body
      body: body,
      // Vercel edge supports duplex streaming
      duplex: 'half',
    });

    if (!bunnyResponse.ok) {
      const errorText = await bunnyResponse.text();
      console.error('Bunny Storage upload error:', bunnyResponse.status, errorText);
      return NextResponse.json(
        { error: `Storage upload failed: ${bunnyResponse.status}` },
        { status: bunnyResponse.status }
      );
    }

    return NextResponse.json({ 
      success: true, 
      path: normalizedPath,
    }, { status: 201 });

  } catch (error) {
    console.error('Upload proxy error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Use Edge runtime for streaming support
export const runtime = 'edge';
