import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireInternal } from "@/lib/auth";

// Route segment config for App Router
export const maxDuration = 60; // seconds
export const dynamic = "force-dynamic";

const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_STORAGE_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
const BUNNY_STORAGE_PASSWORD = process.env.BUNNY_STORAGE_PASSWORD;
const BUNNY_STORAGE_CDN_URL = process.env.BUNNY_STORAGE_CDN_URL;
const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY;

/**
 * PUT /api/turnover/upload-file?path=/some/storage/path&videoId=xxx
 * 
 * Proxies file upload to Bunny Storage with proper AccessKey authentication.
 * If videoId is provided, triggers Bunny Stream fetch for transcoding after upload.
 */
export async function PUT(request: NextRequest) {
  try {
    // Auth: internal team only
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const roleCheck = requireInternal(auth.user);
    if (roleCheck) return roleCheck;

    const storagePath = request.nextUrl.searchParams.get("path");
    const videoId = request.nextUrl.searchParams.get("videoId");
    
    if (!storagePath) {
      return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
    }

    if (!BUNNY_STORAGE_ZONE || !BUNNY_STORAGE_PASSWORD) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    // Forward the file body to Bunny Storage with AccessKey
    const bunnyUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}${storagePath.startsWith('/') ? '' : '/'}${storagePath}`;
    
    const body = await request.arrayBuffer();
    
    const bunnyRes = await fetch(bunnyUrl, {
      method: "PUT",
      headers: {
        "AccessKey": BUNNY_STORAGE_PASSWORD,
        "Content-Type": "application/octet-stream",
      },
      body: body,
    });

    if (!bunnyRes.ok) {
      const errorText = await bunnyRes.text();
      console.error(`Bunny Storage upload failed: ${bunnyRes.status} ${errorText}`);
      return NextResponse.json(
        { error: "Storage upload failed", status: bunnyRes.status },
        { status: 502 }
      );
    }

    // If videoId provided, trigger Bunny Stream to fetch and transcode
    if (videoId && BUNNY_STREAM_LIBRARY_ID && BUNNY_STREAM_API_KEY && BUNNY_STORAGE_CDN_URL) {
      try {
        const sourceUrl = `${BUNNY_STORAGE_CDN_URL}${storagePath}`;
        const fetchRes = await fetch(
          `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}/fetch`,
          {
            method: 'POST',
            headers: {
              'AccessKey': BUNNY_STREAM_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: sourceUrl }),
          }
        );
        
        if (!fetchRes.ok) {
          console.error(`Bunny Stream fetch failed: ${fetchRes.status}`);
        }
      } catch (err) {
        console.error("Failed to trigger Bunny Stream fetch:", err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Upload file proxy error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
