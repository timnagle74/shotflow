import { NextRequest, NextResponse } from "next/server";
import { bunnyConfig } from "@/lib/bunny";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { projectId, files } = await request.json();

    if (!projectId || !files || !Array.isArray(files)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get project code
    const { data: project } = await supabase
      .from("projects")
      .select("code")
      .eq("id", projectId)
      .single();

    const projectCode = project?.code || "PROJ";
    const { zone, hostname, password, cdnUrl } = bunnyConfig.storage;

    if (!zone || !password) {
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
        uploadUrl: `https://${hostname}/${zone}${storagePath}`,
        accessKey: password,
        storagePath,
        cdnUrl: `${cdnUrl}${storagePath}`,
      };
    });

    return NextResponse.json({ uploads: uploadConfigs });
  } catch (error) {
    console.error("Prepare uploads error:", error);
    return NextResponse.json({ error: "Failed to prepare uploads" }, { status: 500 });
  }
}
