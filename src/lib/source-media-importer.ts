/**
 * Source Media Importer
 * 
 * Bulk imports ALEs into the source_media table
 * Provides matching logic to link shots to source media
 */

import { parseAleFile, parseAscSop, parseAscSat, getClipName, isCircled, AleRecord } from './ale-parser';
import type { SourceMedia, SourceMediaInsert } from './source-media.types';

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  warnings: string[];
}

export interface ALEImportOptions {
  projectId: string;
  aleSource: string;         // Filename of the ALE
  shootDate?: string;        // Override if not in ALE
  shootDay?: string;         // Production day
  overwriteExisting?: boolean;
}

/**
 * Parse ALE content and convert to SourceMedia records
 */
export function aleToSourceMedia(
  aleContent: string,
  options: ALEImportOptions
): { records: SourceMediaInsert[]; warnings: string[] } {
  const result = parseAleFile(aleContent);
  const warnings = [...result.warnings];
  const records: SourceMediaInsert[] = [];
  
  const fps = result.heading.fps ? parseFloat(result.heading.fps) : 24;
  
  for (const aleRecord of result.records) {
    const clipName = getClipName(aleRecord);
    if (!clipName) {
      warnings.push(`Skipping record with no clip name`);
      continue;
    }
    
    // Parse CDL if present
    const sopStr = aleRecord['ASC_SOP'] || aleRecord['ASC SOP'] || '';
    const satStr = aleRecord['ASC_SAT'] || aleRecord['ASC SAT'] || '';
    const sop = parseAscSop(sopStr);
    const sat = parseAscSat(satStr);
    
    // Parse timecode
    const tcIn = aleRecord['Start'] || aleRecord['Start TC'] || aleRecord['SRC Start TC'] || null;
    const tcOut = aleRecord['End'] || aleRecord['End TC'] || aleRecord['SRC End TC'] || null;
    const tcInFrames = tcIn ? timecodeToFrames(tcIn, fps) : null;
    const tcOutFrames = tcOut ? timecodeToFrames(tcOut, fps) : null;
    const durationFrames = aleRecord['Duration'] 
      ? parseInt(aleRecord['Duration'], 10) 
      : (tcInFrames && tcOutFrames ? tcOutFrames - tcInFrames : null);
    
    // Map ALE columns to source media fields
    const record: SourceMediaInsert = {
      project_id: options.projectId,
      
      // Clip identification
      clip_name: clipName,
      tape: aleRecord['Tape'] || aleRecord['Reel'] || null,
      uuid: aleRecord['UUID'] || aleRecord['Clip UID'] || aleRecord['UMI'] || null,
      
      // Timecode
      tc_in: tcIn,
      tc_out: tcOut,
      tc_in_frames: tcInFrames,
      tc_out_frames: tcOutFrames,
      fps,
      duration_frames: durationFrames,
      
      // File info
      file_path: aleRecord['Filepath'] || aleRecord['Source File Path'] || aleRecord['Source File'] || null,
      file_type: aleRecord['File Type'] || aleRecord['Filetype'] || extractExtension(clipName),
      resolution: buildResolution(aleRecord),
      codec: aleRecord['Video Codec'] || aleRecord['Codec'] || null,
      
      // Camera metadata
      camera: aleRecord['Camera'] || aleRecord['Camera Type'] || aleRecord['Camera Model'] || null,
      camera_id: aleRecord['Camera ID'] || aleRecord['Camera Label'] || aleRecord['Cam'] || null,
      camera_roll: aleRecord['Camera Roll'] || aleRecord['Roll'] || aleRecord['Reel'] || null,
      lens: aleRecord['Lens'] || aleRecord['Lens Type'] || null,
      focal_length: aleRecord['Focal Length'] || aleRecord['Focal Length (mm)'] || null,
      focus_distance: aleRecord['Focus Distance'] || aleRecord['Focus Dist'] || null,
      f_stop: aleRecord['F-Stop'] || aleRecord['Aperture'] || null,
      t_stop: aleRecord['T-Stop'] || null,
      iso: aleRecord['ISO'] || aleRecord['EI'] || aleRecord['ASA'] || null,
      shutter: aleRecord['Shutter'] || aleRecord['Shutter Angle'] || aleRecord['Shutter Speed'] || null,
      sensor_fps: aleRecord['Sensor FPS'] || aleRecord['Project FPS'] || aleRecord['Capture FPS'] || null,
      white_balance: aleRecord['White Balance'] || aleRecord['WB'] || aleRecord['Color Temp'] || null,
      
      // Scene/shot info
      scene: aleRecord['Scene'] || aleRecord['Slate'] || null,
      take: aleRecord['Take'] || aleRecord['Tk'] || null,
      circled: isCircled(aleRecord),
      day_night: aleRecord['Day/Night'] || aleRecord['D/N'] || null,
      int_ext: aleRecord['Int/Ext'] || aleRecord['I/E'] || null,
      location: aleRecord['Location'] || aleRecord['Set'] || null,
      
      // People
      director: aleRecord['Director'] || null,
      dop: aleRecord['DP'] || aleRecord['DOP'] || aleRecord['Cinematographer'] || null,
      
      // Sound
      sound_roll: aleRecord['Sound Roll'] || aleRecord['Audio Roll'] || null,
      sound_tc: aleRecord['Sound TC'] || aleRecord['Audio TC'] || null,
      
      // Color
      colorspace: aleRecord['Colorspace'] || aleRecord['Color Space'] || aleRecord['Gamma'] || null,
      look: aleRecord['Look'] || aleRecord['LUT'] || aleRecord['Look Info'] || null,
      lut: aleRecord['LUT Name'] || aleRecord['Applied LUT'] || null,
      
      // CDL data
      cdl_slope_r: sop?.slope[0] ?? null,
      cdl_slope_g: sop?.slope[1] ?? null,
      cdl_slope_b: sop?.slope[2] ?? null,
      cdl_offset_r: sop?.offset[0] ?? null,
      cdl_offset_g: sop?.offset[1] ?? null,
      cdl_offset_b: sop?.offset[2] ?? null,
      cdl_power_r: sop?.power[0] ?? null,
      cdl_power_g: sop?.power[1] ?? null,
      cdl_power_b: sop?.power[2] ?? null,
      cdl_saturation: sat ?? null,
      
      // Shoot info
      shoot_date: options.shootDate || aleRecord['Shoot Date'] || aleRecord['Date'] || null,
      shoot_day: options.shootDay || aleRecord['Shoot Day'] || aleRecord['Day'] || null,
      
      // Import tracking
      ale_source: options.aleSource,
      
      // Store any extra columns we didn't map
      custom_metadata: extractCustomMetadata(aleRecord),
    };
    
    records.push(record);
  }
  
  return { records, warnings };
}

/**
 * Match a clip (from XML/EDL) to source media
 * Returns the matching source_media ID or null
 */
export function matchToSourceMedia(
  clipName: string,
  sourceTimecode: string | null,
  sourceTimecodeFrame: number | null,
  sourceMedia: SourceMedia[]
): SourceMedia | null {
  // 1. Exact clip name match
  let match = sourceMedia.find(sm => sm.clip_name === clipName);
  if (match) return match;
  
  // 2. Clip name without extension
  const clipBase = clipName.replace(/\.[^.]+$/, '');
  match = sourceMedia.find(sm => sm.clip_name.replace(/\.[^.]+$/, '') === clipBase);
  if (match) return match;
  
  // 3. Partial match (clip name contains or is contained)
  match = sourceMedia.find(sm => 
    sm.clip_name.includes(clipBase) || clipBase.includes(sm.clip_name.replace(/\.[^.]+$/, ''))
  );
  if (match) return match;
  
  // 4. Timecode range match
  if (sourceTimecodeFrame !== null) {
    match = sourceMedia.find(sm => {
      if (sm.tc_in_frames === null || sm.tc_out_frames === null) return false;
      return sourceTimecodeFrame >= sm.tc_in_frames && sourceTimecodeFrame <= sm.tc_out_frames;
    });
    if (match) return match;
  }
  
  return null;
}

/**
 * Batch match clips to source media
 */
export function batchMatchToSourceMedia(
  clips: Array<{ name: string; sourceFileName: string | null; sourceTimecodeFrame: number | null }>,
  sourceMedia: SourceMedia[]
): Map<string, SourceMedia | null> {
  const matches = new Map<string, SourceMedia | null>();
  
  for (const clip of clips) {
    const clipName = clip.sourceFileName || clip.name;
    const match = matchToSourceMedia(clipName, null, clip.sourceTimecodeFrame, sourceMedia);
    matches.set(clip.name, match);
  }
  
  return matches;
}

// Helper functions

function timecodeToFrames(tc: string, fps: number): number {
  const parts = tc.split(/[:;]/);
  if (parts.length !== 4) return 0;
  const [h, m, s, f] = parts.map(Number);
  if ([h, m, s, f].some(isNaN)) return 0;
  return Math.round(h * 3600 * fps + m * 60 * fps + s * fps + f);
}

function extractExtension(filename: string): string | null {
  const match = filename.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : null;
}

function buildResolution(record: AleRecord): string | null {
  const width = record['Resolution Width'] || record['Image Width'] || record['Width'];
  const height = record['Resolution Height'] || record['Image Height'] || record['Height'];
  
  if (width && height) {
    return `${width}x${height}`;
  }
  
  return record['Resolution'] || record['Format'] || null;
}

// Standard ALE columns we've already mapped
const KNOWN_COLUMNS = new Set([
  'Name', 'Clip Name', 'ImageFileName', 'Video Clip Name Of Source',
  'Tape', 'Reel', 'UUID', 'Clip UID', 'UMI',
  'Start', 'Start TC', 'SRC Start TC', 'End', 'End TC', 'SRC End TC', 'Duration',
  'Filepath', 'Source File Path', 'Source File', 'File Type', 'Filetype',
  'Resolution Width', 'Image Width', 'Width', 'Resolution Height', 'Image Height', 'Height',
  'Resolution', 'Format', 'Video Codec', 'Codec',
  'Camera', 'Camera Type', 'Camera Model', 'Camera ID', 'Camera Label', 'Cam',
  'Camera Roll', 'Roll', 'Lens', 'Lens Type',
  'Focal Length', 'Focal Length (mm)', 'Focus Distance', 'Focus Dist',
  'F-Stop', 'Aperture', 'T-Stop', 'ISO', 'EI', 'ASA',
  'Shutter', 'Shutter Angle', 'Shutter Speed',
  'Sensor FPS', 'Project FPS', 'Capture FPS',
  'White Balance', 'WB', 'Color Temp',
  'Scene', 'Slate', 'Take', 'Tk', 'Circled', 'Circled Take',
  'Day/Night', 'D/N', 'Int/Ext', 'I/E', 'Location', 'Set',
  'Director', 'DP', 'DOP', 'Cinematographer',
  'Sound Roll', 'Audio Roll', 'Sound TC', 'Audio TC',
  'Colorspace', 'Color Space', 'Gamma', 'Look', 'LUT', 'Look Info', 'LUT Name', 'Applied LUT',
  'ASC_SOP', 'ASC SOP', 'ASC_SAT', 'ASC SAT',
  'Shoot Date', 'Date', 'Shoot Day', 'Day',
]);

function extractCustomMetadata(record: AleRecord): Record<string, unknown> | null {
  const custom: Record<string, unknown> = {};
  let hasCustom = false;
  
  for (const [key, value] of Object.entries(record)) {
    if (!KNOWN_COLUMNS.has(key) && value && value.trim()) {
      custom[key] = value;
      hasCustom = true;
    }
  }
  
  return hasCustom ? custom : null;
}

/**
 * Generate a summary of source media for a project
 */
export function summarizeSourceMedia(sourceMedia: SourceMedia[]): {
  totalClips: number;
  shootDates: string[];
  cameras: string[];
  scenes: string[];
  totalDuration: number;
  withCDL: number;
} {
  const shootDates = new Set<string>();
  const cameras = new Set<string>();
  const scenes = new Set<string>();
  let totalDuration = 0;
  let withCDL = 0;
  
  for (const sm of sourceMedia) {
    if (sm.shoot_date) shootDates.add(sm.shoot_date);
    if (sm.camera) cameras.add(sm.camera);
    if (sm.camera_id) cameras.add(sm.camera_id);
    if (sm.scene) scenes.add(sm.scene);
    if (sm.duration_frames) totalDuration += sm.duration_frames;
    if (sm.cdl_slope_r !== null) withCDL++;
  }
  
  return {
    totalClips: sourceMedia.length,
    shootDates: Array.from(shootDates).sort(),
    cameras: Array.from(cameras).sort(),
    scenes: Array.from(scenes).sort(),
    totalDuration,
    withCDL,
  };
}
