import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireInternal, getServiceClient } from '@/lib/auth';
import { matchToSourceMedia } from '@/lib/source-media-importer';
import type { SourceMedia } from '@/lib/source-media.types';

/**
 * POST /api/shots/match-source-media
 * 
 * Matches shots to source_media records by clip name / timecode.
 * Call after importing ALEs or shots to auto-link them.
 * 
 * Body: { projectId: string }
 * Returns: { matched: number, unmatched: number, errors: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    // Auth: internal team only
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const roleCheck = requireInternal(auth.user);
    if (roleCheck) return roleCheck;

    const supabase = getServiceClient();
    const { projectId } = await request.json();
    
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    // Get all sequences for this project
    const { data: sequences, error: seqError } = await supabase
      .from('sequences')
      .select('id')
      .eq('project_id', projectId);
    
    if (seqError) {
      return NextResponse.json({ error: seqError.message }, { status: 500 });
    }
    
    if (!sequences || sequences.length === 0) {
      return NextResponse.json({ matched: 0, unmatched: 0, message: 'No sequences found' });
    }

    const sequenceIds = sequences.map(s => s.id);

    // Get all shots for these sequences that don't have source_media_id set
    // Include shots that have source_clip_name or source_tc_in for matching
    const { data: shots, error: shotError } = await supabase
      .from('shots')
      .select('id, code, source_clip_name, source_tc_in, source_media_id, sequence_id')
      .in('sequence_id', sequenceIds)
      .is('source_media_id', null);
    
    if (shotError) {
      return NextResponse.json({ error: shotError.message }, { status: 500 });
    }
    
    if (!shots || shots.length === 0) {
      return NextResponse.json({ matched: 0, unmatched: 0, message: 'No unlinked shots found' });
    }

    // Get all source_media for this project
    const { data: sourceMedia, error: smError } = await supabase
      .from('source_media')
      .select('*')
      .eq('project_id', projectId);
    
    if (smError) {
      return NextResponse.json({ error: smError.message }, { status: 500 });
    }
    
    if (!sourceMedia || sourceMedia.length === 0) {
      return NextResponse.json({ 
        matched: 0, 
        unmatched: shots.length, 
        message: 'No source media to match against' 
      });
    }

    // Match each shot
    let matched = 0;
    let unmatched = 0;
    const errors: string[] = [];
    const updates: { id: string; source_media_id: string }[] = [];

    for (const shot of shots) {
      // Try to match by source_clip_name first
      const clipName = shot.source_clip_name || shot.code;
      const tcIn = shot.source_tc_in;
      
      // Parse timecode to frames if available
      let tcInFrames: number | null = null;
      if (tcIn) {
        tcInFrames = parseTimecodeToFrames(tcIn);
      }
      
      const match = matchToSourceMedia(
        clipName,
        tcIn,
        tcInFrames,
        sourceMedia as SourceMedia[]
      );
      
      if (match) {
        updates.push({ id: shot.id, source_media_id: match.id });
        matched++;
      } else {
        unmatched++;
      }
    }

    // Batch update all matched shots
    if (updates.length > 0) {
      // Supabase doesn't support batch updates with different values,
      // so we need to do individual updates (or use RPC)
      // For now, batch in smaller groups
      const BATCH_SIZE = 50;
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        
        // Use Promise.all for concurrent updates
        const results = await Promise.all(
          batch.map(u => 
            supabase
              .from('shots')
              .update({ source_media_id: u.source_media_id })
              .eq('id', u.id)
          )
        );
        
        // Check for errors
        for (const result of results) {
          if (result.error) {
            errors.push(result.error.message);
          }
        }
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      matched,
      unmatched,
      total: shots.length,
      sourceMediaCount: sourceMedia.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Match source media error:', error);
    return NextResponse.json(
      { error: 'Failed to match source media', details: String(error) },
      { status: 500 }
    );
  }
}

function parseTimecodeToFrames(tc: string, fps: number = 24): number {
  const parts = tc.split(/[:;]/).map(Number);
  if (parts.length !== 4) return 0;
  const [hh, mm, ss, ff] = parts;
  if ([hh, mm, ss, ff].some(isNaN)) return 0;
  return hh * 3600 * fps + mm * 60 * fps + ss * fps + ff;
}
