import { NextRequest, NextResponse } from "next/server";
import { getStreamPlaybackUrl } from "@/lib/bunny";
import { authenticateRequest, requireInternal, getServiceClient } from "@/lib/auth";

// Save ref to shot (AE's context clip)
export async function POST(request: NextRequest) {
  try {
    // Auth: internal team only
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const roleCheck = requireInternal(auth.user);
    if (roleCheck) return roleCheck;

    const { shotId, filename, storagePath, cdnUrl, streamVideoId } =
      await request.json();

    if (!shotId || !filename || !storagePath) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

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
