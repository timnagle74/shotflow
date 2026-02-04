import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { authenticateRequest, requireInternal, getServiceClient } from "@/lib/auth";

const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_STORAGE_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME || "storage.bunnycdn.com";
const BUNNY_STORAGE_PASSWORD = process.env.BUNNY_STORAGE_PASSWORD;
const BUNNY_STORAGE_CDN_URL = process.env.BUNNY_STORAGE_CDN_URL;
const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY;
const BUNNY_STREAM_CDN = process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN;

/**
 * Generate a signed upload URL for Bunny Storage (no raw key exposed).
 */
function generateSignedUploadUrl(storagePath: string, expiresIn = 3600): string {
  const expiry = Math.floor(Date.now() / 1000) + expiresIn;
  const fullUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}${storagePath}`;
  const signatureBase = BUNNY_STORAGE_PASSWORD + storagePath + expiry;
  const token = crypto
    .createHash("sha256")
    .update(signatureBase)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return `${fullUrl}?token=${token}&expires=${expiry}`;
}

export async function POST(request: NextRequest) {
  try {
    // Auth: internal team only
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const roleCheck = requireInternal(auth.user);
    if (roleCheck) return roleCheck;

    const body = await request.json();
    const { turnoverId, projectId, type, shotId, filename, fileSize } = body as {
      turnoverId: string;
      projectId: string;
      type: 'ref' | 'plate';
      shotId?: string; // Only for plates
      filename: string;
      fileSize: number;
    };

    if (!turnoverId || !projectId || !type || !filename) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (type === 'plate' && !shotId) {
      return NextResponse.json({ error: "Shot ID required for plates" }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Generate storage path
    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `/${projectId}/turnovers/${turnoverId}/${type}s/${timestamp}_${safeName}`;
    
    // Prepare signed Bunny upload URL (no raw key exposed)
    const uploadUrl = generateSignedUploadUrl(storagePath);
    const cdnUrl = `${BUNNY_STORAGE_CDN_URL}${storagePath}`;

    if (type === 'ref') {
      // Create ref record in database
      let previewUrl: string | null = null;
      let videoId: string | null = null;

      // Create Bunny Stream entry for HLS
      if (BUNNY_STREAM_LIBRARY_ID && BUNNY_STREAM_API_KEY) {
        try {
          const title = `ref_${filename.replace(/\.[^/.]+$/, "")}`;
          const createRes = await fetch(
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

          if (createRes.ok) {
            const videoData = await createRes.json();
            videoId = videoData.guid;
            if (BUNNY_STREAM_CDN) {
              previewUrl = `${BUNNY_STREAM_CDN}/${videoData.guid}/playlist.m3u8`;
            }
          }
        } catch (err) {
          console.error("Failed to create stream entry:", err);
        }
      }

      const { data: refData, error: refError } = await supabase
        .from("turnover_refs")
        .insert({
          turnover_id: turnoverId,
          filename,
          storage_path: storagePath,
          cdn_url: cdnUrl,
          file_size: fileSize,
          video_id: videoId,
          preview_url: previewUrl,
          auto_matched: false,
          sort_order: 0,
        })
        .select()
        .single();

      if (refError) {
        console.error("Ref insert error:", refError);
        return NextResponse.json({ error: "Failed to create ref record" }, { status: 500 });
      }

      return NextResponse.json({
        uploadUrl,
        ref: {
          id: refData.id,
          filename: refData.filename,
          cdn_url: refData.cdn_url,
          preview_url: refData.preview_url,
          auto_matched: false,
        },
        videoId,
      });

    } else {
      // Plate upload
      let previewUrl: string | null = null;
      let videoId: string | null = null;

      // Create Bunny Stream entry for video plates
      const isVideo = /\.(mov|mp4|mxf|m4v)$/i.test(filename);
      if (isVideo && BUNNY_STREAM_LIBRARY_ID && BUNNY_STREAM_API_KEY) {
        try {
          const title = `plate_${filename.replace(/\.[^/.]+$/, "")}`;
          const createRes = await fetch(
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

          if (createRes.ok) {
            const videoData = await createRes.json();
            videoId = videoData.guid;
            if (BUNNY_STREAM_CDN) {
              previewUrl = `${BUNNY_STREAM_CDN}/${videoData.guid}/playlist.m3u8`;
            }
          }
        } catch (err) {
          console.error("Failed to create stream entry:", err);
        }
      }

      const { data: plateData, error: plateError } = await supabase
        .from("shot_plates")
        .insert({
          shot_id: shotId,
          filename,
          storage_path: storagePath,
          cdn_url: cdnUrl,
          file_size: fileSize,
          video_id: videoId,
          preview_url: previewUrl,
          sort_order: 0,
        })
        .select()
        .single();

      if (plateError) {
        console.error("Plate insert error:", plateError);
        return NextResponse.json({ error: "Failed to create plate record" }, { status: 500 });
      }

      return NextResponse.json({
        uploadUrl,
        plate: {
          id: plateData.id,
          shot_id: plateData.shot_id,
          filename: plateData.filename,
          cdn_url: plateData.cdn_url,
          preview_url: plateData.preview_url,
        },
        videoId,
      });
    }

  } catch (error) {
    console.error("Upload media error:", error);
    return NextResponse.json({ error: "Upload preparation failed" }, { status: 500 });
  }
}
