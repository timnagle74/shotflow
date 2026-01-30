import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createTranscodeJob, isCoconutConfigured } from "@/lib/coconut";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUNNY_STORAGE_CDN_URL = process.env.BUNNY_STORAGE_CDN_URL;
const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY;
const BUNNY_STREAM_CDN = process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN;
// Use production URL for webhooks, not preview deployments
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'https://shotflow-eight.vercel.app';

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

    // Process uploaded refs - create Bunny Stream entry + trigger transcoding
    const refFiles = (uploadedFiles || []).filter(f => f.type === 'ref');
    for (const ref of refFiles) {
      // Match to shot by filename or use first shot
      const matchedShot = createdShots.find(s => 
        ref.originalName.toLowerCase().includes(s.code.toLowerCase())
      ) || createdShots[0];

      if (!matchedShot) continue;

      let refPreviewUrl: string | null = null;
      let refVideoId: string | null = null;

      // Create Bunny Stream video entry for HLS playback
      if (BUNNY_STREAM_LIBRARY_ID && BUNNY_STREAM_API_KEY) {
        try {
          const title = `${matchedShot.code}_ref`;
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

            // Trigger Coconut transcoding
            if (isCoconutConfigured() && BUNNY_STORAGE_CDN_URL && ref.storagePath) {
              try {
                const sourceUrl = `${BUNNY_STORAGE_CDN_URL}${ref.storagePath}`;
                const outputPath = `/${matchedShot.code}_ref_web.mp4`;
                
                const webhookUrl = `${WEBHOOK_BASE_URL}/api/webhooks/coconut?bunnyVideoId=${refVideoId}&type=ref&shotId=${matchedShot.id}`;

                const job = await createTranscodeJob(sourceUrl, outputPath, webhookUrl);
                console.log('Ref transcode job created:', job.id, 'for shot:', matchedShot.code);
              } catch (transcodeError) {
                console.error('Ref transcoding setup failed:', transcodeError);
              }
            }
          }
        } catch (err) {
          console.error('Failed to create Bunny Stream entry for ref:', err);
        }
      }

      await supabase
        .from("shots")
        .update({
          ref_filename: ref.originalName,
          ref_storage_path: ref.storagePath,
          ref_cdn_url: ref.cdnUrl,
          ref_video_id: refVideoId,
          ref_preview_url: refPreviewUrl,
        })
        .eq("id", matchedShot.id);

      // Create Version 0 (turnover) with ref as the preview
      // This represents the original turnover element from editorial
      await supabase
        .from("versions")
        .insert({
          shot_id: matchedShot.id,
          version_number: 0,
          created_by_id: null, // System/turnover
          status: "WIP",
          description: "Turnover from editorial",
          preview_url: refPreviewUrl,
          download_url: ref.storagePath,
          bunny_video_id: refVideoId,
          // Store ref info on version too for the toggle
          ref_filename: ref.originalName,
          ref_storage_path: ref.storagePath,
          ref_cdn_url: ref.cdnUrl,
          ref_video_id: refVideoId,
          ref_preview_url: refPreviewUrl,
        });
    }

    // Process uploaded plates - create Bunny Stream entry + trigger transcoding
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

      // Create Bunny Stream video entry for HLS playback
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

            // Trigger Coconut transcoding
            if (isCoconutConfigured() && BUNNY_STORAGE_CDN_URL && plate.storagePath) {
              try {
                const sourceUrl = `${BUNNY_STORAGE_CDN_URL}${plate.storagePath}`;
                const outputPath = `/${matchedShot.code}_plate_${i}_web.mp4`;
                
                const webhookUrl = `${WEBHOOK_BASE_URL}/api/webhooks/coconut?bunnyVideoId=${plateVideoId}&type=plate`;

                const job = await createTranscodeJob(sourceUrl, outputPath, webhookUrl);
                console.log('Plate transcode job created:', job.id, 'for shot:', matchedShot.code);
              } catch (transcodeError) {
                console.error('Plate transcoding setup failed:', transcodeError);
              }
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
