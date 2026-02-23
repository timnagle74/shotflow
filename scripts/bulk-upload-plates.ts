#!/usr/bin/env npx tsx
/**
 * Bulk upload plates to Bunny Storage for download
 * 
 * Usage: 
 *   npx tsx scripts/bulk-upload-plates.ts /path/to/plates/folder
 *   npx tsx scripts/bulk-upload-plates.ts /path/to/plates/folder --dry-run
 * 
 * Expects files named like: 04_0010_bgv1.mov, VFX_84_0030_fgv01.mov, etc.
 * Matches to existing plate records by filename.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const bunnyStorageZone = process.env.BUNNY_STORAGE_ZONE!;
const bunnyStoragePassword = process.env.BUNNY_STORAGE_PASSWORD!;
const bunnyStorageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
const bunnyCdnUrl = process.env.BUNNY_STORAGE_CDN_URL!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!bunnyStorageZone || !bunnyStoragePassword || !bunnyCdnUrl) {
  console.error('Missing Bunny Storage credentials (BUNNY_STORAGE_ZONE, BUNNY_STORAGE_PASSWORD, BUNNY_STORAGE_CDN_URL)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const VIDEO_EXTENSIONS = ['.mov', '.mp4', '.mxf', '.m4v'];

async function findPlateFiles(folderPath: string): Promise<string[]> {
  const files: string[] = [];
  
  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (VIDEO_EXTENSIONS.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  scanDir(folderPath);
  return files;
}

async function uploadToStorage(filePath: string, storagePath: string): Promise<boolean> {
  const fileBuffer = fs.readFileSync(filePath);
  const uploadUrl = `https://${bunnyStorageHostname}/${bunnyStorageZone}${storagePath}`;
  
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'AccessKey': bunnyStoragePassword,
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(fileBuffer),
  });
  
  return res.ok;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const folderPath = args.find(a => !a.startsWith('--'));
  
  if (!folderPath) {
    console.log('Usage: npx tsx scripts/bulk-upload-plates.ts /path/to/plates [--dry-run]');
    process.exit(1);
  }
  
  if (!fs.existsSync(folderPath)) {
    console.error(`Folder not found: ${folderPath}`);
    process.exit(1);
  }
  
  console.log(`Scanning ${folderPath} for plate files...`);
  const files = await findPlateFiles(folderPath);
  console.log(`Found ${files.length} video files\n`);
  
  if (files.length === 0) {
    console.log('No video files found.');
    return;
  }
  
  // Get all existing plates from DB
  console.log('Fetching existing plates from database...');
  const { data: plates, error } = await supabase
    .from('shot_plates')
    .select(`
      id, filename, cdn_url, storage_path,
      shot:shots!inner(id, code, sequence:sequences!inner(project:projects!inner(code)))
    `);
  
  if (error) {
    console.error('Failed to fetch plates:', error.message);
    process.exit(1);
  }
  
  console.log(`Found ${plates?.length || 0} plates in database\n`);
  
  // Create lookup map by filename
  const platesByFilename = new Map<string, any>();
  for (const plate of plates || []) {
    platesByFilename.set(plate.filename.toLowerCase(), plate);
  }
  
  // Match and upload
  let matched = 0;
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const filePath of files) {
    const filename = path.basename(filePath);
    const plate = platesByFilename.get(filename.toLowerCase());
    
    if (!plate) {
      console.log(`⚠️  No match: ${filename}`);
      skipped++;
      continue;
    }
    
    matched++;
    const projectCode = plate.shot?.sequence?.project?.code || 'UNKNOWN';
    const shotCode = plate.shot?.code || 'UNKNOWN';
    
    // Check if already has cdn_url that works
    if (plate.cdn_url && !plate.cdn_url.includes('shotflow-pull')) {
      console.log(`⏭️  Already uploaded: ${filename}`);
      skipped++;
      continue;
    }
    
    const timestamp = Date.now();
    const storagePath = `/plates/${projectCode}/${shotCode}/${timestamp}_${filename}`;
    const cdnUrl = `${bunnyCdnUrl}${storagePath}`;
    
    console.log(`📤 ${filename} → ${storagePath}`);
    
    if (dryRun) {
      console.log(`   [DRY RUN] Would upload and update plate ${plate.id}`);
      continue;
    }
    
    // Upload to Bunny Storage
    const fileSize = fs.statSync(filePath).size;
    const sizeMB = (fileSize / 1024 / 1024).toFixed(1);
    process.stdout.write(`   Uploading (${sizeMB} MB)...`);
    
    const success = await uploadToStorage(filePath, storagePath);
    
    if (!success) {
      console.log(' ❌ FAILED');
      failed++;
      continue;
    }
    
    console.log(' ✅');
    
    // Update database record
    const { error: updateError } = await supabase
      .from('shot_plates')
      .update({
        storage_path: storagePath,
        cdn_url: cdnUrl,
        file_size: fileSize,
      })
      .eq('id', plate.id);
    
    if (updateError) {
      console.log(`   ⚠️  DB update failed: ${updateError.message}`);
      failed++;
    } else {
      uploaded++;
    }
  }
  
  console.log('\n========== Summary ==========');
  console.log(`Files found:    ${files.length}`);
  console.log(`Matched:        ${matched}`);
  console.log(`Uploaded:       ${uploaded}`);
  console.log(`Skipped:        ${skipped}`);
  console.log(`Failed:         ${failed}`);
  
  if (dryRun) {
    console.log('\n[DRY RUN] No files were actually uploaded. Remove --dry-run to upload.');
  }
}

main().catch(console.error);
