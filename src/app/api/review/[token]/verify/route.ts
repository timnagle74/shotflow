import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const { password } = await request.json();
    
    const supabase = getServiceClient();
    
    const { data: session, error } = await supabase
      .from("review_sessions")
      .select("id, password_hash")
      .eq("access_token", token)
      .single();
      
    if (error || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    
    if (!session.password_hash) {
      // No password required
      return NextResponse.json({ valid: true });
    }
    
    const valid = await bcrypt.compare(password, session.password_hash);
    
    if (!valid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
    
    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("Password verify error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}

// Check if password is required
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    
    const supabase = getServiceClient();
    
    const { data: session, error } = await supabase
      .from("review_sessions")
      .select("id, password_hash, name")
      .eq("access_token", token)
      .single();
      
    if (error || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    
    return NextResponse.json({ 
      requiresPassword: !!session.password_hash,
      sessionName: session.name
    });
  } catch (error) {
    console.error("Password check error:", error);
    return NextResponse.json({ error: "Check failed" }, { status: 500 });
  }
}
