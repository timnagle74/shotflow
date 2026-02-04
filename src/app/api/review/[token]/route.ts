import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, validateReviewToken } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    // Validate token via centralized auth helper
    const tokenResult = await validateReviewToken(token);
    if (tokenResult.error) return tokenResult.error;

    const supabase = getServiceClient();

    // Get full session details
    const { data: session, error: sessionError } = await supabase
      .from("review_sessions")
      .select(`
        id, name, description, allow_comments, allow_approvals, watermark_text, expires_at,
        project:projects(id, name)
      `)
      .eq("id", tokenResult.session.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Get versions in this session
    const { data: sessionVersions } = await supabase
      .from("review_session_versions")
      .select(`
        id, client_status, client_notes, sort_order,
        version:shot_versions(
          id, version_code, preview_url, status,
          shot:shots(code, description)
        )
      `)
      .eq("session_id", session.id)
      .order("sort_order");

    // Flatten versions
    const versions = (sessionVersions || []).map((sv: any) => ({
      id: sv.version?.id,
      version_code: sv.version?.version_code,
      preview_url: sv.version?.preview_url,
      status: sv.version?.status,
      client_status: sv.client_status,
      client_notes: sv.client_notes,
      shot: sv.version?.shot,
    })).filter((v: any) => v.id);

    // Get comments for all versions
    const versionIds = versions.map((v: any) => v.id);
    let comments: any[] = [];
    
    if (versionIds.length > 0) {
      const { data: commentsData } = await supabase
        .from("version_comments")
        .select("id, version_id, comment_text, timecode_frame, author_name, is_client_comment, created_at")
        .in("version_id", versionIds)
        .order("created_at", { ascending: true });
      
      comments = commentsData || [];
    }

    return NextResponse.json({
      session: {
        ...session,
        versions,
      },
      comments,
    });

  } catch (error) {
    console.error("Review session error:", error);
    return NextResponse.json({ error: "Failed to load session" }, { status: 500 });
  }
}
