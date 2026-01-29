import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create admin Supabase client for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY;
const BUNNY_STREAM_CDN = process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN;

interface FinalizeUploadPayload {
  shotId: string;
  versionNumber: number;
  description?: string;
  createdById: string;
  storagePath?: string; // Path where ProRes was uploaded
  streamVideoId?: string; // Bunny Stream video GUID
}

/**
 * POST /api/versions/finalize
 * Finalizes version creation after browser uploads complete
 */
export async function POST(request: NextRequest) {
  try {
    const body: FinalizeUploadPayload = await request.json();
    const { shotId, versionNumber, description, createdById, storagePath, streamVideoId } = body;

    if (!shotId || !versionNumber || !createdById) {
      return NextResponse.json(
        { error: 'Missing required fields: shotId, versionNumber, createdById' },
        { status: 400 }
      );
    }

    let previewUrl: string | null = null;
    let thumbnailPath: string | null = null;
    let bunnyVideoId: string | null = null;

    // Get Stream video info if uploaded
    if (streamVideoId && BUNNY_STREAM_LIBRARY_ID && BUNNY_STREAM_API_KEY) {
      const videoResponse = await fetch(
        `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${streamVideoId}`,
        {
          headers: {
            'AccessKey': BUNNY_STREAM_API_KEY,
          },
        }
      );

      if (videoResponse.ok) {
        const videoData = await videoResponse.json();
        bunnyVideoId = videoData.guid;
        
        // HLS URL for playback
        if (BUNNY_STREAM_CDN) {
          previewUrl = `${BUNNY_STREAM_CDN}/${videoData.guid}/playlist.m3u8`;
          thumbnailPath = `${BUNNY_STREAM_CDN}/${videoData.guid}/thumbnail.jpg`;
        }
      }
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
        download_url: storagePath || null,
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
      version,
    });
  } catch (error) {
    console.error('Finalize upload error:', error);
    return NextResponse.json(
      { error: 'Failed to finalize upload', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
