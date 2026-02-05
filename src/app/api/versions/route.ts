import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// GET /api/versions - List versions (with optional filters)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    
    const hasVideo = searchParams.get("hasVideo") === "true";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const shotId = searchParams.get("shotId");

    let query = supabase
      .from("versions")
      .select(`
        id,
        version_number,
        status,
        bunny_video_id,
        created_at,
        shot:shots (
          id,
          shot_code,
          sequence:sequences (
            id,
            code
          )
        )
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (hasVideo) {
      query = query.not("bunny_video_id", "is", null);
    }

    if (shotId) {
      query = query.eq("shot_id", shotId);
    }

    const { data: versions, error } = await query;

    if (error) {
      console.error("Error fetching versions:", error);
      return NextResponse.json(
        { error: "Failed to fetch versions" },
        { status: 500 }
      );
    }

    return NextResponse.json(versions);
  } catch (error) {
    console.error("Error in GET /versions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
