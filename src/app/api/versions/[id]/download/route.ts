import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateSignedStorageUrl } from '@/lib/bunny';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/versions/[id]/download
 * Generate a signed download URL for the ProRes file
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get version with download path
    const { data: version, error } = await supabaseAdmin
      .from('versions')
      .select('id, download_url, shot:shots!inner(code)')
      .eq('id', id)
      .single();

    if (error || !version) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    if (!version.download_url) {
      return NextResponse.json(
        { error: 'No download file available for this version' },
        { status: 404 }
      );
    }

    // Generate signed URL (valid for 1 hour)
    const signedUrl = generateSignedStorageUrl(version.download_url, {
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
