// ASC CDL File Parser
// Parses .cdl (ColorDecisionList) and .cc (ColorCorrection) XML files

export interface CdlValues {
  id: string;
  description: string;
  slopeR: number;
  slopeG: number;
  slopeB: number;
  offsetR: number;
  offsetG: number;
  offsetB: number;
  powerR: number;
  powerG: number;
  powerB: number;
  saturation: number;
}

export interface CdlParseResult {
  cdls: CdlValues[];
  warnings: string[];
  format: 'cdl' | 'cc' | 'ccc' | 'unknown';
}

/**
 * Parse RGB triplet from CDL format: "1.0000 0.9800 1.0200"
 */
function parseRgbTriplet(text: string): [number, number, number] | null {
  const trimmed = text.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 3) return null;
  
  const [r, g, b] = parts.map(p => parseFloat(p));
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  
  return [r, g, b];
}

/**
 * Extract text content from an XML tag
 */
function extractTagContent(xml: string, tagName: string): string | null {
  // Handle namespaced tags too
  const regex = new RegExp(`<(?:[a-z]+:)?${tagName}[^>]*>([^<]*)<\\/(?:[a-z]+:)?${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extract all occurrences of a tag's content
 */
function extractAllTagContents(xml: string, tagName: string): string[] {
  const regex = new RegExp(`<(?:[a-z]+:)?${tagName}[^>]*>([^<]*)<\\/(?:[a-z]+:)?${tagName}>`, 'gi');
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

/**
 * Extract ColorCorrection blocks from XML
 */
function extractColorCorrections(xml: string): string[] {
  const blocks: string[] = [];
  // Match ColorCorrection elements (with or without namespace prefix)
  const regex = /<(?:[a-z]+:)?ColorCorrection[^>]*>[\s\S]*?<\/(?:[a-z]+:)?ColorCorrection>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    blocks.push(match[0]);
  }
  return blocks;
}

/**
 * Extract id or description from ColorCorrection block
 */
function extractCdlIdentifier(block: string): { id: string; description: string } {
  // Try to get id attribute
  const idMatch = block.match(/<(?:[a-z]+:)?ColorCorrection[^>]*\bid=["']([^"']+)["']/i);
  const id = idMatch ? idMatch[1] : '';
  
  // Try to get Description tag content
  const description = extractTagContent(block, 'Description') || '';
  
  return { id, description };
}

/**
 * Parse a single ColorCorrection block into CdlValues
 */
function parseColorCorrectionBlock(block: string, index: number): { cdl: CdlValues | null; warnings: string[] } {
  const warnings: string[] = [];
  
  const { id, description } = extractCdlIdentifier(block);
  
  // Parse Slope
  const slopeText = extractTagContent(block, 'Slope');
  const slope = slopeText ? parseRgbTriplet(slopeText) : null;
  if (!slope) {
    warnings.push(`Block ${index + 1}: Invalid or missing Slope values`);
  }
  
  // Parse Offset
  const offsetText = extractTagContent(block, 'Offset');
  const offset = offsetText ? parseRgbTriplet(offsetText) : null;
  if (!offset) {
    warnings.push(`Block ${index + 1}: Invalid or missing Offset values`);
  }
  
  // Parse Power
  const powerText = extractTagContent(block, 'Power');
  const power = powerText ? parseRgbTriplet(powerText) : null;
  if (!power) {
    warnings.push(`Block ${index + 1}: Invalid or missing Power values`);
  }
  
  // Parse Saturation (optional, default to 1.0)
  const satText = extractTagContent(block, 'Saturation');
  let saturation = 1.0;
  if (satText) {
    const parsed = parseFloat(satText);
    if (!isNaN(parsed)) {
      saturation = parsed;
    } else {
      warnings.push(`Block ${index + 1}: Invalid Saturation value, using default 1.0`);
    }
  }
  
  // If we have valid SOP values, create the CDL
  if (slope && offset && power) {
    return {
      cdl: {
        id,
        description,
        slopeR: slope[0],
        slopeG: slope[1],
        slopeB: slope[2],
        offsetR: offset[0],
        offsetG: offset[1],
        offsetB: offset[2],
        powerR: power[0],
        powerG: power[1],
        powerB: power[2],
        saturation,
      },
      warnings,
    };
  }
  
  return { cdl: null, warnings };
}

/**
 * Detect CDL format from XML content
 */
function detectFormat(content: string): 'cdl' | 'cc' | 'ccc' | 'unknown' {
  if (/<(?:[a-z]+:)?ColorDecisionList/i.test(content)) return 'cdl';
  if (/<(?:[a-z]+:)?ColorCorrectionCollection/i.test(content)) return 'ccc';
  if (/<(?:[a-z]+:)?ColorCorrection/i.test(content)) return 'cc';
  return 'unknown';
}

/**
 * Parse a CDL/CC/CCC file content string into structured data
 * 
 * Supports:
 * - .cdl (ColorDecisionList) - single or multiple ColorCorrection nodes
 * - .cc (ColorCorrection) - single correction
 * - .ccc (ColorCorrectionCollection) - multiple corrections
 */
export function parseCdlFile(content: string): CdlParseResult {
  const warnings: string[] = [];
  const cdls: CdlValues[] = [];
  
  // Detect format
  const format = detectFormat(content);
  
  if (format === 'unknown') {
    warnings.push('Could not detect CDL format - no ColorDecisionList, ColorCorrectionCollection, or ColorCorrection root element found');
    return { cdls, warnings, format };
  }
  
  // Extract all ColorCorrection blocks
  const blocks = extractColorCorrections(content);
  
  if (blocks.length === 0) {
    warnings.push('No ColorCorrection elements found in file');
    return { cdls, warnings, format };
  }
  
  // Parse each block
  for (let i = 0; i < blocks.length; i++) {
    const { cdl, warnings: blockWarnings } = parseColorCorrectionBlock(blocks[i], i);
    warnings.push(...blockWarnings);
    if (cdl) {
      cdls.push(cdl);
    }
  }
  
  return { cdls, warnings, format };
}

/**
 * Get the best identifier for a CDL (prefers description, falls back to id)
 */
export function getCdlIdentifier(cdl: CdlValues): string {
  return cdl.description || cdl.id || 'Unknown';
}

/**
 * Match a CDL to a clip name by checking if the CDL identifier contains the clip name
 * or vice versa (handles partial matches)
 */
export function matchCdlToClip(cdl: CdlValues, clipName: string): boolean {
  const cdlId = getCdlIdentifier(cdl).toLowerCase();
  const clip = clipName.toLowerCase();
  return cdlId.includes(clip) || clip.includes(cdlId);
}

/**
 * Format CDL values for display
 */
export function formatCdlForDisplay(cdl: CdlValues): {
  slope: string;
  offset: string;
  power: string;
  saturation: string;
} {
  const fmt = (n: number) => n.toFixed(4);
  return {
    slope: `${fmt(cdl.slopeR)} ${fmt(cdl.slopeG)} ${fmt(cdl.slopeB)}`,
    offset: `${fmt(cdl.offsetR)} ${fmt(cdl.offsetG)} ${fmt(cdl.offsetB)}`,
    power: `${fmt(cdl.powerR)} ${fmt(cdl.powerG)} ${fmt(cdl.powerB)}`,
    saturation: fmt(cdl.saturation),
  };
}
