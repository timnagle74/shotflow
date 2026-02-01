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

// Find all shot codes that appear in a filename
function findMatchingShotCodes(filename: string, shotCodes: string[]): string[] {
  const lowerFilename = filename.toLowerCase();
  return shotCodes.filter(code => lowerFilename.includes(code.toLowerCase()));
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
      
      // Check if sequence with this code already exists for this project
      const { data: existingSeq } = await supabase
        .from("sequences")
        .select("id")
        .eq("project_id", projectId)
        .eq("code", code)
        .single();
      
      if (existingSeq) {
        // Reuse existing sequence
        finalSequenceId = existingSeq.id;
      } else {
        // Create new sequence
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

    // Create turnover record with draft status
    const { data: turnover, error: turnoverError } = await supabase
      .from("turnovers")
      .insert({
        project_id: projectId,
        sequence_id: finalSequenceId,
        turnover_number: nextToNumber,
        title: sequenceName || sequenceCode || `Turnover ${nextToNumber}`,
        general_notes: generalVfxNotes || null,
        source_edl_filename: sourceEdlFilename || null,
        status: 'draft', // New: starts as draft, moves to 'reviewed' after AE review
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
    const shotCodeToId: Record<string, string> = {};
    const shotCodeToTurnoverShotId: Record<string, string> = {};
    
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
        shotId = existingShot.id;
        createdShots.push({ id: shotId, code: shot.code, existing: true });
      } else {
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

      shotCodeToId[shot.code] = shotId;

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
        plates_assigned: false,
        refs_assigned: false,
        notes_complete: false,
      });
    }

    // Insert all turnover_shot links and get their IDs
    let turnoverShotIds: string[] = [];
    if (turnoverShotLinks.length > 0) {
      const { data: insertedLinks, error: linkError } = await supabase
        .from("turnover_shots")
        .insert(turnoverShotLinks)
        .select("id, shot_id");
      
      if (linkError) {
        console.error("Turnover shots link error:", linkError);
      } else if (insertedLinks) {
        turnoverShotIds = insertedLinks.map(l => l.id);
        // Map shot_id to turnover_shot_id for ref matching
        for (const link of insertedLinks) {
          const shotCode = Object.keys(shotCodeToId).find(code => shotCodeToId[code] === link.shot_id);
          if (shotCode) {
            shotCodeToTurnoverShotId[shotCode] = link.id;
          }
        }
      }
    }

    const allShotCodes = shots.map(s => s.code);
    const refFiles = (uploadedFiles || []).filter(f => f.type === 'ref');
    const plateFiles = (uploadedFiles || []).filter(f => f.type === 'plate');
    
    let refsCreated = 0;
    let refsMatched = 0;
    let platesCreated = 0;
    let platesMatched = 0;

    // Process refs - store in turnover_refs table, auto-match to shots
    for (let i = 0; i < refFiles.length; i++) {
      const ref = refFiles[i];
      
      let refPreviewUrl: string | null = null;
      let refVideoId: string | null = null;

      // Create Bunny Stream video entry for HLS playback
      if (BUNNY_STREAM_LIBRARY_ID && BUNNY_STREAM_API_KEY) {
        try {
          const title = `TO${nextToNumber}_ref_${ref.originalName.replace(/\.[^/.]+$/, "")}`;
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

      // Find matching shot codes in filename
      const matchedCodes = findMatchingShotCodes(ref.originalName, allShotCodes);
      const hasMatches = matchedCodes.length > 0;

      // Insert ref into turnover_refs
      const { data: newRef, error: refError } = await supabase
        .from("turnover_refs")
        .insert({
          turnover_id: turnover.id,
          filename: ref.originalName,
          storage_path: ref.storagePath,
          cdn_url: ref.cdnUrl,
          file_size: ref.fileSize || null,
          video_id: refVideoId,
          preview_url: refPreviewUrl,
          auto_matched: hasMatches,
          sort_order: i,
        })
        .select()
        .single();

      if (refError) {
        console.error("Ref insert error:", refError);
        continue;
      }

      refsCreated++;

      // Create junction entries for matched shots
      if (hasMatches && newRef) {
        const refShotLinks = matchedCodes
          .filter(code => shotCodeToTurnoverShotId[code])
          .map(code => ({
            turnover_shot_id: shotCodeToTurnoverShotId[code],
            turnover_ref_id: newRef.id,
            auto_matched: true,
          }));

        if (refShotLinks.length > 0) {
          const { error: junctionError } = await supabase
            .from("turnover_shot_refs")
            .insert(refShotLinks);
          
          if (!junctionError) {
            refsMatched += refShotLinks.length;
            
            // Update refs_assigned status on matched turnover_shots
            await supabase
              .from("turnover_shots")
              .update({ refs_assigned: true })
              .in("id", refShotLinks.map(l => l.turnover_shot_id));
          }
        }
      }
    }

    // Process plates - match to specific shots by filename
    for (let i = 0; i < plateFiles.length; i++) {
      const plate = plateFiles[i];
      
      // Find matching shot by filename
      const matchedCodes = findMatchingShotCodes(plate.originalName, allShotCodes);
      const matchedCode = matchedCodes[0]; // Plates go to first match (many-to-one)
      const matchedShotId = matchedCode ? shotCodeToId[matchedCode] : null;

      if (!matchedShotId) {
        // No match found - still create plate but unassigned
        console.log(`Plate ${plate.originalName} didn't match any shot codes`);
        continue;
      }

      let platePreviewUrl: string | null = null;
      let plateVideoId: string | null = null;

      if (BUNNY_STREAM_LIBRARY_ID && BUNNY_STREAM_API_KEY) {
        try {
          const baseName = plate.originalName.replace(/\.[^/.]+$/, "");
          const title = `${matchedCode}_plate_${baseName}`;
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

      const { error: plateError } = await supabase
        .from("shot_plates")
        .insert({
          shot_id: matchedShotId,
          filename: plate.originalName,
          storage_path: plate.storagePath,
          cdn_url: plate.cdnUrl,
          file_size: plate.fileSize || null,
          sort_order: i,
          video_id: plateVideoId,
          preview_url: platePreviewUrl,
        });

      if (!plateError) {
        platesCreated++;
        platesMatched++;
        
        // Update plates_assigned status
        const turnoverShotId = shotCodeToTurnoverShotId[matchedCode];
        if (turnoverShotId) {
          await supabase
            .from("turnover_shots")
            .update({ plates_assigned: true })
            .eq("id", turnoverShotId);
        }
      }
    }

    return NextResponse.json({
      success: true,
      turnoverId: turnover.id,
      turnoverNumber: nextToNumber,
      sequenceId: finalSequenceId,
      status: 'draft',
      shotsCreated: createdShots.filter(s => !s.existing).length,
      shotsLinked: createdShots.filter(s => s.existing).length,
      shots: createdShots,
      refs: { created: refsCreated, matched: refsMatched },
      plates: { created: platesCreated, matched: platesMatched },
      // Redirect to review page
      reviewUrl: `/turnover/${turnover.id}/review`,
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
