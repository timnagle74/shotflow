import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface UploadedFile {
  originalName: string;
  type: 'ref' | 'plate';
  storagePath: string;
  cdnUrl: string;
  fileSize?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      projectId,
      sequenceId,
      sequenceName,
      sequenceCode,
      shots,
      uploadedFiles,
    } = body as {
      projectId: string;
      sequenceId?: string;
      sequenceName?: string;
      sequenceCode?: string;
      shots: Array<{
        code: string;
        clipName?: string;
        sourceIn?: string;
        sourceOut?: string;
        recordIn?: string;
        recordOut?: string;
        durationFrames?: number;
      }>;
      uploadedFiles: UploadedFile[];
    };
    
    if (!projectId || !shots) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Process uploaded refs
    const refFiles = (uploadedFiles || []).filter(f => f.type === 'ref');
    for (const ref of refFiles) {
      // Match to shot by filename or use first shot
      const matchedShot = createdShots.find(s => 
        ref.originalName.toLowerCase().includes(s.code.toLowerCase())
      ) || createdShots[0];

      if (!matchedShot) continue;

      await supabase
        .from("shots")
        .update({
          ref_filename: ref.originalName,
          ref_storage_path: ref.storagePath,
          ref_cdn_url: ref.cdnUrl,
        })
        .eq("id", matchedShot.id);
    }

    // Process uploaded plates
    const plateFiles = (uploadedFiles || []).filter(f => f.type === 'plate');
    for (let i = 0; i < plateFiles.length; i++) {
      const plate = plateFiles[i];
      
      // Match to shot by filename or use first shot
      const matchedShot = createdShots.find(s => 
        plate.originalName.toLowerCase().includes(s.code.toLowerCase())
      ) || createdShots[0];

      if (!matchedShot) continue;

      await supabase
        .from("shot_plates")
        .insert({
          shot_id: matchedShot.id,
          filename: plate.originalName,
          storage_path: plate.storagePath,
          cdn_url: plate.cdnUrl,
          file_size: plate.fileSize || null,
          sort_order: i,
        });
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
