// ALE (Avid Log Exchange) Parser
// Handles both simplified (database-style) and full-production (Silverstack/Pomfort) ALE formats

export interface AleHeading {
  fieldDelimiter: string;
  videoFormat: string | null;
  audioFormat: string | null;
  fps: string | null;
  [key: string]: string | null;
}

export interface AscSop {
  slope: [number, number, number];
  offset: [number, number, number];
  power: [number, number, number];
}

export interface AleRecord {
  [key: string]: string;
}

export interface AleParseResult {
  heading: AleHeading;
  columns: string[];
  records: AleRecord[];
  recordCount: number;
  warnings: string[];
}

/**
 * Parse ASC_SOP string: "(slope_r slope_g slope_b)(offset_r offset_g offset_b)(power_r power_g power_b)"
 */
export function parseAscSop(sop: string): AscSop | null {
  if (!sop || !sop.trim()) return null;
  const match = sop.match(
    /\(\s*([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s*\)\s*\(\s*([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s*\)\s*\(\s*([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s*\)/
  );
  if (!match) return null;
  return {
    slope: [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])],
    offset: [parseFloat(match[4]), parseFloat(match[5]), parseFloat(match[6])],
    power: [parseFloat(match[7]), parseFloat(match[8]), parseFloat(match[9])],
  };
}

/**
 * Parse ASC_SAT string to number
 */
export function parseAscSat(sat: string): number | null {
  if (!sat || !sat.trim()) return null;
  const val = parseFloat(sat.trim());
  return isNaN(val) ? null : val;
}

/**
 * Parse an ALE file content string into structured data
 */
export function parseAleFile(content: string): AleParseResult {
  const warnings: string[] = [];
  const lines = content.split(/\r?\n/);

  let section: 'none' | 'heading' | 'column' | 'data' = 'none';
  const headingEntries: [string, string][] = [];
  let columns: string[] = [];
  const records: AleRecord[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Section headers
    if (trimmed === 'Heading') { section = 'heading'; continue; }
    if (trimmed === 'Column') { section = 'column'; continue; }
    if (trimmed === 'Data') { section = 'data'; continue; }

    if (section === 'heading') {
      const parts = trimmed.split('\t');
      if (parts.length >= 2) {
        headingEntries.push([parts[0].trim(), parts.slice(1).join('\t').trim()]);
      } else if (parts.length === 1 && trimmed) {
        headingEntries.push([trimmed, '']);
      }
    } else if (section === 'column') {
      // Column line — tab-separated column names
      columns = line.split('\t').map(c => c.trim()).filter(c => c.length > 0);
      if (columns.length === 0) {
        warnings.push(`Line ${i + 1}: Empty column definition`);
      }
    } else if (section === 'data') {
      if (!columns.length) {
        warnings.push(`Line ${i + 1}: Data row before column definition`);
        continue;
      }
      const values = line.split('\t');
      const record: AleRecord = {};
      for (let c = 0; c < columns.length; c++) {
        record[columns[c]] = (values[c] ?? '').trim();
      }
      // Store any extra values beyond column count
      if (values.length > columns.length) {
        warnings.push(`Line ${i + 1}: Row has ${values.length} values but only ${columns.length} columns`);
      }
      records.push(record);
    }
  }

  // Build heading object
  const heading: AleHeading = {
    fieldDelimiter: 'TABS',
    videoFormat: null,
    audioFormat: null,
    fps: null,
  };
  for (const [key, value] of headingEntries) {
    const k = key.toUpperCase();
    if (k === 'FIELD_DELIM') heading.fieldDelimiter = value;
    else if (k === 'VIDEO_FORMAT') heading.videoFormat = value;
    else if (k === 'AUDIO_FORMAT') heading.audioFormat = value;
    else if (k === 'FPS') heading.fps = value;
    else heading[key] = value;
  }

  if (columns.length === 0) {
    warnings.push('No column definition found in ALE file');
  }

  return {
    heading,
    columns,
    records,
    recordCount: records.length,
    warnings,
  };
}

/**
 * Helper to get a record's clip name — tries common column names
 */
export function getClipName(record: AleRecord): string {
  return record['Name'] || record['Clip Name'] || record['ImageFileName'] || record['Video Clip Name Of Source'] || '';
}

/**
 * Helper to check if a record is circled
 */
export function isCircled(record: AleRecord): boolean {
  const val = (record['Circled'] || record['Circled Take'] || '').trim().toLowerCase();
  return val === 'y' || val === 'yes' || val === 'circled' || val === 'true';
}

/**
 * Extract scene/take from a record
 */
export function getSceneTake(record: AleRecord): { scene: string; take: string } {
  return {
    scene: record['Scene'] || '',
    take: record['Take'] || '',
  };
}
