/**
 * Source Media Types
 * 
 * Master database of all clips from dailies/ALEs
 * Shots link to source_media to inherit metadata
 */

export interface SourceMedia {
  id: string;
  project_id: string;
  
  // Clip identification
  clip_name: string;              // Original clip name (e.g., A023_A003_1006NV.mov)
  tape: string | null;            // Tape/card name
  uuid: string | null;            // Camera-generated UUID if available
  
  // Timecode
  tc_in: string | null;           // Source timecode in (string format)
  tc_out: string | null;          // Source timecode out
  tc_in_frames: number | null;    // Frame number for matching
  tc_out_frames: number | null;
  fps: number;                    // Source frame rate
  duration_frames: number | null;
  
  // File info
  file_path: string | null;       // Original path from ALE/set
  file_type: string | null;       // mov, mxf, r3d, etc.
  resolution: string | null;      // e.g., "1920x1080"
  codec: string | null;
  
  // Camera metadata
  camera: string | null;          // Camera model
  camera_id: string | null;       // A-cam, B-cam, etc.
  camera_roll: string | null;     // Roll identifier
  lens: string | null;
  focal_length: string | null;
  focus_distance: string | null;
  f_stop: string | null;
  t_stop: string | null;
  iso: string | null;
  shutter: string | null;         // Shutter angle or speed
  sensor_fps: string | null;      // Native sensor FPS (for overcrank)
  white_balance: string | null;
  
  // Scene/shot info
  scene: string | null;
  take: string | null;
  circled: boolean;
  day_night: string | null;
  int_ext: string | null;
  location: string | null;
  
  // People
  director: string | null;
  dop: string | null;
  
  // Sound
  sound_roll: string | null;
  sound_tc: string | null;
  
  // Color
  colorspace: string | null;
  look: string | null;
  lut: string | null;
  
  // CDL data
  cdl_slope_r: number | null;
  cdl_slope_g: number | null;
  cdl_slope_b: number | null;
  cdl_offset_r: number | null;
  cdl_offset_g: number | null;
  cdl_offset_b: number | null;
  cdl_power_r: number | null;
  cdl_power_g: number | null;
  cdl_power_b: number | null;
  cdl_saturation: number | null;
  
  // Shoot info
  shoot_date: string | null;      // Date the footage was shot
  shoot_day: string | null;       // Production day number
  
  // Import tracking
  ale_source: string | null;      // Which ALE file this came from
  imported_at: string;
  
  // Extra fields from ALE
  custom_metadata: Record<string, unknown> | null;
}

export interface SourceMediaInsert extends Omit<SourceMedia, 'id' | 'imported_at'> {
  id?: string;
  imported_at?: string;
}

export interface SourceMediaUpdate extends Partial<SourceMediaInsert> {
  id: string;
}

/**
 * Shot editorial data (reposition, speed from XML)
 */
export interface ShotEditorialData {
  // Link to source
  source_media_id: string | null;
  source_clip_name: string | null;
  source_tc_in: string | null;
  source_tc_out: string | null;
  
  // Reposition data
  has_reposition: boolean;
  repo_scale: number | null;        // percentage (100 = no scale)
  repo_scale_x: number | null;      // if non-uniform
  repo_scale_y: number | null;
  repo_position_x: number | null;   // pixels
  repo_position_y: number | null;
  repo_rotation: number | null;     // degrees
  
  // Speed data  
  has_speed_change: boolean;
  speed_ratio: number | null;       // 1.0 = 100%, 0.5 = 50%
  speed_reverse: boolean;
  speed_time_remap: boolean;        // variable speed
  
  // Record timeline position
  record_tc_in: string | null;
  record_tc_out: string | null;
  record_frame_in: number | null;
  record_frame_out: number | null;
}

/**
 * Extended shot type with source media link
 */
export interface ShotWithSource {
  id: string;
  code: string;
  sequence_id: string;
  
  // Existing shot fields...
  description: string | null;
  status: string;
  complexity: string;
  assigned_to_id: string | null;
  due_date: string | null;
  frame_start: number | null;
  frame_end: number | null;
  handle_head: number | null;
  handle_tail: number | null;
  plate_source: string | null;
  notes: string | null;
  
  // Editorial data
  editorial: ShotEditorialData | null;
  
  // Linked source media (populated via join)
  source_media: SourceMedia | null;
}

/**
 * Summary for count sheet display
 */
export interface ShotCountSheetData {
  shot_code: string;
  
  // Timing
  frame_in: number;
  frame_out: number;
  cut_length: number;
  comp_length: number;
  handles: string;        // e.g., "8+8"
  
  // Source
  source_clip: string | null;
  source_tc: string | null;
  
  // Flags
  has_reposition: boolean;
  repo_summary: string | null;     // e.g., "110% @ +20,+15"
  
  has_speed_change: boolean;
  speed_summary: string | null;    // e.g., "50% (slow-mo)" or "RETIME"
  
  // Camera
  camera: string | null;
  lens: string | null;
  scene_take: string | null;
}

/**
 * Convert source media + shot to count sheet format
 */
export function toCountSheetData(
  shot: ShotWithSource,
  handleHead: number = 8,
  handleTail: number = 8
): ShotCountSheetData {
  const frameIn = shot.frame_start || 0;
  const frameOut = shot.frame_end || 0;
  const cutLength = frameOut - frameIn;
  const compLength = cutLength + (shot.handle_head || handleHead) + (shot.handle_tail || handleTail);
  
  const ed = shot.editorial;
  const sm = shot.source_media;
  
  // Build repo summary
  let repoSummary: string | null = null;
  if (ed?.has_reposition) {
    const parts: string[] = [];
    if (ed.repo_scale && ed.repo_scale !== 100) {
      parts.push(`${ed.repo_scale}%`);
    }
    if (ed.repo_position_x || ed.repo_position_y) {
      const x = ed.repo_position_x || 0;
      const y = ed.repo_position_y || 0;
      parts.push(`@${x >= 0 ? '+' : ''}${x},${y >= 0 ? '+' : ''}${y}`);
    }
    if (ed.repo_rotation) {
      parts.push(`rot ${ed.repo_rotation}°`);
    }
    repoSummary = parts.join(' ') || 'REPO';
  }
  
  // Build speed summary
  let speedSummary: string | null = null;
  if (ed?.has_speed_change) {
    if (ed.speed_time_remap) {
      speedSummary = 'RETIME (variable)';
    } else if (ed.speed_ratio) {
      const pct = Math.round(ed.speed_ratio * 100);
      const label = pct < 100 ? 'slow-mo' : pct > 100 ? 'fast' : '';
      speedSummary = `${pct}%${label ? ` (${label})` : ''}`;
      if (ed.speed_reverse) speedSummary += ' REV';
    } else {
      speedSummary = 'SPEED';
    }
  }
  
  // Scene/take
  const sceneTake = sm?.scene && sm?.take 
    ? `${sm.scene} T${sm.take}`
    : sm?.scene || null;
  
  return {
    shot_code: shot.code,
    frame_in: frameIn,
    frame_out: frameOut,
    cut_length: cutLength,
    comp_length: compLength,
    handles: `${shot.handle_head || handleHead}+${shot.handle_tail || handleTail}`,
    source_clip: ed?.source_clip_name || sm?.clip_name || null,
    source_tc: ed?.source_tc_in || sm?.tc_in || null,
    has_reposition: ed?.has_reposition || false,
    repo_summary: repoSummary,
    has_speed_change: ed?.has_speed_change || false,
    speed_summary: speedSummary,
    camera: sm?.camera || null,
    lens: sm?.lens || null,
    scene_take: sceneTake,
  };
}
