import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// GET /api/versions/[id]/annotations - List annotations for a version
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: versionId } = await params;
    const supabase = await createServerSupabaseClient();

    // Note: frame_annotations table needs migration applied
    const { data: annotations, error } = await (supabase as any)
      .from("frame_annotations")
      .select("*")
      .eq("version_id", versionId)
      .order("frame_number", { ascending: true });

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

// POST /api/versions/[id]/annotations - Create an annotation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: versionId } = await params;
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { frame_number, timecode, drawing_data, comment } = body;

    if (typeof frame_number !== "number" || !drawing_data) {
      return NextResponse.json(
        { error: "frame_number and drawing_data are required" },
        { status: 400 }
      );
    }

    // Note: frame_annotations table needs migration applied
    const { data: annotation, error } = await (supabase as any)
      .from("frame_annotations")
      .insert({
        version_id: versionId,
        frame_number,
        timecode,
        drawing_data,
        comment,
        author_id: user.id,
      })
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
