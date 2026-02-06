import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { authenticateRequest, requireInternal, getServiceClient } from "@/lib/auth";

const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY;
const BUNNY_STREAM_CDN = process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN;

// Generate TUS upload signature for Bunny Stream
function generateTusSignature(libraryId: string, apiKey: string, videoId: string, expiresAt: number): string {
  const signatureData = `${libraryId}${apiKey}${expiresAt}${videoId}`;
  return createHash('sha256').update(signatureData).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    // Auth: internal team only
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const roleCheck = requireInternal(auth.user);
    if (roleCheck) return roleCheck;

    const { shotId, projectCode, shotCode, filename, description, sortOrder } = await request.json();

    if (!shotId || !projectCode || !shotCode || !filename) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Check if it's a video file
    const isVideo = /\.(mov|mp4|mxf|m4v)$/i.test(filename);
    
    let videoId: string | null = null;
    let previewUrl: string | null = null;
    let tusUpload: { url: string; authSignature: string; libraryId: string; videoId: string; expiresAt: number } | null = null;

    // For video files, create Bunny Stream entry and get TUS credentials
    if (isVideo && BUNNY_STREAM_LIBRARY_ID && BUNNY_STREAM_API_KEY) {
      try {
        const title = `plate_${shotCode}_${filename.replace(/\.[^/.]+$/, "")}`;
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
          
          // Generate TUS upload credentials (direct browser upload)
          if (videoId) {
            const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour
            const authSignature = generateTusSignature(BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_API_KEY, videoId, expiresAt);
            tusUpload = {
              url: `https://video.bunnycdn.com/tusupload`,
              authSignature,
              libraryId: BUNNY_STREAM_LIBRARY_ID,
              videoId,
              expiresAt,
            };
          }
        } else {
          console.error("Failed to create Bunny Stream video:", await createRes.text());
        }
      } catch (err) {
        console.error("Failed to create stream entry:", err);
      }
    }

    if (isVideo && !tusUpload) {
      return NextResponse.json(
        { error: "Failed to prepare video upload - Bunny Stream not configured or error" },
        { status: 500 }
      );
    }

    // For non-video files, we'd need a different approach (proxy or presigned)
    // For now, only support video uploads
    if (!isVideo) {
      return NextResponse.json(
        { error: "Only video files (MOV, MP4, MXF, M4V) are supported for plate uploads currently" },
        { status: 400 }
      );
    }

    // Create plate record in database
    const { data: plateData, error: plateError } = await supabase
      .from("shot_plates")
      .insert({
        shot_id: shotId,
        filename,
        description: description || null,
        video_id: videoId,
        preview_url: previewUrl,
        file_size: 0, // Will be updated after upload if needed
        sort_order: sortOrder || 0,
      })
      .select()
      .single();

    if (plateError) {
      console.error("Plate insert error:", plateError);
      return NextResponse.json({ error: "Failed to create plate record" }, { status: 500 });
    }

    return NextResponse.json({
      plate: {
        id: plateData.id,
        shot_id: plateData.shot_id,
        filename: plateData.filename,
        preview_url: plateData.preview_url,
      },
      tusUpload,
      videoId,
    });
  } catch (error) {
    console.error("Prepare plate upload error:", error);
    return NextResponse.json(
      { error: "Failed to prepare upload" },
      { status: 500 }
    );
  }
}
