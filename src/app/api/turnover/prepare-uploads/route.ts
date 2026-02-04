import { NextRequest, NextResponse } from "next/server";
import { generateSignedUploadUrl } from "@/lib/bunny";
import { authenticateRequest, requireInternal, getServiceClient } from "@/lib/auth";

const BUNNY_STORAGE_CDN_URL = process.env.BUNNY_STORAGE_CDN_URL;

export async function POST(request: NextRequest) {
  try {
    // Auth: internal team only
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const roleCheck = requireInternal(auth.user);
    if (roleCheck) return roleCheck;

    const { projectId, files } = await request.json();

    if (!projectId || !files || !Array.isArray(files)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Get project code
    const { data: project } = await supabase
      .from("projects")
      .select("code")
      .eq("id", projectId)
      .single();

    const projectCode = project?.code || "PROJ";

    if (!BUNNY_STORAGE_ZONE || !BUNNY_STORAGE_PASSWORD) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    const uploadConfigs = files.map((file: { name: string; type: 'ref' | 'plate' }) => {
      const timestamp = Date.now() + Math.random().toString(36).slice(2, 7);
      const ext = file.name.split(".").pop() || "mov";
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const folder = file.type === 'ref' ? 'refs' : 'plates';
      const storagePath = `/${projectCode}/turnover/${folder}/${baseName}_${timestamp}.${ext}`;

      return {
        originalName: file.name,
        type: file.type,
        uploadUrl: generateSignedUploadUrl(storagePath),
        storagePath,
        cdnUrl: `${BUNNY_STORAGE_CDN_URL}${storagePath}`,
      };
    });

    return NextResponse.json({ uploads: uploadConfigs });
  } catch (error) {
    console.error("Prepare uploads error:", error);
    return NextResponse.json({ error: "Failed to prepare uploads" }, { status: 500 });
  }
}
