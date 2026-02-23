import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireAdmin, getServiceClient } from '@/lib/auth';
import { bunnyConfig, uploadToStorage } from '@/lib/bunny';
import JSZip from 'jszip';

export const maxDuration = 300;

/**
 * POST /api/admin/backfill-plates-zips
 * Generate ZIP files for all turnovers that don't have one yet
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;
  
  const roleCheck = requireAdmin(auth.user);
  if (roleCheck) return roleCheck;

  const supabase = getServiceClient();
  const results: any[] = [];

  // Get turnovers without ZIP that have plates
  const { data: turnovers } = await supabase
    .from('turnovers')
    .select(`
      id, turnover_number,
      project:projects(code)
    `)
    .is('plates_zip_url', null);

  if (!turnovers?.length) {
    return NextResponse.json({ message: 'No turnovers need processing', results: [] });
  }

  for (const turnover of turnovers) {
    try {
      const projectCode = (turnover.project as any)?.code || 'PROJECT';
      const toNumber = turnover.turnover_number || 1;

      // Get shots
      const { data: turnoverShots } = await supabase
        .from('turnover_shots')
        .select(`id, shot:shots!inner(id, code)`)
        .eq('turnover_id', turnover.id);

      if (!turnoverShots?.length) {
        results.push({ id: turnover.id, status: 'skipped', reason: 'no shots' });
        continue;
      }

      const shotIds = turnoverShots.map((ts: any) => ts.shot.id);
      const shotCodeMap = new Map<string, string>();
      turnoverShots.forEach((ts: any) => shotCodeMap.set(ts.shot.id, ts.shot.code));

      // Get plates
      const { data: plates } = await supabase
        .from('shot_plates')
        .select('id, shot_id, filename, storage_path, cdn_url')
        .in('shot_id', shotIds);

      if (!plates?.length) {
        results.push({ id: turnover.id, status: 'skipped', reason: 'no plates' });
        continue;
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
          // Skip failed files
        }
      }

      if (added === 0) {
        results.push({ id: turnover.id, status: 'skipped', reason: 'no files fetched' });
        continue;
      }

      // Generate and upload ZIP
      const zipFilename = `${projectCode}_TO${toNumber}_plates.zip`;
      const zipBuffer = Buffer.from(await zip.generateAsync({ 
        type: 'arraybuffer', 
        compression: 'DEFLATE', 
        compressionOptions: { level: 5 } 
      }));

      const storagePath = `/plates-zips/${projectCode}/${zipFilename}`;
      const uploadResult = await uploadToStorage(zipBuffer, storagePath, 'application/zip');

      // Update turnover
      await supabase
        .from('turnovers')
        .update({
          plates_zip_url: uploadResult.cdnUrl,
          plates_zip_generated_at: new Date().toISOString(),
        })
        .eq('id', turnover.id);

      results.push({ 
        id: turnover.id, 
        status: 'success', 
        zipUrl: uploadResult.cdnUrl,
        fileCount: added,
        size: zipBuffer.length,
      });
    } catch (err: any) {
      results.push({ id: turnover.id, status: 'error', error: err.message });
    }
  }

  return NextResponse.json({ 
    message: `Processed ${results.length} turnovers`,
    results,
  });
}
