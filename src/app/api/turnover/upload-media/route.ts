import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_STORAGE_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME;
const BUNNY_STORAGE_PASSWORD = process.env.BUNNY_STORAGE_PASSWORD;
const BUNNY_STORAGE_CDN_URL = process.env.BUNNY_STORAGE_CDN_URL;
const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY;
const BUNNY_STREAM_CDN = process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN;

export async function POST(request: NextRequest) {
  try {
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate storage path
    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `/${projectId}/turnovers/${turnoverId}/${type}s/${timestamp}_${safeName}`;
    
    // Prepare Bunny upload URL
    const uploadUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}${storagePath}`;
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

            // Trigger fetch after upload completes (will be done client-side or via webhook)
            // For now, we'll trigger it after the upload URL is used
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

      // Trigger Bunny Stream fetch
      if (videoId && BUNNY_STREAM_LIBRARY_ID && BUNNY_STREAM_API_KEY) {
        // Note: This runs before the upload completes, so we need to trigger it differently
        // For now, we'll return the video ID and let the client trigger the fetch after upload
      }

      return NextResponse.json({
        uploadUrl,
        accessKey: BUNNY_STORAGE_PASSWORD,
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
        accessKey: BUNNY_STORAGE_PASSWORD,
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
