import { NextRequest, NextResponse } from "next/server";
import { bunnyConfig } from "@/lib/bunny";

export async function POST(request: NextRequest) {
  try {
    const { shotId, projectCode, shotCode, filename, sortOrder } = await request.json();

    if (!shotId || !projectCode || !shotCode || !filename) {
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

    // Generate storage path: /PROJECT/SHOT/plates/filename
    const ext = filename.split(".").pop() || "mov";
    const baseName = filename.replace(/\.[^/.]+$/, "");
    const timestamp = Date.now();
    const storagePath = `/${projectCode}/${shotCode}/plates/${baseName}_${timestamp}.${ext}`;
    
    const uploadUrl = `https://${hostname}/${zone}${storagePath}`;

    return NextResponse.json({
      uploadUrl,
      accessKey: password,
      storagePath,
      cdnUrl: `${cdnUrl}${storagePath}`,
    });
  } catch (error) {
    console.error("Prepare plate upload error:", error);
    return NextResponse.json(
      { error: "Failed to prepare upload" },
      { status: 500 }
    );
  }
}
