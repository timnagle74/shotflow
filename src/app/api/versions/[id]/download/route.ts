import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, getServiceClient } from '@/lib/auth';
import { getPresignedDownloadUrl, isS3Configured } from '@/lib/s3';

/**
 * GET /api/versions/[id]/download
 * Generate a presigned download URL for the original file
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth: any authenticated user can download (clients may need downloads too)
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;

    const { id } = params;
    const supabaseAdmin = getServiceClient();
    
    // Try shot_versions first (primary table), fallback to versions (legacy)
    let storageKey: string | null = null;
    let filename: string | null = null;

    // Check shot_versions table
    const { data: shotVersion } = await supabaseAdmin
      .from('shot_versions')
      .select('id, storage_path, filename')
      .eq('id', id)
      .single();

    if (shotVersion?.storage_path) {
      storageKey = shotVersion.storage_path;
      filename = shotVersion.filename;
    }

    // Fallback to versions table
    if (!storageKey) {
      const { data: version } = await supabaseAdmin
        .from('versions')
        .select('id, download_url')
        .eq('id', id)
        .single();

      if (version?.download_url) {
        storageKey = version.download_url;
      }
    }

    if (!storageKey) {
      return NextResponse.json(
        { error: 'No download file available for this version' },
        { status: 404 }
      );
    }

    if (!isS3Configured()) {
      return NextResponse.json(
        { error: 'S3 storage not configured' },
        { status: 500 }
      );
    }

    // Generate presigned URL (valid for 1 hour)
    const downloadUrl = await getPresignedDownloadUrl(storageKey, 3600, filename || undefined);

    return NextResponse.json({
      downloadUrl,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error('Download URL generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate download URL' },
      { status: 500 }
    );
  }
}
