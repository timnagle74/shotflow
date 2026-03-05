import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireUploader, getServiceClient } from '@/lib/auth';
import { fetchVideoToStream, bunnyConfig, generateSignedStorageUrl } from '@/lib/bunny';

const BUNNY_STREAM_CDN = process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN;

interface FinalizeUploadPayload {
  versionId: string;
  storagePath: string; // Path in Bunny Storage
  title: string; // Video title for Stream
}

/**
 * POST /api/versions/finalize
 * Called after file upload to Bunny Storage completes.
 * Triggers Bunny Stream to fetch and transcode the video.
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const roleCheck = requireUploader(auth.user);
    if (roleCheck) return roleCheck;

    const body: FinalizeUploadPayload = await request.json();
    const { versionId, storagePath, title } = body;

    if (!versionId || !storagePath) {
      return NextResponse.json(
        { error: 'Missing required fields: versionId, storagePath' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Generate a signed URL for Stream to fetch from (valid for 1 hour)
    const sourceUrl = generateSignedStorageUrl(storagePath, { expiresIn: 3600 });

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
      .select()
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
    
    if (Object.keys(legacyUpdate).length > 0) {
      await supabase
        .from('versions')
        .update(legacyUpdate)
        .eq('id', versionId);
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
