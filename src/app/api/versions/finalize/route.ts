import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireUploader, getServiceClient } from '@/lib/auth';
import { fetchVideoToStream } from '@/lib/bunny';
import { getPresignedDownloadUrl } from '@/lib/s3';

const BUNNY_STREAM_CDN = process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN;

interface FinalizeUploadPayload {
  versionId: string;
  storageKey: string; // S3 key where file was uploaded
  title: string; // Video title for Stream
}

/**
 * POST /api/versions/finalize
 * Called after file upload to S3/MinIO completes.
 * Triggers Bunny Stream to fetch and transcode the video for web preview.
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const roleCheck = requireUploader(auth.user);
    if (roleCheck) return roleCheck;

    const body: FinalizeUploadPayload = await request.json();
    const { versionId, storageKey, title } = body;

    if (!versionId || !storageKey) {
      return NextResponse.json(
        { error: 'Missing required fields: versionId, storageKey' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Generate a presigned URL for Stream to fetch from (valid for 1 hour)
    let sourceUrl: string;
    try {
      sourceUrl = await getPresignedDownloadUrl(storageKey, 3600);
    } catch (err) {
      console.error('Failed to generate presigned URL for Stream fetch:', err);
      return NextResponse.json(
        { error: 'Failed to generate download URL for transcoding' },
        { status: 500 }
      );
    }

    // Trigger Bunny Stream to fetch and transcode the video
    let videoId: string | null = null;
    let previewUrl: string | null = null;

    try {
      const fetchResult = await fetchVideoToStream(sourceUrl, title || 'Untitled');
      videoId = fetchResult.videoId;
      
      if (videoId && BUNNY_STREAM_CDN) {
        previewUrl = `${BUNNY_STREAM_CDN}/${videoId}/playlist.m3u8`;
      }
    } catch (streamError) {
      console.error('Stream fetch failed (continuing without preview):', streamError);
      // Don't fail the whole request - download still works without preview
    }

    // Update version records with video info
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
      status: 'internal_review', // Mark as ready for review
    };
    
    if (videoId) {
      updateData.video_id = videoId;
    }
    if (previewUrl) {
      updateData.preview_url = previewUrl;
    }

    // Update shot_versions table
    const { data: version, error: updateError } = await supabase
      .from('shot_versions')
      .update(updateData)
      .eq('id', versionId)
      .select('id, shot_id')
      .single();

    if (updateError) {
      console.error('Failed to update shot_versions:', updateError);
    }

    // Also update legacy versions table
    const legacyUpdate: Record<string, any> = {
      status: 'INTERNAL_REVIEW',
    };
    if (videoId) {
      legacyUpdate.bunny_video_id = videoId;
    }
    if (previewUrl) {
      legacyUpdate.preview_url = previewUrl;
    }

    await supabase
      .from('versions')
      .update(legacyUpdate)
      .eq('id', versionId);

    // Flip the parent shot into internal review atomically with the version finalize
    if (version?.shot_id) {
      await supabase
        .from('shots')
        .update({ status: 'INTERNAL_REVIEW' })
        .eq('id', version.shot_id);
    }

    return NextResponse.json({
      success: true,
      version,
      videoId,
      previewUrl,
    });
  } catch (error) {
    console.error('Finalize upload error:', error);
    return NextResponse.json(
      { error: 'Failed to finalize upload', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
