import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireInternal, getServiceClient } from "@/lib/auth";

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

// Find all shot codes that appear in a filename (flexible matching for leading zeros)
function findMatchingShotCodes(filename: string, shotCodes: string[]): string[] {
  const lowerFilename = filename.toLowerCase();
  return shotCodes.filter(code => {
    const lowerCode = code.toLowerCase();
    // Strategy 1: direct include
    if (lowerFilename.includes(lowerCode)) return true;
    // Strategy 2: strip leading zeros from scene part (004_0060 → 4_0060)
    const normalized = lowerCode.replace(/^0+/, '');
    if (lowerFilename.includes(normalized)) return true;
    // Strategy 3: check if code matches pattern in filename with flexible leading zeros
    const codeMatch = lowerCode.match(/^(\d+)_(\d+)$/);
    if (codeMatch) {
      const [, scene, seq] = codeMatch;
      const pattern = new RegExp(`0*${parseInt(scene)}_0*${parseInt(seq)}`, 'i');
      if (pattern.test(lowerFilename)) return true;
    }
    return false;
  });
}

export async function POST(request: NextRequest) {
  try {
    // Auth: internal team only (ADMIN, SUPERVISOR, PRODUCER, COORDINATOR, VFX_EDITOR, ARTIST)
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const roleCheck = requireInternal(auth.user);
    if (roleCheck) return roleCheck;

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

    const supabase = getServiceClient();

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

    // Create turnover atomically using RPC (prevents race conditions on turnover_number)
    const { data: turnoverResult, error: turnoverRpcError } = await supabase
      .rpc("create_turnover_atomic", {
        p_project_id: projectId,
        p_sequence_id: finalSequenceId || null,
        p_title: sequenceName || sequenceCode || null,
        p_general_notes: generalVfxNotes || null,
        p_source_edl_filename: sourceEdlFilename || null,
        p_status: 'draft',
      });

    if (turnoverRpcError || !turnoverResult || turnoverResult.length === 0) {
      console.error("Turnover create error:", turnoverRpcError);
      return NextResponse.json({ error: "Failed to create turnover" }, { status: 500 });
    }

    const turnover = turnoverResult[0];
    const nextToNumber = turnover.turnover_number;

    // Create shots using upsert (ON CONFLICT on sequence_id + code)
    // This handles concurrent imports without failing on duplicates
    const createdShots: any[] = [];
    const turnoverShotLinks: any[] = [];
    const shotCodeToId: Record<string, string> = {};
    const shotCodeToTurnoverShotId: Record<string, string> = {};
    
    // Batch upsert all shots at once (single query instead of N+1)
    const shotInserts = shots.map((shot: any) => ({
      sequence_id: finalSequenceId,
      code: shot.code,
      description: shot.vfxNotes || shot.clipName || null,
      notes: shot.vfxNotes || null,
      status: "NOT_STARTED" as const,
      complexity: "MEDIUM" as const,
      frame_start: shot.durationFrames ? 0 : (shot.sourceIn ? parseTimecodeToFrames(shot.sourceIn) : null),
      frame_end: shot.durationFrames || (shot.sourceOut ? parseTimecodeToFrames(shot.sourceOut) : null),
      record_frame_in: shot.recordIn ? parseTimecodeToFrames(shot.recordIn) : null,
      record_frame_out: shot.recordOut ? parseTimecodeToFrames(shot.recordOut) : (shot.recordIn && shot.durationFrames ? parseTimecodeToFrames(shot.recordIn) + shot.durationFrames : null),
      source_clip_name: shot.clipName || null,
      source_tc_in: shot.sourceIn || null,
      source_tc_out: shot.sourceOut || null,
      record_tc_in: shot.recordIn || null,
      record_tc_out: shot.recordOut || null,
      has_reposition: shot.hasReposition || false,
      repo_scale: shot.transform?.scale || null,
      repo_scale_x: shot.transform?.scaleX || null,
      repo_scale_y: shot.transform?.scaleY || null,
      repo_position_x: shot.transform?.positionX || null,
      repo_position_y: shot.transform?.positionY || null,
      repo_rotation: shot.transform?.rotation || null,
      has_speed_change: shot.hasSpeedChange || false,
      speed_ratio: shot.speed?.speedRatio || null,
      speed_reverse: shot.speed?.reverse || false,
      speed_time_remap: shot.speed?.timeRemapping || false,
    }));

    // Use upsert with onConflict to handle existing shots gracefully
    const { data: upsertedShots, error: upsertError } = await supabase
      .from("shots")
      .upsert(shotInserts, {
        onConflict: "sequence_id,code",
        ignoreDuplicates: true, // Don't overwrite existing shots
      })
      .select("id, code");

    if (upsertError) {
      console.error("Shot upsert error:", upsertError);
      // Fall back: fetch existing shots by code
    }

    // Build shot code map — first from upsert results
    if (upsertedShots) {
      for (const s of upsertedShots) {
        shotCodeToId[s.code] = s.id;
        createdShots.push(s);
      }
    }

    // For any shots not returned by upsert (already existed with ignoreDuplicates),
    // fetch them in a single query
    const missingShotCodes = shots
      .map(s => s.code)
      .filter(code => !shotCodeToId[code]);

    if (missingShotCodes.length > 0) {
      const { data: existingShots } = await supabase
        .from("shots")
        .select("id, code")
        .eq("sequence_id", finalSequenceId)
        .in("code", missingShotCodes);

      if (existingShots) {
        for (const s of existingShots) {
          shotCodeToId[s.code] = s.id;
          createdShots.push({ id: s.id, code: s.code, existing: true });
        }
      }
    }

    // Build turnover_shot links for all shots we have IDs for
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const shotId = shotCodeToId[shot.code];
      if (!shotId) continue; // Skip if shot wasn't created/found

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

    // Insert all turnover_shot links with conflict handling (UNIQUE on turnover_id, shot_id)
    let turnoverShotIds: string[] = [];
    if (turnoverShotLinks.length > 0) {
      const { data: insertedLinks, error: linkError } = await supabase
        .from("turnover_shots")
        .upsert(turnoverShotLinks, {
          onConflict: "turnover_id,shot_id",
          ignoreDuplicates: true,
        })
        .select("id, shot_id");
      
      if (linkError) {
        console.error("Turnover shots link error:", linkError);
      } else if (insertedLinks) {
        turnoverShotIds = insertedLinks.map(l => l.id);
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

    // Process refs
    for (let i = 0; i < refFiles.length; i++) {
      const ref = refFiles[i];
      
      let refPreviewUrl: string | null = null;
      let refVideoId: string | null = null;

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

      const matchedCodes = findMatchingShotCodes(ref.originalName, allShotCodes);
      const hasMatches = matchedCodes.length > 0;

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
            
            await supabase
              .from("turnover_shots")
              .update({ refs_assigned: true })
              .in("id", refShotLinks.map(l => l.turnover_shot_id));
            
            for (const code of matchedCodes) {
              const shotId = shotCodeToId[code];
              if (shotId) {
                await supabase
                  .from("shots")
                  .update({
                    ref_filename: ref.originalName,
                    ref_storage_path: ref.storagePath,
                    ref_cdn_url: ref.cdnUrl,
                    ref_video_id: refVideoId,
                    ref_preview_url: refPreviewUrl,
                  })
                  .eq("id", shotId);
              }
            }
          }
        }
      }
    }

    const shotCodeToVfxNotes: Record<string, string | null> = {};
    for (const shot of shots) {
      shotCodeToVfxNotes[shot.code] = shot.vfxNotes || null;
    }

    // Process plates
    for (let i = 0; i < plateFiles.length; i++) {
      const plate = plateFiles[i];
      
      const matchedCodes = findMatchingShotCodes(plate.originalName, allShotCodes);
      const matchedCode = matchedCodes[0];
      const matchedShotId = matchedCode ? shotCodeToId[matchedCode] : null;

      if (!matchedShotId) {
        console.log(`Plate ${plate.originalName} didn't match any shot codes`);
        continue;
      }
      
      const plateDescription = matchedCode ? shotCodeToVfxNotes[matchedCode] : null;

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
          description: plateDescription,
        });

      if (!plateError) {
        platesCreated++;
        platesMatched++;
        
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
