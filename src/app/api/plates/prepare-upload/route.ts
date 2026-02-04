import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { authenticateRequest, requireInternal } from "@/lib/auth";

const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_STORAGE_PASSWORD = process.env.BUNNY_STORAGE_PASSWORD;
const BUNNY_STORAGE_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME || "storage.bunnycdn.com";
const BUNNY_STORAGE_CDN_URL = process.env.BUNNY_STORAGE_CDN_URL;

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
