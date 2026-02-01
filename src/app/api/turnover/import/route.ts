import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUNNY_STORAGE_CDN_URL = process.env.BUNNY_STORAGE_CDN_URL;
const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY;
const BUNNY_STREAM_CDN = process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN;

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
      generalVfxNotes,
      sourceEdlFilename,
    } = body as {
      projectId: string;
      sequenceId?: string;
      sequenceName?: string;
      sequenceCode?: string;
      shots: Array<{
        code: string;
        clipName?: string;
        cameraRoll?: string;
        sourceIn?: string;
        sourceOut?: string;
        recordIn?: string;
        recordOut?: string;
        durationFrames?: number;
        vfxNotes?: string | null;
      }>;
      uploadedFiles: UploadedFile[];
      generalVfxNotes?: string | null;
      sourceEdlFilename?: string;
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
        .insert({ 
          project_id: projectId, 
          code, 
          name, 
          sort_order: 0,
        })
        .select()
        .single();

      if (seqError) {
        console.error("Sequence create error:", seqError);
        return NextResponse.json({ error: "Failed to create sequence" }, { status: 500 });
      }
      finalSequenceId = newSeq.id;
    }

    // Get next turnover number for this project
    const { data: maxTo } = await supabase
      .from("turnovers")
      .select("turnover_number")
      .eq("project_id", projectId)
      .order("turnover_number", { ascending: false })
      .limit(1)
      .single();
    
    const nextToNumber = (maxTo?.turnover_number || 0) + 1;

    // Create turnover record
    const { data: turnover, error: turnoverError } = await supabase
      .from("turnovers")
      .insert({
        project_id: projectId,
        sequence_id: finalSequenceId,
        turnover_number: nextToNumber,
        title: sequenceName || sequenceCode || `Turnover ${nextToNumber}`,
        general_notes: generalVfxNotes || null,
        source_edl_filename: sourceEdlFilename || null,
      })
      .select()
      .single();

    if (turnoverError) {
      console.error("Turnover create error:", turnoverError);
      return NextResponse.json({ error: "Failed to create turnover" }, { status: 500 });
    }

    // Create shots (or find existing ones)
    const createdShots: any[] = [];
    const turnoverShotLinks: any[] = [];
    
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      
      // Check if shot already exists in this sequence
      const { data: existingShot } = await supabase
        .from("shots")
        .select("id")
        .eq("sequence_id", finalSequenceId)
        .eq("code", shot.code)
        .single();

      let shotId: string;
      
      if (existingShot) {
        // Shot exists - just link it to this turnover
        shotId = existingShot.id;
        createdShots.push({ id: shotId, code: shot.code, existing: true });
      } else {
        // Create new shot
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
        shotId = newShot.id;
        createdShots.push(newShot);
      }

      // Create turnover_shots link with VFX notes and timecodes
      turnoverShotLinks.push({
        turnover_id: turnover.id,
        shot_id: shotId,
        vfx_notes: shot.vfxNotes || null,
        source_in: shot.sourceIn || null,
        source_out: shot.sourceOut || null,
        record_in: shot.recordIn || null,
        record_out: shot.recordOut || null,
        duration_frames: shot.durationFrames || null,
        clip_name: shot.clipName || null,
        reel_name: shot.cameraRoll || null,
        sort_order: i,
      });
    }

    // Insert all turnover_shot links
    if (turnoverShotLinks.length > 0) {
      const { error: linkError } = await supabase
        .from("turnover_shots")
        .insert(turnoverShotLinks);
      
      if (linkError) {
        console.error("Turnover shots link error:", linkError);
      }
    }

    // Process shared reference - attach to TURNOVER, not individual shots
    const refFiles = (uploadedFiles || []).filter(f => f.type === 'ref');
    if (refFiles.length > 0) {
      const ref = refFiles[0]; // Use first ref as the shared reference
      
      let refPreviewUrl: string | null = null;
      let refVideoId: string | null = null;

      // Create Bunny Stream video entry for HLS playback
      if (BUNNY_STREAM_LIBRARY_ID && BUNNY_STREAM_API_KEY) {
        try {
          const title = `TO${nextToNumber}_${turnover.title}_ref`;
          const createVideoResponse = await fetch(
            `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos`,
            {
              method: 'POST',
              headers: {
                'AccessKey': BUNNY_STREAM_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ title }),
            }
          );

          if (createVideoResponse.ok) {
            const videoData = await createVideoResponse.json();
            refVideoId = videoData.guid;
            
            if (BUNNY_STREAM_CDN) {
              refPreviewUrl = `${BUNNY_STREAM_CDN}/${videoData.guid}/playlist.m3u8`;
            }

            // Trigger fetch for transcoding
            if (BUNNY_STORAGE_CDN_URL && ref.storagePath) {
              const sourceUrl = `${BUNNY_STORAGE_CDN_URL}${ref.storagePath}`;
              await fetch(
                `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${refVideoId}/fetch`,
                {
                  method: 'POST',
                  headers: {
                    'AccessKey': BUNNY_STREAM_API_KEY,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ url: sourceUrl }),
                }
              );
            }
          }
        } catch (err) {
          console.error('Failed to create Bunny Stream entry for ref:', err);
        }
      }

      // Update turnover with ref info
      await supabase
        .from("turnovers")
        .update({
          ref_filename: ref.originalName,
          ref_storage_path: ref.storagePath,
          ref_cdn_url: ref.cdnUrl,
          ref_video_id: refVideoId,
          ref_preview_url: refPreviewUrl,
        })
        .eq("id", turnover.id);
    }

    // Process plates - match to specific shots by filename
    const plateFiles = (uploadedFiles || []).filter(f => f.type === 'plate');
    for (let i = 0; i < plateFiles.length; i++) {
      const plate = plateFiles[i];
      
      // Match to shot by filename or use first shot
      const matchedShot = createdShots.find(s => 
        plate.originalName.toLowerCase().includes(s.code.toLowerCase())
      ) || createdShots[0];

      if (!matchedShot) continue;

      let platePreviewUrl: string | null = null;
      let plateVideoId: string | null = null;

      // Create Bunny Stream video entry
      if (BUNNY_STREAM_LIBRARY_ID && BUNNY_STREAM_API_KEY) {
        try {
          const baseName = plate.originalName.replace(/\.[^/.]+$/, "");
          const title = `${matchedShot.code}_plate_${baseName}`;
          const createVideoResponse = await fetch(
            `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos`,
            {
              method: 'POST',
              headers: {
                'AccessKey': BUNNY_STREAM_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ title }),
            }
          );

          if (createVideoResponse.ok) {
            const videoData = await createVideoResponse.json();
            plateVideoId = videoData.guid;
            
            if (BUNNY_STREAM_CDN) {
              platePreviewUrl = `${BUNNY_STREAM_CDN}/${videoData.guid}/playlist.m3u8`;
            }

            // Trigger fetch
            if (BUNNY_STORAGE_CDN_URL && plate.storagePath) {
              const sourceUrl = `${BUNNY_STORAGE_CDN_URL}${plate.storagePath}`;
              await fetch(
                `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${plateVideoId}/fetch`,
                {
                  method: 'POST',
                  headers: {
                    'AccessKey': BUNNY_STREAM_API_KEY,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ url: sourceUrl }),
                }
              );
            }
          }
        } catch (err) {
          console.error('Failed to create Bunny Stream entry for plate:', err);
        }
      }

      await supabase
        .from("shot_plates")
        .insert({
          shot_id: matchedShot.id,
          filename: plate.originalName,
          storage_path: plate.storagePath,
          cdn_url: plate.cdnUrl,
          file_size: plate.fileSize || null,
          sort_order: i,
          video_id: plateVideoId,
          preview_url: platePreviewUrl,
        });
    }

    return NextResponse.json({
      success: true,
      turnoverId: turnover.id,
      turnoverNumber: nextToNumber,
      sequenceId: finalSequenceId,
      shotsCreated: createdShots.filter(s => !s.existing).length,
      shotsLinked: createdShots.filter(s => s.existing).length,
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
