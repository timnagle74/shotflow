import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStreamPlaybackUrl } from "@/lib/bunny";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Save ref to shot (AE's context clip)
export async function POST(request: NextRequest) {
  try {
    const { shotId, filename, storagePath, cdnUrl, streamVideoId } =
      await request.json();

    if (!shotId || !filename || !storagePath) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build preview URL if we have a stream video
    const previewUrl = streamVideoId ? getStreamPlaybackUrl(streamVideoId) : null;

    const { data, error } = await supabase
      .from("shots")
      .update({
        ref_filename: filename,
        ref_storage_path: storagePath,
        ref_cdn_url: cdnUrl || null,
        ref_video_id: streamVideoId || null,
        ref_preview_url: previewUrl,
      })
      .eq("id", shotId)
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to save ref" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Save ref error:", error);
    return NextResponse.json(
      { error: "Failed to save ref" },
      { status: 500 }
    );
  }
}
