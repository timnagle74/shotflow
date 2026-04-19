import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireUploader, getServiceClient } from '@/lib/auth';
import { isS3Configured, getPresignedUploadUrl, getVersionStorageKey } from '@/lib/s3';

interface PrepareUploadPayload {
  shotId: string;
  versionNumber: number;
  description?: string;
  filename: string;
}

/**
 * POST /api/versions/prepare-upload
 * Creates a version record and returns presigned URL for direct browser upload to S3/MinIO.
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

    if (!isS3Configured()) {
      return NextResponse.json(
        { error: 'S3 storage not configured' },
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

    // Compute the real next version number from DB instead of trusting client.
    // Avoids unique-constraint collisions when previous attempts left orphan rows.
    const { data: latest } = await supabase
      .from('shot_versions')
      .select('version_number')
      .eq('shot_id', shotId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    const effectiveVersionNumber = (latest?.version_number ?? 0) + 1;
    const versionStr = `v${String(effectiveVersionNumber).padStart(3, '0')}`;

    // Generate S3 storage key and presigned upload URL
    const storageKey = getVersionStorageKey(projectCode, shotCode, effectiveVersionNumber, filename);
    const videoTitle = `${projectName}_${shotCode}_${versionStr}`;

    // Get content type from filename
    const ext = filename.split('.').pop()?.toLowerCase() || 'mov';
    const contentTypeMap: Record<string, string> = {
      'mov': 'video/quicktime',
      'mp4': 'video/mp4',
      'mxf': 'application/mxf',
      'exr': 'image/x-exr',
      'dpx': 'image/x-dpx',
    };
    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    const { url: presignedUrl, key } = await getPresignedUploadUrl(storageKey, contentType, 7200);

    // Create version record in shot_versions table
    const { data: version, error: versionError } = await supabase
      .from('shot_versions')
      .insert({
        shot_id: shotId,
        version_number: effectiveVersionNumber,
        version_code: versionStr,
        submitted_by_id: createdById,
        status: 'wip',
        filename: filename,
        storage_path: storageKey, // S3 key for downloads
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
        version_number: effectiveVersionNumber,
        created_by_id: createdById,
        status: 'WIP',
        description: description || null,
        download_url: storageKey, // S3 key for downloads
      })
      .single();

    return NextResponse.json({
      version,
      storageUpload: {
        url: presignedUrl,
        key: storageKey,
        contentType, // Client MUST send this exact Content-Type in PUT or SigV4 rejects
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
