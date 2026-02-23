import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, getServiceClient } from '@/lib/auth';
import { bunnyConfig, uploadToStorage } from '@/lib/bunny';
import JSZip from 'jszip';

export const maxDuration = 300; // 5 min for large ZIPs (requires Vercel Pro)

/**
 * POST /api/turnovers/[id]/generate-zip
 * Generate plates ZIP and upload to Bunny storage
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const supabase = getServiceClient();

    // Get turnover
    const { data: turnover, error: turnoverError } = await supabase
      .from('turnovers')
      .select(`
        id, turnover_number, title,
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
    const zipFilename = `${projectCode}_TO${toNumber}_plates.zip`;

    // Get shots
    const { data: turnoverShots } = await supabase
      .from('turnover_shots')
      .select(`id, shot:shots!inner(id, code)`)
      .eq('turnover_id', id);

    if (!turnoverShots?.length) {
      return NextResponse.json({ error: 'No shots in turnover' }, { status: 404 });
    }

    const shotIds = turnoverShots.map((ts: any) => ts.shot.id);
    const shotCodeMap = new Map<string, string>();
    turnoverShots.forEach((ts: any) => shotCodeMap.set(ts.shot.id, ts.shot.code));

    // Get plates
    const { data: plates } = await supabase
      .from('shot_plates')
      .select('id, shot_id, filename, storage_path, cdn_url')
      .in('shot_id', shotIds)
      .order('shot_id')
      .order('sort_order');

    if (!plates?.length) {
      return NextResponse.json({ error: 'No plates found' }, { status: 404 });
    }

    // Build ZIP
    const zip = new JSZip();
    let added = 0;

    for (const plate of plates) {
      const shotCode = shotCodeMap.get(plate.shot_id) || 'unknown';
      const url = plate.cdn_url || (plate.storage_path ? `${bunnyConfig.storage.cdnUrl}${plate.storage_path}` : null);
      
      if (!url) continue;

      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const buffer = await res.arrayBuffer();
        zip.file(`${shotCode}/${plate.filename}`, buffer);
        added++;
      } catch (err) {
        console.warn(`Failed to fetch ${plate.filename}:`, err);
      }
    }

    if (added === 0) {
      return NextResponse.json({ error: 'No files could be fetched' }, { status: 500 });
    }

    // Generate ZIP
    const zipBuffer = Buffer.from(await zip.generateAsync({ 
      type: 'arraybuffer', 
      compression: 'DEFLATE', 
      compressionOptions: { level: 5 } 
    }));

    // Upload to Bunny
    const storagePath = `/plates-zips/${projectCode}/${zipFilename}`;
    const uploadResult = await uploadToStorage(zipBuffer, storagePath, 'application/zip');

    // Update turnover
    await supabase
      .from('turnovers')
      .update({
        plates_zip_url: uploadResult.cdnUrl,
        plates_zip_generated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      zipUrl: uploadResult.cdnUrl,
      fileCount: added,
      size: zipBuffer.length,
    });
  } catch (error) {
    console.error('[generate-zip] Error:', error);
    return NextResponse.json({ error: 'Failed to generate ZIP' }, { status: 500 });
  }
}
