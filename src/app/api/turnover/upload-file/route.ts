import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireInternal } from "@/lib/auth";

// Allow up to 100MB uploads (Vercel Pro limit)
export const config = {
  api: {
    bodyParser: false,
  },
};

export const maxDuration = 60; // seconds

const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_STORAGE_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
const BUNNY_STORAGE_PASSWORD = process.env.BUNNY_STORAGE_PASSWORD;

/**
 * PUT /api/turnover/upload-file?path=/some/storage/path
 * 
 * Proxies file upload to Bunny Storage with proper AccessKey authentication.
 * Client sends raw file body, server forwards to Bunny with credentials.
 */
export async function PUT(request: NextRequest) {
  try {
    // Auth: internal team only
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const roleCheck = requireInternal(auth.user);
    if (roleCheck) return roleCheck;

    const storagePath = request.nextUrl.searchParams.get("path");
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Upload file proxy error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
