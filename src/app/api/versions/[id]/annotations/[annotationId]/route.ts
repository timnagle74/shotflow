import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// DELETE /api/versions/[id]/annotations/[annotationId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; annotationId: string }> }
) {
  try {
    const { annotationId } = await params;
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete (RLS will ensure only author can delete)
    // Note: frame_annotations table needs migration applied
    const { error } = await (supabase as any)
      .from("frame_annotations")
      .delete()
      .eq("id", annotationId);

    if (error) {
      console.error("Error deleting annotation:", error);
      return NextResponse.json(
        { error: "Failed to delete annotation" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /annotations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/versions/[id]/annotations/[annotationId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; annotationId: string }> }
) {
  try {
    const { annotationId } = await params;
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { drawing_data, comment } = body;

    const updateData: Record<string, unknown> = {};
    if (drawing_data !== undefined) updateData.drawing_data = drawing_data;
    if (comment !== undefined) updateData.comment = comment;

    // Note: frame_annotations table needs migration applied
    const { data: annotation, error } = await (supabase as any)
      .from("frame_annotations")
      .update(updateData)
      .eq("id", annotationId)
      .select()
      .single();

    if (error) {
      console.error("Error updating annotation:", error);
      return NextResponse.json(
        { error: "Failed to update annotation" },
        { status: 500 }
      );
    }

    return NextResponse.json(annotation);
  } catch (error) {
    console.error("Error in PATCH /annotations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
