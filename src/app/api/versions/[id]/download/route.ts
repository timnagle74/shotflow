import { NextRequest, NextResponse } from 'next/server';
import { generateSignedStorageUrl } from '@/lib/bunny';
import { authenticateRequest, getServiceClient } from '@/lib/auth';

/**
 * GET /api/versions/[id]/download
 * Generate a signed download URL for the ProRes file
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
    let downloadPath: string | null = null;

    // Check shot_versions table
    const { data: shotVersion } = await supabaseAdmin
      .from('shot_versions')
      .select('id, storage_path, cdn_url')
      .eq('id', id)
      .single();

    if (shotVersion?.storage_path) {
      downloadPath = shotVersion.storage_path;
    } else if (shotVersion?.cdn_url) {
      // If cdn_url is a full URL, return it directly
      return NextResponse.json({
        downloadUrl: shotVersion.cdn_url,
        expiresIn: null,
      });
    }

    // Fallback to versions table
    if (!downloadPath) {
      const { data: version } = await supabaseAdmin
        .from('versions')
        .select('id, download_url')
        .eq('id', id)
        .single();

      if (version?.download_url) {
        downloadPath = version.download_url;
      }
    }

    if (!downloadPath) {
      return NextResponse.json(
        { error: 'No download file available for this version' },
        { status: 404 }
      );
    }

    // Generate signed URL (valid for 1 hour)
    const signedUrl = generateSignedStorageUrl(downloadPath, {
      expiresIn: 3600,
      directDownload: true,
    });

    return NextResponse.json({
      downloadUrl: signedUrl,
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
