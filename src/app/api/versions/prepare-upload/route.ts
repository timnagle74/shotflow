import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { authenticateRequest, requireUploader, getServiceClient } from '@/lib/auth';

const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY;
const BUNNY_STREAM_CDN = process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN;

// Generate TUS upload signature for Bunny Stream
function generateTusSignature(libraryId: string, apiKey: string, videoId: string, expiresAt: number): string {
  const signatureData = `${libraryId}${apiKey}${expiresAt}${videoId}`;
  return createHash('sha256').update(signatureData).digest('hex');
}

interface PrepareUploadPayload {
  shotId: string;
  versionNumber: number;
  description?: string;
  filename: string;
}

/**
 * POST /api/versions/prepare-upload
 * Creates a version record and returns TUS upload credentials for direct browser upload to Bunny Stream.
 * No file data passes through Vercel - uploads go directly to Bunny.
 */
export async function POST(request: NextRequest) {
  try {
    // Auth: internal team members and VFX vendors can upload versions
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const roleCheck = requireUploader(auth.user);
    if (roleCheck) return roleCheck;

    const body: PrepareUploadPayload = await request.json();
    const { shotId, versionNumber, description, filename } = body;
    const createdById = auth.user.userId;

    if (!shotId || !versionNumber || !filename) {
      return NextResponse.json(
        { error: 'Missing required fields: shotId, versionNumber, filename' },
        { status: 400 }
      );
    }

    if (!BUNNY_STREAM_LIBRARY_ID || !BUNNY_STREAM_API_KEY) {
      return NextResponse.json(
        { error: 'Bunny Stream not configured' },
        { status: 500 }
      );
    }

    const supabase = getServiceClient();

    // Get shot info for naming
    const { data: shot, error: shotError } = await supabase
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

    const sequenceData = shot.sequence as unknown as { code: string; project: { code: string; name: string } };
    const projectName = sequenceData.project.name;
    const shotCode = shot.code;
    const versionStr = `v${String(versionNumber).padStart(3, '0')}`;

    // Create Bunny Stream video entry
    const videoTitle = `${projectName}_${shotCode}_${versionStr}`;
    const createRes = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos`,
      {
        method: 'POST',
        headers: {
          'AccessKey': BUNNY_STREAM_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: videoTitle }),
      }
    );

    if (!createRes.ok) {
      const errorText = await createRes.text();
      console.error('Bunny Stream create error:', errorText);
      return NextResponse.json(
        { error: 'Failed to create video entry in Bunny Stream' },
        { status: 500 }
      );
    }

    const videoData = await createRes.json();
    const videoId = videoData.guid;

    // Generate TUS upload credentials
    const expiresAt = Math.floor(Date.now() / 1000) + 7200; // 2 hours for large files
    const authSignature = generateTusSignature(BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_API_KEY, videoId, expiresAt);

    // Create version record in shot_versions table (primary table for versions)
    const previewUrl = BUNNY_STREAM_CDN ? `${BUNNY_STREAM_CDN}/${videoId}/playlist.m3u8` : null;
    
    const { data: version, error: versionError } = await supabase
      .from('shot_versions')
      .insert({
        shot_id: shotId,
        version_number: versionNumber,
        version_code: versionStr,
        submitted_by_id: createdById,
        status: 'wip',
        filename: filename,
        video_id: videoId,
        preview_url: previewUrl,
        submitted_at: new Date().toISOString(),
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
      version,
      tusUpload: {
        url: 'https://video.bunnycdn.com/tusupload',
        authSignature,
        libraryId: BUNNY_STREAM_LIBRARY_ID,
        videoId,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Prepare upload error:', error);
    return NextResponse.json(
      { error: 'Failed to prepare upload', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
