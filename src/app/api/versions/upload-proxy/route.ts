import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireUploader } from '@/lib/auth';

const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_STORAGE_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
const BUNNY_STORAGE_PASSWORD = process.env.BUNNY_STORAGE_PASSWORD;

/**
 * PUT /api/versions/upload-proxy
 * Proxies file uploads to Bunny Storage with server-side authentication.
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

    // Get the file data from request body
    const fileData = await request.arrayBuffer();
    
    // Upload to Bunny Storage
    const normalizedPath = storagePath.startsWith('/') ? storagePath : `/${storagePath}`;
    const bunnyUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}${normalizedPath}`;

    const bunnyResponse = await fetch(bunnyUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_STORAGE_PASSWORD,
        'Content-Type': 'application/octet-stream',
      },
      body: fileData,
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
      size: fileData.byteLength
    }, { status: 201 });

  } catch (error) {
    console.error('Upload proxy error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Configure for large file uploads (Next.js App Router)
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for large uploads
