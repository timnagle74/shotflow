import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireUploader, getServiceClient } from '@/lib/auth';
import { generateSignedUploadUrl, isStorageConfigured } from '@/lib/bunny';

interface PrepareUploadPayload {
  shotId: string;
  versionNumber: number;
  description?: string;
  filename: string;
}

/**
 * POST /api/versions/prepare-upload
 * Creates a version record and returns signed URL for direct browser upload to Bunny Storage.
 * After upload completes, client calls /api/versions/finalize to trigger Stream transcoding.
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

    if (!isStorageConfigured()) {
      return NextResponse.json(
        { error: 'Bunny Storage not configured' },
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
    const projectCode = sequenceData.project.code;
    const projectName = sequenceData.project.name;
    const shotCode = shot.code;
    const versionStr = `v${String(versionNumber).padStart(3, '0')}`;

    // Build storage path and video title
    const ext = filename.split('.').pop() || 'mov';
    const storagePath = `/${projectCode}/${shotCode}/${versionStr}/${shotCode}_${versionStr}.${ext}`;
    const videoTitle = `${projectName}_${shotCode}_${versionStr}`;

    // Generate signed upload URL (valid for 2 hours)
    const signedUploadUrl = generateSignedUploadUrl(storagePath, 7200);

    // Create version record in shot_versions table
    const { data: version, error: versionError } = await supabase
      .from('shot_versions')
      .insert({
        shot_id: shotId,
        version_number: versionNumber,
        version_code: versionStr,
        submitted_by_id: createdById,
        status: 'wip',
        filename: filename,
        storage_path: storagePath, // Path for generating signed download URLs
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

    // Also insert into legacy versions table (notes table has FK to this)
    await supabase
      .from('versions')
      .insert({
        id: version.id, // Use same ID so notes work
        shot_id: shotId,
        version_number: versionNumber,
        created_by_id: createdById,
        status: 'WIP',
        description: description || null,
        download_url: storagePath,
      })
      .single();

    return NextResponse.json({
      version,
      storageUpload: {
        url: signedUploadUrl,
        path: storagePath,
      },
      videoTitle, // Pass to finalize for Stream naming
    });
  } catch (error) {
    console.error('Prepare upload error:', error);
    return NextResponse.json(
      { error: 'Failed to prepare upload', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
