import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireInternal, getServiceClient } from '@/lib/auth';

const BUNNY_STORAGE_CDN_URL = process.env.BUNNY_STORAGE_CDN_URL;
const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY;
const BUNNY_STREAM_CDN = process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN;

interface FinalizeUploadPayload {
  shotId: string;
  versionNumber: number;
  description?: string;
  createdById?: string; // DEPRECATED: ignored, creator is derived from auth session
  storagePath?: string; // Path where ProRes was uploaded
}

/**
 * POST /api/versions/finalize
 * Finalizes version creation and triggers transcoding via Bunny Stream
 */
export async function POST(request: NextRequest) {
  try {
    // Auth: any internal team member can finalize uploads
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const roleCheck = requireInternal(auth.user);
    if (roleCheck) return roleCheck;

    const body: FinalizeUploadPayload = await request.json();
    const { shotId, versionNumber, description, storagePath } = body;
    // Always use the authenticated user as the creator — never trust client input
    const createdById = auth.user.userId;

    if (!shotId || !versionNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: shotId, versionNumber' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getServiceClient();

    let previewUrl: string | null = null;
    let thumbnailPath: string | null = null;
    let bunnyVideoId: string | null = null;

    // Get shot info for video title
    const { data: shot } = await supabaseAdmin
      .from('shots')
      .select('code')
      .eq('id', shotId)
      .single();

    const versionStr = `v${String(versionNumber).padStart(3, '0')}`;
    const title = `${shot?.code || 'shot'}_${versionStr}`;

    // If we have a storage path, set up Bunny Stream transcoding
    if (storagePath && BUNNY_STORAGE_CDN_URL && BUNNY_STREAM_LIBRARY_ID && BUNNY_STREAM_API_KEY) {
      try {
        // 1. Create Bunny Stream video entry
        const createVideoResponse = await fetch(
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

        if (createVideoResponse.ok) {
          const videoData = await createVideoResponse.json();
          bunnyVideoId = videoData.guid;

          // Set up preview URLs (will be available after transcoding)
          if (BUNNY_STREAM_CDN) {
            previewUrl = `${BUNNY_STREAM_CDN}/${videoData.guid}/playlist.m3u8`;
            thumbnailPath = `${BUNNY_STREAM_CDN}/${videoData.guid}/thumbnail.jpg`;
          }

          // 2. Trigger Bunny Stream fetch to download and transcode
          const sourceUrl = `${BUNNY_STORAGE_CDN_URL}/${storagePath}`;
          const fetchResponse = await fetch(
            `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${bunnyVideoId}/fetch`,
            {
              method: 'POST',
              headers: {
                'AccessKey': BUNNY_STREAM_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ url: sourceUrl }),
            }
          );

          if (fetchResponse.ok) {
            console.log('Bunny Stream fetch triggered for version:', title);
          } else {
            console.error('Bunny Stream fetch failed:', await fetchResponse.text());
          }
        }
      } catch (transcodeError) {
        // Log but don't fail - version is still created, just without preview
        console.error('Transcoding setup failed:', transcodeError);
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
      transcoding: bunnyVideoId ? {
        videoId: bunnyVideoId,
        status: 'processing',
        message: 'Video is being transcoded for web playback. This may take a few minutes.',
      } : null,
    });
  } catch (error) {
    console.error('Finalize upload error:', error);
    return NextResponse.json(
      { error: 'Failed to finalize upload', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
