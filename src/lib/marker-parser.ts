/**
 * Parser for Avid marker export files (tab-delimited text)
 * 
 * Format:
 * VFX_ID\tTimecode\tTrack\tColor\tNote\tCount
 * VFX_41_0010\t03:00:45:12\tV1\tmagenta\tVFX_41_0010 - Remove lighting from top left\t1
 */

export interface MarkerEntry {
  id: string;           // VFX_41_0010
  timecode: string;     // 03:00:45:12
  track: string;        // V1
  color: string;        // magenta
  note: string;         // Full note text
  frames?: number;      // Timecode converted to frames
}

export interface MarkerParseResult {
  markers: MarkerEntry[];
  warnings: string[];
}

/**
 * Parse timecode string to frame number
 * Supports HH:MM:SS:FF and HH:MM:SS;FF (drop frame)
 */
export function parseTimecodeToFrames(tc: string, fps: number = 24): number {
  if (!tc) return 0;
  const parts = tc.split(/[:;]/).map(Number);
  if (parts.length !== 4) return 0;
  const [hh, mm, ss, ff] = parts;
  return hh * 3600 * fps + mm * 60 * fps + ss * fps + ff;
}

/**
 * Parse Avid marker export file content
 */
export function parseMarkerFile(content: string, fps: number = 24): MarkerParseResult {
  const lines = content.trim().split(/\r?\n/);
  const markers: MarkerEntry[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Split by tab
    const parts = line.split('\t');
    
    // Need at least ID, timecode, track, color, note
    if (parts.length < 5) {
      // Could be a header line or malformed
      if (i === 0 && (line.toLowerCase().includes('timecode') || line.toLowerCase().includes('marker'))) {
        // Skip header
        continue;
      }
      warnings.push(`Line ${i + 1}: Not enough columns (got ${parts.length}, need 5+)`);
      continue;
    }

    const [id, timecode, track, color, note] = parts;

    // Validate timecode format
    if (!/^\d{2}:\d{2}:\d{2}[:;]\d{2}$/.test(timecode)) {
      warnings.push(`Line ${i + 1}: Invalid timecode format "${timecode}"`);
      continue;
    }

    markers.push({
      id: id.trim(),
      timecode: timecode.trim(),
      track: track.trim(),
      color: color.trim(),
      note: note.trim(),
      frames: parseTimecodeToFrames(timecode, fps),
    });
  }

  return { markers, warnings };
}

/**
 * Match markers to shots by timecode range
 * Returns a map of shotCode -> matched notes (concatenated if multiple)
 */
export function matchMarkersToShots(
  markers: MarkerEntry[],
  shots: Array<{
    code: string;
    recordIn?: string;
    recordOut?: string;
  }>,
  fps: number = 24
): {
  matches: Record<string, string>;
  matchedCount: number;
  unmatchedMarkers: MarkerEntry[];
} {
  const matches: Record<string, string> = {};
  const unmatchedMarkers: MarkerEntry[] = [];

  // Pre-compute shot ranges
  const shotRanges = shots.map(shot => ({
    code: shot.code,
    startFrame: shot.recordIn ? parseTimecodeToFrames(shot.recordIn, fps) : 0,
    endFrame: shot.recordOut ? parseTimecodeToFrames(shot.recordOut, fps) : Infinity,
  }));

  for (const marker of markers) {
    const markerFrame = marker.frames ?? parseTimecodeToFrames(marker.timecode, fps);
    
    // Find shot that contains this timecode
    const matchedShot = shotRanges.find(
      shot => markerFrame >= shot.startFrame && markerFrame < shot.endFrame
    );

    if (matchedShot) {
      // Append note (in case multiple markers per shot)
      if (matches[matchedShot.code]) {
        matches[matchedShot.code] += `\n${marker.note}`;
      } else {
        matches[matchedShot.code] = marker.note;
      }
    } else {
      unmatchedMarkers.push(marker);
    }
  }

  return {
    matches,
    matchedCount: markers.length - unmatchedMarkers.length,
    unmatchedMarkers,
  };
}
