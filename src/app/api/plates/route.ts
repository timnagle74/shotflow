import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { shotId, filename, description, storagePath, cdnUrl, fileSize, sortOrder } =
      await request.json();

    if (!shotId || !filename || !storagePath) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("shot_plates")
      .insert({
        shot_id: shotId,
        filename,
        description: description || null,
        storage_path: storagePath,
        cdn_url: cdnUrl || null,
        file_size: fileSize || null,
        sort_order: sortOrder || 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to save plate" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Save plate error:", error);
    return NextResponse.json(
      { error: "Failed to save plate" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shotId = searchParams.get("shotId");

    if (!shotId) {
      return NextResponse.json(
        { error: "Missing shotId" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("shot_plates")
      .select("*")
      .eq("shot_id", shotId)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch plates" },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Fetch plates error:", error);
    return NextResponse.json(
      { error: "Failed to fetch plates" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing plate id" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase
      .from("shot_plates")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to delete plate" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete plate error:", error);
    return NextResponse.json(
      { error: "Failed to delete plate" },
      { status: 500 }
    );
  }
}
