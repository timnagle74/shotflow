import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { bunnyConfig } from "@/lib/bunny";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const projectId = formData.get("projectId") as string;
    const sequenceId = formData.get("sequenceId") as string | null;
    const sequenceName = formData.get("sequenceName") as string | null;
    const sequenceCode = formData.get("sequenceCode") as string | null;
    const shotsJson = formData.get("shots") as string;
    
    if (!projectId || !shotsJson) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const shots = JSON.parse(shotsJson) as Array<{
      code: string;
      clipName?: string;
      sourceIn?: string;
      sourceOut?: string;
      recordIn?: string;
      recordOut?: string;
      durationFrames?: number;
    }>;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get project code for storage paths
    const { data: project } = await supabase
      .from("projects")
      .select("code")
      .eq("id", projectId)
      .single();

    const projectCode = project?.code || "PROJ";

    // Create or get sequence
    let finalSequenceId = sequenceId;
    if (!sequenceId || sequenceId === "new") {
      const code = sequenceCode || `SEQ_${Date.now()}`;
      const name = sequenceName || code;
      
      const { data: newSeq, error: seqError } = await supabase
        .from("sequences")
        .insert({ project_id: projectId, code, name, sort_order: 0 })
        .select()
        .single();

      if (seqError) {
        console.error("Sequence create error:", seqError);
        return NextResponse.json({ error: "Failed to create sequence" }, { status: 500 });
      }
      finalSequenceId = newSeq.id;
    }

    // Create shots
    const createdShots: any[] = [];
    for (const shot of shots) {
      const { data: newShot, error: shotError } = await supabase
        .from("shots")
        .insert({
          sequence_id: finalSequenceId,
          code: shot.code,
          description: shot.clipName || null,
          status: "NOT_STARTED",
          complexity: "MEDIUM",
          frame_start: shot.sourceIn ? parseTimecodeToFrames(shot.sourceIn) : null,
          frame_end: shot.sourceOut ? parseTimecodeToFrames(shot.sourceOut) : null,
        })
        .select()
        .single();

      if (shotError) {
        console.error("Shot create error:", shotError);
        continue;
      }
      createdShots.push(newShot);
    }

    // Upload ref files
    const refFiles = formData.getAll("refs") as File[];
    const { zone, hostname, password, cdnUrl } = bunnyConfig.storage;

    for (const refFile of refFiles) {
      if (!refFile.name || refFile.size === 0) continue;

      // Try to match ref to a shot by filename
      const matchedShot = createdShots.find(s => 
        refFile.name.toLowerCase().includes(s.code.toLowerCase())
      ) || createdShots[0]; // Default to first shot if no match

      if (!matchedShot) continue;

      const timestamp = Date.now();
      const ext = refFile.name.split(".").pop() || "mov";
      const storagePath = `/${projectCode}/${matchedShot.code}/refs/ref_${timestamp}.${ext}`;
      const uploadUrl = `https://${hostname}/${zone}${storagePath}`;

      // Upload to Bunny Storage
      const arrayBuffer = await refFile.arrayBuffer();
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "AccessKey": password,
          "Content-Type": "application/octet-stream",
        },
        body: new Uint8Array(arrayBuffer),
      });

      if (uploadResponse.ok || uploadResponse.status === 201) {
        // Update shot with ref
        await supabase
          .from("shots")
          .update({
            ref_filename: refFile.name,
            ref_storage_path: storagePath,
            ref_cdn_url: `${cdnUrl}${storagePath}`,
          })
          .eq("id", matchedShot.id);
      }
    }

    // Upload plate files
    const plateFiles = formData.getAll("plates") as File[];
    
    for (const plateFile of plateFiles) {
      if (!plateFile.name || plateFile.size === 0) continue;

      // Try to match plate to a shot by filename, or assign to first shot
      const matchedShot = createdShots.find(s => 
        plateFile.name.toLowerCase().includes(s.code.toLowerCase())
      ) || createdShots[0];

      if (!matchedShot) continue;

      const timestamp = Date.now();
      const ext = plateFile.name.split(".").pop() || "mov";
      const storagePath = `/${projectCode}/${matchedShot.code}/plates/${plateFile.name.replace(/\.[^/.]+$/, "")}_${timestamp}.${ext}`;
      const uploadUrl = `https://${hostname}/${zone}${storagePath}`;

      // Upload to Bunny Storage
      const arrayBuffer = await plateFile.arrayBuffer();
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "AccessKey": password,
          "Content-Type": "application/octet-stream",
        },
        body: new Uint8Array(arrayBuffer),
      });

      if (uploadResponse.ok || uploadResponse.status === 201) {
        // Create plate record
        await supabase
          .from("shot_plates")
          .insert({
            shot_id: matchedShot.id,
            filename: plateFile.name,
            storage_path: storagePath,
            cdn_url: `${cdnUrl}${storagePath}`,
            file_size: plateFile.size,
            sort_order: 0,
          });
      }
    }

    return NextResponse.json({
      success: true,
      sequenceId: finalSequenceId,
      shotsCreated: createdShots.length,
      shots: createdShots,
    });
  } catch (error) {
    console.error("Turnover import error:", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}

function parseTimecodeToFrames(tc: string, fps: number = 24): number {
  const parts = tc.split(/[:;]/).map(Number);
  if (parts.length !== 4) return 0;
  const [hh, mm, ss, ff] = parts;
  return hh * 3600 * fps + mm * 60 * fps + ss * fps + ff;
}
