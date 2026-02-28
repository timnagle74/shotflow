import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireUploader, getServiceClient } from '@/lib/auth';

const BUNNY_STREAM_CDN = process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN;

interface FinalizeUploadPayload {
  versionId: string;
  videoId: string;
}

/**
 * POST /api/versions/finalize
 * Finalizes version after TUS upload completes.
 * Updates version record with thumbnail URL.
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const roleCheck = requireUploader(auth.user);
    if (roleCheck) return roleCheck;

    const body: FinalizeUploadPayload = await request.json();
    const { versionId, videoId } = body;

    if (!versionId || !videoId) {
      return NextResponse.json(
        { error: 'Missing required fields: versionId, videoId' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Update version in shot_versions table
    const { data: version, error: updateError } = await supabase
      .from('shot_versions')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', versionId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update version:', updateError);
      return NextResponse.json(
        { error: 'Failed to update version', details: updateError.message },
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
