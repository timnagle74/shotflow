import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  uploadToStorage,
  createStreamVideo,
  uploadToStream,
  getStreamVideo,
  isStorageConfigured,
  isStreamConfigured,
  generateSignedStorageUrl,
} from '@/lib/bunny';

// Create admin Supabase client for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for large file uploads

interface UploadPayload {
  shotId: string;
  versionNumber: number;
  description?: string;
  createdById: string;
}

/**
 * POST /api/versions/upload
 * Upload a new version with video files to Bunny.net
 * 
 * Form data:
 * - metadata: JSON string with UploadPayload
 * - prores: ProRes file for download (optional)
 * - preview: H.265/H.264 file for web playback (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Parse metadata
    const metadataStr = formData.get('metadata') as string;
    if (!metadataStr) {
      return NextResponse.json(
        { error: 'Missing metadata in form data' },
        { status: 400 }
      );
    }

    const metadata: UploadPayload = JSON.parse(metadataStr);
    const { shotId, versionNumber, description, createdById } = metadata;

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
          project:projects!inner(code)
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
    const sequenceData = shot.sequence as unknown as { code: string; project: { code: string } };
    const projectCode = sequenceData.project.code;
    const shotCode = shot.code;
    const versionStr = `v${String(versionNumber).padStart(3, '0')}`;
    const basePath = `${projectCode}/${shotCode}/${versionStr}`;

    let previewUrl: string | null = null;
    let downloadUrl: string | null = null;
    let bunnyVideoId: string | null = null;
    let thumbnailPath: string | null = null;

    // Handle ProRes upload to Bunny Storage
    const proresFile = formData.get('prores') as File | null;
    if (proresFile && isStorageConfigured()) {
      const buffer = Buffer.from(await proresFile.arrayBuffer());
      const ext = proresFile.name.split('.').pop() || 'mov';
      const storagePath = `${basePath}/${shotCode}_${versionStr}.${ext}`;

      const storageResult = await uploadToStorage(buffer, storagePath, 'video/quicktime');
      downloadUrl = storageResult.path; // Store path, generate signed URL on-demand
    }

    // Handle preview upload to Bunny Stream
    const previewFile = formData.get('preview') as File | null;
    if (previewFile && isStreamConfigured()) {
      const buffer = Buffer.from(await previewFile.arrayBuffer());
      const title = `${projectCode}_${shotCode}_${versionStr}`;

      // Create video entry and upload
      const { guid } = await createStreamVideo(title);
      await uploadToStream(guid, buffer);

      // Get video info
      const videoInfo = await getStreamVideo(guid);
      
      bunnyVideoId = videoInfo.videoId;
      previewUrl = videoInfo.hlsUrl;
      thumbnailPath = videoInfo.thumbnailUrl;
    }

    // Create version record in database
    const { data: version, error: versionError } = await supabaseAdmin
      .from('versions')
      .insert({
        shot_id: shotId,
        version_number: versionNumber,
        created_by_id: createdById,
        status: 'WIP',
        description: description || null,
        preview_url: previewUrl,
        download_url: downloadUrl,
        bunny_video_id: bunnyVideoId,
        thumbnail_path: thumbnailPath,
      })
      .select()
      .single();

    if (versionError) {
      console.error('Failed to create version:', versionError);
      return NextResponse.json(
        { error: 'Failed to create version record', details: versionError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      version: {
        ...version,
        // Generate signed download URL if available
        signedDownloadUrl: downloadUrl 
          ? generateSignedStorageUrl(downloadUrl, { expiresIn: 3600, directDownload: true })
          : null,
      },
    });
  } catch (error) {
    console.error('Version upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
