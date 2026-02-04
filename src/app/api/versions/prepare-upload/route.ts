import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { authenticateRequest, requireUploader, getServiceClient } from '@/lib/auth';

const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_STORAGE_PASSWORD = process.env.BUNNY_STORAGE_PASSWORD;
const BUNNY_STORAGE_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY;

interface PrepareUploadPayload {
  shotId: string;
  versionNumber: number;
  description?: string;
  createdById?: string; // DEPRECATED: ignored, creator is derived from auth session
  hasProres: boolean;
  hasPreview: boolean;
  proresFilename?: string;
  previewFilename?: string;
}

/**
 * Generate a SHA256 HMAC-based signed URL for direct Bunny Storage upload.
 * The signature is generated server-side; the raw API key is never exposed.
 */
function generateSignedUploadUrl(storagePath: string, expiresIn = 3600): string {
  const expiry = Math.floor(Date.now() / 1000) + expiresIn;
  const fullUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${storagePath}`;
  const signatureBase = BUNNY_STORAGE_PASSWORD + storagePath + expiry;
  const token = crypto
    .createHash('sha256')
    .update(signatureBase)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `${fullUrl}?token=${token}&expires=${expiry}`;
}

/**
 * POST /api/versions/prepare-upload
 * Prepares signed upload URLs for direct browser upload to Bunny.net.
 * No raw credentials are returned to the client.
 */
export async function POST(request: NextRequest) {
  try {
    // Auth: internal team members and VFX vendors can upload versions
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const roleCheck = requireUploader(auth.user);
    if (roleCheck) return roleCheck;

    const body: PrepareUploadPayload = await request.json();
    const { shotId, versionNumber, description, hasProres, hasPreview, proresFilename, previewFilename } = body;
    // Always use the authenticated user as the creator — never trust client input
    const createdById = auth.user.userId;

    if (!shotId || !versionNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: shotId, versionNumber' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getServiceClient();

    // Get shot info for path construction
    const { data: shot, error: shotError } = await supabaseAdmin
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

    // Type assertion for nested data
    const sequenceData = shot.sequence as unknown as { code: string; project: { code: string; name: string } };
    const projectCode = sequenceData.project.code;
    const projectName = sequenceData.project.name;
    const shotCode = shot.code;
    const versionStr = `v${String(versionNumber).padStart(3, '0')}`;
    const basePath = `${projectCode}/${shotCode}/${versionStr}`;

    const result: {
      storageUpload?: {
        url: string;
        path: string;
      };
      streamUpload?: {
        libraryId: string;
        videoId: string;
        uploadUrl: string;
      };
      metadata: {
        shotId: string;
        versionNumber: number;
        description?: string;
        createdById: string;
        projectCode: string;
        shotCode: string;
        basePath: string;
      };
    } = {
      metadata: {
        shotId,
        versionNumber,
        description,
        createdById,
        projectCode,
        shotCode,
        basePath,
      },
    };

    // Prepare signed Storage upload URL for ProRes (no raw key exposed)
    if (hasProres && BUNNY_STORAGE_ZONE && BUNNY_STORAGE_PASSWORD) {
      const ext = proresFilename?.split('.').pop() || 'mov';
      const storagePath = `${basePath}/${shotCode}_${versionStr}.${ext}`;

      result.storageUpload = {
        url: generateSignedUploadUrl(storagePath),
        path: storagePath,
      };
    }

    // Create Stream video entry for preview and return a TUS upload URL
    if (hasPreview && BUNNY_STREAM_LIBRARY_ID && BUNNY_STREAM_API_KEY) {
      const title = `${projectName}_${shotCode}_${versionStr}`;
      
      // Create video entry in Bunny Stream
      const createResponse = await fetch(
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

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Bunny Stream create error:', errorText);
        return NextResponse.json(
          { error: 'Failed to create video entry in Bunny Stream' },
          { status: 500 }
        );
      }

      const videoData = await createResponse.json();
      
      // Return the TUS upload URL (no raw API key needed by client)
      result.streamUpload = {
        libraryId: BUNNY_STREAM_LIBRARY_ID,
        videoId: videoData.guid,
        uploadUrl: `https://video.bunnycdn.com/tusupload`,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Prepare upload error:', error);
    return NextResponse.json(
      { error: 'Failed to prepare upload', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
