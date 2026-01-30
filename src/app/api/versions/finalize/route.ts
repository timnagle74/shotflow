import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTranscodeJob, isCoconutConfigured } from '@/lib/coconut';

// Create admin Supabase client for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUNNY_STORAGE_CDN_URL = process.env.BUNNY_STORAGE_CDN_URL;
const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY;
const BUNNY_STREAM_CDN = process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN;
const VERCEL_URL = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL;

interface FinalizeUploadPayload {
  shotId: string;
  versionNumber: number;
  description?: string;
  createdById: string;
  storagePath?: string; // Path where ProRes was uploaded
}

/**
 * POST /api/versions/finalize
 * Finalizes version creation and triggers transcoding
 * 
 * Flow:
 * 1. Create Bunny Stream video entry
 * 2. Trigger Coconut transcoding (ProRes → H.264 → Coconut temp storage)
 * 3. Create version record in database
 * 4. Webhook will tell Bunny Stream to fetch the transcoded file
 */
export async function POST(request: NextRequest) {
  try {
    const body: FinalizeUploadPayload = await request.json();
    const { shotId, versionNumber, description, createdById, storagePath } = body;

    if (!shotId || !versionNumber || !createdById) {
      return NextResponse.json(
        { error: 'Missing required fields: shotId, versionNumber, createdById' },
        { status: 400 }
      );
    }

    let previewUrl: string | null = null;
    let thumbnailPath: string | null = null;
    let bunnyVideoId: string | null = null;
    let transcodeJobId: string | null = null;

    // Get shot info for video title
    const { data: shot } = await supabaseAdmin
      .from('shots')
      .select('code')
      .eq('id', shotId)
      .single();

    const versionStr = `v${String(versionNumber).padStart(3, '0')}`;
    const title = `${shot?.code || 'shot'}_${versionStr}`;

    // Debug logging for transcoding setup
    console.log('Transcode check:', {
      hasStoragePath: !!storagePath,
      storagePath,
      isCoconutConfigured: isCoconutConfigured(),
      hasCdnUrl: !!BUNNY_STORAGE_CDN_URL,
      cdnUrl: BUNNY_STORAGE_CDN_URL,
    });

    // If we have a storage path and transcoding is configured, set it up
    if (storagePath && isCoconutConfigured() && BUNNY_STORAGE_CDN_URL) {
      try {
        // 1. Create Bunny Stream video entry (for later use)
        if (BUNNY_STREAM_LIBRARY_ID && BUNNY_STREAM_API_KEY) {
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

            // Set up preview URLs (will be available after transcoding & fetch)
            if (BUNNY_STREAM_CDN) {
              previewUrl = `${BUNNY_STREAM_CDN}/${videoData.guid}/playlist.m3u8`;
              thumbnailPath = `${BUNNY_STREAM_CDN}/${videoData.guid}/thumbnail.jpg`;
            }
          }
        }

        // 2. Trigger Coconut transcoding
        const sourceUrl = `${BUNNY_STORAGE_CDN_URL}/${storagePath}`;
        const outputPath = `/${title}_web.mp4`;

        // Build webhook URL with bunny video ID for later processing
        const baseUrl = VERCEL_URL 
          ? `https://${VERCEL_URL}`
          : 'https://shotflow-eight.vercel.app';
        const webhookUrl = `${baseUrl}/api/webhooks/coconut?bunnyVideoId=${bunnyVideoId || ''}`;

        const job = await createTranscodeJob(sourceUrl, outputPath, webhookUrl);

        transcodeJobId = job.id;
        console.log('Coconut transcode job created:', job.id);
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
      transcoding: transcodeJobId ? {
        jobId: transcodeJobId,
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
