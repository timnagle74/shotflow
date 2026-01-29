import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create admin Supabase client for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_STORAGE_PASSWORD = process.env.BUNNY_STORAGE_PASSWORD;
const BUNNY_STORAGE_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY;

interface PrepareUploadPayload {
  shotId: string;
  versionNumber: number;
  description?: string;
  createdById: string;
  hasProres: boolean;
  hasPreview: boolean;
  proresFilename?: string;
  previewFilename?: string;
}

/**
 * POST /api/versions/prepare-upload
 * Prepares upload URLs for direct browser upload to Bunny.net
 * Returns storage URLs and creates Stream video entry
 */
export async function POST(request: NextRequest) {
  try {
    const body: PrepareUploadPayload = await request.json();
    const { shotId, versionNumber, description, createdById, hasProres, hasPreview, proresFilename, previewFilename } = body;

    if (!shotId || !versionNumber || !createdById) {
      return NextResponse.json(
        { error: 'Missing required fields: shotId, versionNumber, createdById' },
        { status: 400 }
      );
    }

    // Get shot info for path construction
    const { data: shot, error: shotError } = await supabaseAdmin
      .from('shots')
      .select(`
        id,
        code,
        sequence:sequences!inner(
          code,
          project:projects!inner(code, name)
        )
      `)
      .eq('id', shotId)
      .single();

    if (shotError || !shot) {
      return NextResponse.json(
        { error: 'Shot not found' },
        { status: 404 }
      );
    }

    // Type assertion for nested data
    const sequenceData = shot.sequence as unknown as { code: string; project: { code: string; name: string } };
    const projectCode = sequenceData.project.code;
    const projectName = sequenceData.project.name;
    const shotCode = shot.code;
    const versionStr = `v${String(versionNumber).padStart(3, '0')}`;
    const basePath = `${projectCode}/${shotCode}/${versionStr}`;

    const result: {
      storageUpload?: {
        url: string;
        path: string;
        accessKey: string;
      };
      streamUpload?: {
        libraryId: string;
        videoId: string;
        uploadUrl: string;
        accessKey: string;
      };
      metadata: {
        shotId: string;
        versionNumber: number;
        description?: string;
        createdById: string;
        projectCode: string;
        shotCode: string;
        basePath: string;
      };
    } = {
      metadata: {
        shotId,
        versionNumber,
        description,
        createdById,
        projectCode,
        shotCode,
        basePath,
      },
    };

    // Prepare Storage upload URL for ProRes
    if (hasProres && BUNNY_STORAGE_ZONE && BUNNY_STORAGE_PASSWORD) {
      const ext = proresFilename?.split('.').pop() || 'mov';
      const storagePath = `${basePath}/${shotCode}_${versionStr}.${ext}`;
      const uploadUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${storagePath}`;

      result.storageUpload = {
        url: uploadUrl,
        path: storagePath,
        accessKey: BUNNY_STORAGE_PASSWORD, // Passed securely for direct browser upload
      };
    }

    // Create Stream video entry for preview
    if (hasPreview && BUNNY_STREAM_LIBRARY_ID && BUNNY_STREAM_API_KEY) {
      const title = `${projectName}_${shotCode}_${versionStr}`;
      
      // Create video entry in Bunny Stream
      const createResponse = await fetch(
        `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos`,
        {
          method: 'POST',
          headers: {
            'AccessKey': BUNNY_STREAM_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title }),
        }
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Bunny Stream create error:', errorText);
        return NextResponse.json(
          { error: 'Failed to create video entry in Bunny Stream' },
          { status: 500 }
        );
      }

      const videoData = await createResponse.json();
      
      result.streamUpload = {
        libraryId: BUNNY_STREAM_LIBRARY_ID,
        videoId: videoData.guid,
        uploadUrl: `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoData.guid}`,
        accessKey: BUNNY_STREAM_API_KEY, // Passed securely for direct browser upload
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Prepare upload error:', error);
    return NextResponse.json(
      { error: 'Failed to prepare upload', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
