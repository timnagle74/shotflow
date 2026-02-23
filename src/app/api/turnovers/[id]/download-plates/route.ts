import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, getServiceClient } from '@/lib/auth';
import { generateSignedStorageUrl } from '@/lib/bunny';

// Return signed URLs for client-side download (avoids serverless timeout)
export const maxDuration = 30;

/**
 * GET /api/turnovers/[id]/download-plates
 * Returns signed download URLs for all plates in a turnover
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const supabaseAdmin = getServiceClient();

    // Get turnover
    const { data: turnover, error: turnoverError } = await supabaseAdmin
      .from('turnovers')
      .select(`
        id,
        title,
        turnover_number,
        project:projects(code),
        sequence:sequences(code)
      `)
      .eq('id', id)
      .single();

    if (turnoverError || !turnover) {
      console.error('[download-plates] Turnover not found:', turnoverError);
      return NextResponse.json({ error: 'Turnover not found' }, { status: 404 });
    }

    // Get all shots in this turnover
    const { data: turnoverShots, error: shotsError } = await supabaseAdmin
      .from('turnover_shots')
      .select(`id, shot:shots!inner(id, code)`)
      .eq('turnover_id', id);

    if (shotsError || !turnoverShots?.length) {
      return NextResponse.json({ error: 'No shots in this turnover' }, { status: 404 });
    }

    const shotIds = turnoverShots.map((ts: any) => ts.shot.id);
    const shotCodeMap = new Map<string, string>();
    turnoverShots.forEach((ts: any) => shotCodeMap.set(ts.shot.id, ts.shot.code));

    // Get all plates
    const { data: plates, error: platesError } = await supabaseAdmin
      .from('shot_plates')
      .select('id, shot_id, filename, storage_path, cdn_url')
      .in('shot_id', shotIds)
      .order('shot_id')
      .order('sort_order');

    if (platesError || !plates?.length) {
      return NextResponse.json({ error: 'No plates found' }, { status: 404 });
    }

    // Generate signed URLs for each plate
    const downloads = plates.map((plate) => {
      const shotCode = shotCodeMap.get(plate.shot_id) || 'unknown';
      let url: string;
      
      if (plate.storage_path) {
        url = generateSignedStorageUrl(plate.storage_path, {
          expiresIn: 3600,
          directDownload: true,
        });
      } else if (plate.cdn_url) {
        url = plate.cdn_url;
      } else {
        return null;
      }

      return {
        shotCode,
        filename: plate.filename,
        url,
      };
    }).filter(Boolean);

    const projectCode = (turnover.project as any)?.code || 'PROJECT';
    const toNumber = turnover.turnover_number || 1;

    return NextResponse.json({
      turnover: `${projectCode}_TO${toNumber}`,
      count: downloads.length,
      downloads,
    });
  } catch (error) {
    console.error('[download-plates] Error:', error);
    return NextResponse.json({ error: 'Failed to generate download URLs' }, { status: 500 });
  }
}
