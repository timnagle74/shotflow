import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const body = await request.json();
    const { versionId, comment, authorName, timecodeFrame } = body;

    if (!versionId || !comment || !authorName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify session
    const { data: session } = await supabase
      .from("review_sessions")
      .select("id, allow_comments, expires_at")
      .eq("access_token", token)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: "Session expired" }, { status: 404 });
    }

    if (!session.allow_comments) {
      return NextResponse.json({ error: "Comments not allowed" }, { status: 403 });
    }

    // SECURITY: Verify that the versionId belongs to this review session
    const { data: sessionVersion, error: svError } = await supabase
      .from("review_session_versions")
      .select("id")
      .eq("session_id", session.id)
      .eq("version_id", versionId)
      .single();

    if (svError || !sessionVersion) {
      return NextResponse.json(
        { error: "Version not found in this review session" },
        { status: 403 }
      );
    }

    // Create comment
    const { data: newComment, error: insertError } = await supabase
      .from("version_comments")
      .insert({
        version_id: versionId,
        session_id: session.id,
        comment_text: comment,
        author_name: authorName,
        timecode_frame: timecodeFrame || null,
        is_client_comment: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
    }

    return NextResponse.json({ comment: newComment });

  } catch (error) {
    console.error("Comment error:", error);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}
