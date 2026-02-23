import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, getServiceClient } from '@/lib/auth';
import { generateSignedStorageUrl } from '@/lib/bunny';

export const maxDuration = 30;

/**
 * GET /api/turnovers/[id]/download-plates
 * Returns pre-generated ZIP URL if available, otherwise signed URLs for client-side ZIP
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const supabase = getServiceClient();

    // Get turnover with ZIP URL
    const { data: turnover, error: turnoverError } = await supabase
      .from('turnovers')
      .select(`
        id, title, turnover_number,
        plates_zip_url,
        project:projects(code),
        sequence:sequences(code)
      `)
      .eq('id', id)
      .single();

    if (turnoverError || !turnover) {
      return NextResponse.json({ error: 'Turnover not found' }, { status: 404 });
    }

    const projectCode = (turnover.project as any)?.code || 'PROJECT';
    const toNumber = turnover.turnover_number || 1;

    // If we have a pre-generated ZIP, return that
    if (turnover.plates_zip_url) {
      return NextResponse.json({
        turnover: `${projectCode}_TO${toNumber}`,
        zipUrl: turnover.plates_zip_url,
        preGenerated: true,
      });
    }

    // Otherwise, return signed URLs for client-side ZIP (fallback)
    const { data: turnoverShots } = await supabase
      .from('turnover_shots')
      .select(`id, shot:shots!inner(id, code)`)
      .eq('turnover_id', id);

    if (!turnoverShots?.length) {
      return NextResponse.json({ error: 'No shots in this turnover' }, { status: 404 });
    }

    const shotIds = turnoverShots.map((ts: any) => ts.shot.id);
    const shotCodeMap = new Map<string, string>();
    turnoverShots.forEach((ts: any) => shotCodeMap.set(ts.shot.id, ts.shot.code));

    const { data: plates } = await supabase
      .from('shot_plates')
      .select('id, shot_id, filename, storage_path, cdn_url')
      .in('shot_id', shotIds)
      .order('shot_id')
      .order('sort_order');

    if (!plates?.length) {
      return NextResponse.json({ error: 'No plates found' }, { status: 404 });
    }

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

      return { shotCode, filename: plate.filename, url };
    }).filter(Boolean);

    return NextResponse.json({
      turnover: `${projectCode}_TO${toNumber}`,
      count: downloads.length,
      downloads,
      preGenerated: false,
    });
  } catch (error) {
    console.error('[download-plates] Error:', error);
    return NextResponse.json({ error: 'Failed to get download info' }, { status: 500 });
  }
}
