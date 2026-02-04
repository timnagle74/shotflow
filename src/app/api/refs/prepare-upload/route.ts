import { NextRequest, NextResponse } from "next/server";
import { createStreamVideo, generateSignedUploadUrl } from "@/lib/bunny";
import { authenticateRequest, requireInternal } from "@/lib/auth";

const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_STORAGE_PASSWORD = process.env.BUNNY_STORAGE_PASSWORD;
const BUNNY_STORAGE_CDN_URL = process.env.BUNNY_STORAGE_CDN_URL;

export async function POST(request: NextRequest) {
  try {
    // Auth: internal team only
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const roleCheck = requireInternal(auth.user);
    if (roleCheck) return roleCheck;

    const { shotId, projectCode, shotCode, filename, type } = await request.json();

    // type: "shot" for AE's context clip, "version" for artist's context clip
    if (!shotId || !projectCode || !shotCode || !filename || !type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!BUNNY_STORAGE_ZONE || !BUNNY_STORAGE_PASSWORD) {
      return NextResponse.json(
        { error: "Storage not configured" },
        { status: 500 }
      );
    }

    // Generate storage path
    const ext = filename.split(".").pop() || "mov";
    const baseName = filename.replace(/\.[^/.]+$/, "");
    const timestamp = Date.now();
    const storagePath = `/${projectCode}/${shotCode}/refs/${type}_${baseName}_${timestamp}.${ext}`;

    // Create Bunny Stream video entry for HLS playback
    let streamVideoId: string | null = null;
    try {
      const title = `${projectCode}_${shotCode}_${type}_ref`;
      const { guid } = await createStreamVideo(title);
      streamVideoId = guid;
    } catch (err) {
      console.warn("Failed to create stream video:", err);
      // Continue without stream - download will still work
    }

    return NextResponse.json({
      uploadUrl: generateSignedUploadUrl(storagePath),
      storagePath,
      cdnUrl: `${BUNNY_STORAGE_CDN_URL}${storagePath}`,
      streamVideoId,
    });
  } catch (error) {
    console.error("Prepare ref upload error:", error);
    return NextResponse.json(
      { error: "Failed to prepare upload" },
      { status: 500 }
    );
  }
}
