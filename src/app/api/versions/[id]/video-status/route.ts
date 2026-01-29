import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStreamVideo, getVideoStatusLabel, VideoStatus } from '@/lib/bunny';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/versions/[id]/video-status
 * Check the transcoding status of a Bunny Stream video
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get version with Bunny video ID
    const { data: version, error } = await supabaseAdmin
      .from('versions')
      .select('id, bunny_video_id, preview_url')
      .eq('id', id)
      .single();

    if (error || !version) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    if (!version.bunny_video_id) {
      return NextResponse.json(
        { error: 'No video associated with this version' },
        { status: 404 }
      );
    }

    // Get video status from Bunny Stream
    const videoInfo = await getStreamVideo(version.bunny_video_id);

    return NextResponse.json({
      videoId: videoInfo.videoId,
      status: videoInfo.status,
      statusLabel: getVideoStatusLabel(videoInfo.status),
      isReady: videoInfo.status === VideoStatus.FINISHED,
      length: videoInfo.length,
      thumbnailUrl: videoInfo.thumbnailUrl,
      hlsUrl: videoInfo.hlsUrl,
      embedUrl: videoInfo.embedUrl,
    });
  } catch (error) {
    console.error('Video status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check video status' },
      { status: 500 }
    );
  }
}
