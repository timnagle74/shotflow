import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// GET /api/annotations?versionId=X or refId=X or plateId=X or shotRefId=X
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    
    const versionId = searchParams.get("versionId");
    const refId = searchParams.get("refId");
    const plateId = searchParams.get("plateId");
    const shotRefId = searchParams.get("shotRefId");

    if (!versionId && !refId && !plateId && !shotRefId) {
      return NextResponse.json(
        { error: "Must provide versionId, refId, plateId, or shotRefId" },
        { status: 400 }
      );
    }

    let query = (supabase as any)
      .from("frame_annotations")
      .select("*")
      .order("frame_number", { ascending: true });

    if (versionId) {
      query = query.eq("version_id", versionId);
    } else if (refId) {
      query = query.eq("ref_id", refId);
    } else if (plateId) {
      query = query.eq("plate_id", plateId);
    } else if (shotRefId) {
      query = query.eq("shot_ref_id", shotRefId);
    }

    const { data: annotations, error } = await query;

    if (error) {
      console.error("Error fetching annotations:", error);
      return NextResponse.json(
        { error: "Failed to fetch annotations" },
        { status: 500 }
      );
    }

    return NextResponse.json(annotations || []);
  } catch (error) {
    console.error("Error in GET /annotations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/annotations - Create an annotation
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { source_type, source_id, frame_number, timecode, drawing_data, comment } = body;

    if (!source_type || !source_id || typeof frame_number !== "number" || !drawing_data) {
      return NextResponse.json(
        { error: "source_type, source_id, frame_number, and drawing_data are required" },
        { status: 400 }
      );
    }

    // Build insert object based on source type
    const insertData: Record<string, unknown> = {
      frame_number,
      timecode,
      drawing_data,
      comment,
      author_id: user.id,
    };

    if (source_type === "version") {
      insertData.version_id = source_id;
    } else if (source_type === "ref") {
      insertData.ref_id = source_id;
    } else if (source_type === "shotRef") {
      insertData.shot_ref_id = source_id;
    } else if (source_type === "plate") {
      insertData.plate_id = source_id;
    } else {
      return NextResponse.json(
        { error: "Invalid source_type. Must be 'version', 'ref', 'shotRef', or 'plate'" },
        { status: 400 }
      );
    }

    const { data: annotation, error } = await (supabase as any)
      .from("frame_annotations")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Error creating annotation:", error);
      return NextResponse.json(
        { error: "Failed to create annotation" },
        { status: 500 }
      );
    }

    return NextResponse.json(annotation, { status: 201 });
  } catch (error) {
    console.error("Error in POST /annotations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
