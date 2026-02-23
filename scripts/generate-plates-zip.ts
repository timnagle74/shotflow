/**
 * Generate plates ZIP for a turnover and upload to Bunny storage
 * 
 * Usage: npx tsx scripts/generate-plates-zip.ts [turnover-id]
 * Or: npx tsx scripts/generate-plates-zip.ts --all (backfill all)
 */

import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const bunnyStorageZone = process.env.BUNNY_STORAGE_ZONE!;
const bunnyStoragePassword = process.env.BUNNY_STORAGE_PASSWORD!;
const bunnyStorageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
const bunnyCdnUrl = process.env.BUNNY_STORAGE_CDN_URL!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateZipForTurnover(turnoverId: string): Promise<string | null> {
  console.log(`\nProcessing turnover: ${turnoverId}`);
  
  // Get turnover info
  const { data: turnover, error: turnoverError } = await supabase
    .from('turnovers')
    .select(`
      id, turnover_number, title,
      project:projects(code),
      sequence:sequences(code)
    `)
    .eq('id', turnoverId)
    .single();

  if (turnoverError || !turnover) {
    console.error(`  Turnover not found: ${turnoverError?.message}`);
    return null;
  }

  const projectCode = (turnover.project as any)?.code || 'PROJECT';
  const toNumber = turnover.turnover_number || 1;
  const zipFilename = `${projectCode}_TO${toNumber}_plates.zip`;
  console.log(`  ZIP filename: ${zipFilename}`);

  // Get shots in turnover
  const { data: turnoverShots } = await supabase
    .from('turnover_shots')
    .select(`id, shot:shots!inner(id, code)`)
    .eq('turnover_id', turnoverId);

  if (!turnoverShots?.length) {
    console.log(`  No shots in turnover`);
    return null;
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
    console.log(`  No plates found`);
    return null;
  }

  console.log(`  Found ${plates.length} plates`);

  // Build ZIP
  const zip = new JSZip();
  let added = 0;

  for (const plate of plates) {
    const shotCode = shotCodeMap.get(plate.shot_id) || 'unknown';
    const url = plate.cdn_url || (plate.storage_path ? `${bunnyCdnUrl}${plate.storage_path}` : null);
    
    if (!url) {
      console.log(`    Skipping ${plate.filename} - no URL`);
      continue;
    }

    try {
      process.stdout.write(`    Fetching ${plate.filename}...`);
      const res = await fetch(url);
      if (!res.ok) {
        console.log(` FAILED (${res.status})`);
        continue;
      }
      const buffer = await res.arrayBuffer();
      zip.file(`${shotCode}/${plate.filename}`, buffer);
      console.log(` OK (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB)`);
      added++;
    } catch (err) {
      console.log(` ERROR: ${err}`);
    }
  }

  if (added === 0) {
    console.log(`  No files added to ZIP`);
    return null;
  }

  console.log(`  Generating ZIP with ${added} files...`);
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 5 } });
  console.log(`  ZIP size: ${(zipBuffer.length / 1024 / 1024).toFixed(1)}MB`);

  // Upload to Bunny Storage
  const storagePath = `/plates-zips/${projectCode}/${zipFilename}`;
  const uploadUrl = `https://${bunnyStorageHostname}/${bunnyStorageZone}${storagePath}`;
  
  console.log(`  Uploading to Bunny: ${storagePath}`);
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'AccessKey': bunnyStoragePassword,
      'Content-Type': 'application/zip',
    },
    body: new Uint8Array(zipBuffer),
  });

  if (!uploadRes.ok) {
    console.error(`  Upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
    return null;
  }

  const cdnUrl = `${bunnyCdnUrl}${storagePath}`;
  console.log(`  Uploaded: ${cdnUrl}`);

  // Update turnover record
  const { error: updateError } = await supabase
    .from('turnovers')
    .update({
      plates_zip_url: cdnUrl,
      plates_zip_generated_at: new Date().toISOString(),
    })
    .eq('id', turnoverId);

  if (updateError) {
    console.error(`  Failed to update turnover: ${updateError.message}`);
    return null;
  }

  console.log(`  ✓ Done`);
  return cdnUrl;
}

async function backfillAll() {
  console.log('Backfilling all turnovers with plates...\n');

  // Get all turnovers that have shots with plates
  const { data: turnovers } = await supabase
    .from('turnovers')
    .select(`
      id, turnover_number,
      project:projects(code),
      turnover_shots(
        shot:shots!inner(
          shot_plates(id)
        )
      )
    `)
    .is('plates_zip_url', null);

  if (!turnovers?.length) {
    console.log('No turnovers need processing');
    return;
  }

  // Filter to only turnovers that have at least one plate
  const turnoversWithPlates = turnovers.filter((t: any) => 
    t.turnover_shots?.some((ts: any) => ts.shot?.shot_plates?.length > 0)
  );

  console.log(`Found ${turnoversWithPlates.length} turnovers with plates\n`);

  for (const turnover of turnoversWithPlates) {
    await generateZipForTurnover(turnover.id);
  }

  console.log('\nBackfill complete!');
}

// Main
const args = process.argv.slice(2);

if (args[0] === '--all') {
  backfillAll().catch(console.error);
} else if (args[0]) {
  generateZipForTurnover(args[0]).catch(console.error);
} else {
  console.log('Usage:');
  console.log('  npx tsx scripts/generate-plates-zip.ts <turnover-id>');
  console.log('  npx tsx scripts/generate-plates-zip.ts --all');
}
