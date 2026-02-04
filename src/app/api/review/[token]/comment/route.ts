import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, validateReviewToken } from "@/lib/auth";

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

    // Validate token via centralized auth helper (requires comments)
    const tokenResult = await validateReviewToken(token, { requireComments: true });
    if (tokenResult.error) return tokenResult.error;

    const supabase = getServiceClient();

    // SECURITY: Verify that the versionId belongs to this review session
    const { data: sessionVersion, error: svError } = await supabase
      .from("review_session_versions")
      .select("id")
      .eq("session_id", tokenResult.session.id)
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
        session_id: tokenResult.session.id,
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
