import { NextRequest, NextResponse } from "next/server";
import { generateSignedUploadUrl } from "@/lib/bunny";
import { authenticateRequest, requireInternal } from "@/lib/auth";

const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_STORAGE_PASSWORD = process.env.BUNNY_STORAGE_PASSWORD;
const BUNNY_STORAGE_CDN_URL = process.env.BUNNY_STORAGE_CDN_URL;

export async function POST(request: NextRequest) {
  try {
    // Debug: log cookies received
    const cookies = request.cookies.getAll();
    console.log("[prepare-upload] Cookies received:", cookies.map(c => c.name));
    
    // Auth: internal team only
    const auth = await authenticateRequest(request);
    console.log("[prepare-upload] Auth result:", auth.error ? "FAILED" : `OK - ${auth.user?.email}`);
    if (auth.error) return auth.error;
    const roleCheck = requireInternal(auth.user);
    if (roleCheck) return roleCheck;

    const { shotId, projectCode, shotCode, filename, sortOrder } = await request.json();

    if (!shotId || !projectCode || !shotCode || !filename) {
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

    // Generate storage path: /PROJECT/SHOT/plates/filename
    const ext = filename.split(".").pop() || "mov";
    const baseName = filename.replace(/\.[^/.]+$/, "");
    const timestamp = Date.now();
    const storagePath = `/${projectCode}/${shotCode}/plates/${baseName}_${timestamp}.${ext}`;

    return NextResponse.json({
      uploadUrl: generateSignedUploadUrl(storagePath),
      storagePath,
      cdnUrl: `${BUNNY_STORAGE_CDN_URL}${storagePath}`,
    });
  } catch (error) {
    console.error("Prepare plate upload error:", error);
    return NextResponse.json(
      { error: "Failed to prepare upload" },
      { status: 500 }
    );
  }
}
