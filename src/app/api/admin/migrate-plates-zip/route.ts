import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireAdmin, getServiceClient } from '@/lib/auth';

/**
 * POST /api/admin/migrate-plates-zip
 * Add plates_zip_url column to turnovers table
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;
  
  const roleCheck = requireAdmin(auth.user);
  if (roleCheck) return roleCheck;

  const supabase = getServiceClient();
  
  // Use raw SQL via rpc if available, otherwise this is a manual migration
  // For now, just return instructions
  
  return NextResponse.json({
    message: 'Run this SQL in Supabase dashboard:',
    sql: `
ALTER TABLE turnovers
ADD COLUMN IF NOT EXISTS plates_zip_url TEXT,
ADD COLUMN IF NOT EXISTS plates_zip_generated_at TIMESTAMPTZ;
    `.trim(),
  });
}
