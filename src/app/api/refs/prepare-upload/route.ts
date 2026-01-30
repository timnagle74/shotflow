import { NextRequest, NextResponse } from "next/server";
import { bunnyConfig, createStreamVideo } from "@/lib/bunny";

export async function POST(request: NextRequest) {
  try {
    const { shotId, projectCode, shotCode, filename, type } = await request.json();

    // type: "shot" for AE's context clip, "version" for artist's context clip
    if (!shotId || !projectCode || !shotCode || !filename || !type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { zone, hostname, password, cdnUrl } = bunnyConfig.storage;

    if (!zone || !password) {
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
    
    const uploadUrl = `https://${hostname}/${zone}${storagePath}`;

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
      uploadUrl,
      accessKey: password,
      storagePath,
      cdnUrl: `${cdnUrl}${storagePath}`,
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
