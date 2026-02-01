/**
 * Premiere Pro / FCP XML Parser (xmeml format)
 * 
 * Extracts: clips, timecodes, reposition, speed changes, CDL, scene/take metadata
 */

export interface XMLClipTransform {
  scale: number | null;        // percentage (100 = no scale)
  scaleX: number | null;       // if non-uniform
  scaleY: number | null;
  positionX: number | null;    // pixels from center
  positionY: number | null;
  rotation: number | null;     // degrees
  anchorX: number | null;
  anchorY: number | null;
}

export interface XMLClipSpeed {
  speedRatio: number | null;   // 1.0 = 100%, 0.5 = 50% (slow-mo)
  reverse: boolean;
  timeRemapping: boolean;      // if variable speed
}

export interface XMLClipCDL {
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

export interface XMLClip {
  id: string;
  name: string;                 // VFX shot name (e.g., 006_050_bg1_v1)
  sourceFileName: string | null;
  sourceFilePath: string | null;
  
  // Timecode info
  duration: number;             // frames
  start: number;                // record timeline position (frames)
  end: number;
  inPoint: number;              // source in
  outPoint: number;             // source out
  sourceTimecode: string | null;
  sourceTimecodeFrame: number | null;
  fps: number;
  
  // Metadata from XML
  scene: string | null;
  take: string | null;
  cameraRoll: string | null;
  reelName: string | null;
  label: string | null;
  description: string | null;
  
  // Transform/Reposition
  transform: XMLClipTransform | null;
  hasReposition: boolean;
  
  // Speed
  speed: XMLClipSpeed | null;
  hasSpeedChange: boolean;
  
  // CDL
  cdl: XMLClipCDL | null;
  hasCDL: boolean;
}

export interface XMLSequence {
  id: string;
  name: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
  clips: XMLClip[];
}

export interface XMLParseResult {
  format: 'premiere' | 'fcp7' | 'resolve' | 'unknown';
  version: string | null;
  sequences: XMLSequence[];
  totalClips: number;
  clipsWithReposition: number;
  clipsWithSpeedChange: number;
  clipsWithCDL: number;
  warnings: string[];
}

/**
 * Parse xmeml XML content (Premiere Pro / FCP7 format)
 */
export function parseXML(content: string): XMLParseResult {
  const warnings: string[] = [];
  const sequences: XMLSequence[] = [];
  
  // Parse XML using DOMParser (browser) or a simple regex fallback
  let doc: Document;
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    doc = parser.parseFromString(content, 'application/xml');
    
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      warnings.push(`XML parse error: ${parseError.textContent?.slice(0, 100)}`);
      return {
        format: 'unknown',
        version: null,
        sequences: [],
        totalClips: 0,
        clipsWithReposition: 0,
        clipsWithSpeedChange: 0,
        clipsWithCDL: 0,
        warnings,
      };
    }
  } else {
    // Server-side: use a simple approach
    warnings.push('DOMParser not available, using regex fallback');
    return parseXMLRegex(content);
  }
  
  // Detect format
  const xmeml = doc.querySelector('xmeml');
  const version = xmeml?.getAttribute('version') || null;
  let format: XMLParseResult['format'] = 'unknown';
  
  if (content.includes('PremierePro') || content.includes('Adobe Premiere')) {
    format = 'premiere';
  } else if (content.includes('Final Cut Pro')) {
    format = 'fcp7';
  } else if (content.includes('DaVinci Resolve')) {
    format = 'resolve';
  } else if (xmeml) {
    format = 'fcp7'; // Generic xmeml is FCP7 format
  }
  
  // Parse sequences
  const sequenceNodes = doc.querySelectorAll('sequence');
  
  sequenceNodes.forEach((seqNode, seqIndex) => {
    const sequence = parseSequence(seqNode, seqIndex, warnings);
    if (sequence) {
      sequences.push(sequence);
    }
  });
  
  // Calculate stats
  let totalClips = 0;
  let clipsWithReposition = 0;
  let clipsWithSpeedChange = 0;
  let clipsWithCDL = 0;
  
  for (const seq of sequences) {
    totalClips += seq.clips.length;
    clipsWithReposition += seq.clips.filter(c => c.hasReposition).length;
    clipsWithSpeedChange += seq.clips.filter(c => c.hasSpeedChange).length;
    clipsWithCDL += seq.clips.filter(c => c.hasCDL).length;
  }
  
  return {
    format,
    version,
    sequences,
    totalClips,
    clipsWithReposition,
    clipsWithSpeedChange,
    clipsWithCDL,
    warnings,
  };
}

function parseSequence(node: Element, index: number, warnings: string[]): XMLSequence | null {
  const id = node.getAttribute('id') || `sequence-${index}`;
  const name = getTextContent(node, 'name') || `Sequence ${index + 1}`;
  const duration = parseInt(getTextContent(node, 'duration') || '0', 10);
  
  // Get rate/fps
  const rateNode = node.querySelector(':scope > rate');
  const timebase = parseInt(getTextContent(rateNode, 'timebase') || '24', 10);
  const ntsc = getTextContent(rateNode, 'ntsc')?.toUpperCase() === 'TRUE';
  const fps = ntsc ? timebase * 1000 / 1001 : timebase;
  
  // Get format dimensions
  const formatNode = node.querySelector('media > video > format > samplecharacteristics');
  const width = parseInt(getTextContent(formatNode, 'width') || '1920', 10);
  const height = parseInt(getTextContent(formatNode, 'height') || '1080', 10);
  
  // Parse clips from video tracks
  const clips: XMLClip[] = [];
  const clipNodes = node.querySelectorAll('media > video > track > clipitem');
  
  clipNodes.forEach((clipNode, clipIndex) => {
    const clip = parseClipItem(clipNode, clipIndex, fps, warnings);
    if (clip) {
      clips.push(clip);
    }
  });
  
  return {
    id,
    name,
    duration,
    fps,
    width,
    height,
    clips,
  };
}

function parseClipItem(node: Element, index: number, fps: number, warnings: string[]): XMLClip | null {
  const id = node.getAttribute('id') || `clip-${index}`;
  const name = getTextContent(node, 'name') || '';
  
  if (!name) {
    warnings.push(`Clip ${index}: missing name, skipping`);
    return null;
  }
  
  // Basic timing
  const duration = parseInt(getTextContent(node, 'duration') || '0', 10);
  const start = parseInt(getTextContent(node, 'start') || '0', 10);
  const end = parseInt(getTextContent(node, 'end') || '0', 10);
  const inPoint = parseInt(getTextContent(node, 'in') || '0', 10);
  const outPoint = parseInt(getTextContent(node, 'out') || '0', 10);
  
  // Source file info
  const fileNode = node.querySelector('file');
  const sourceFileName = getTextContent(fileNode, 'name') || null;
  const sourceFilePath = getTextContent(fileNode, 'pathurl') || null;
  
  // Source timecode
  const tcNode = fileNode?.querySelector('timecode');
  const sourceTimecode = getTextContent(tcNode, 'string') || null;
  const sourceTimecodeFrame = parseInt(getTextContent(tcNode, 'frame') || '0', 10) || null;
  
  // Logging info (scene, take)
  const loggingNode = node.querySelector('logginginfo');
  const scene = getTextContent(loggingNode, 'scene') || null;
  const shotTake = getTextContent(loggingNode, 'shottake') || null;
  const description = getTextContent(loggingNode, 'description') || null;
  
  // Film data (camera roll)
  const filmNode = node.querySelector('filmdata');
  const cameraRoll = getTextContent(filmNode, 'cameraroll') || null;
  
  // Reel name from timecode
  const reelName = getTextContent(tcNode?.querySelector('reel'), 'name') || null;
  
  // Label
  const label = getTextContent(node.querySelector('labels'), 'label2') || null;
  
  // Parse CDL from colorinfo
  const colorNode = node.querySelector('colorinfo');
  const cdl = parseCDL(colorNode);
  const hasCDL = cdl !== null && (
    cdl.slopeR !== 1 || cdl.slopeG !== 1 || cdl.slopeB !== 1 ||
    cdl.offsetR !== 0 || cdl.offsetG !== 0 || cdl.offsetB !== 0 ||
    cdl.powerR !== 1 || cdl.powerG !== 1 || cdl.powerB !== 1 ||
    cdl.saturation !== 1
  );
  
  // Parse transform/reposition from filters
  const transform = parseTransformFilters(node);
  const hasReposition = transform !== null && (
    transform.scale !== 100 ||
    transform.positionX !== 0 ||
    transform.positionY !== 0 ||
    transform.rotation !== 0
  );
  
  // Parse speed from filters or rate
  const speed = parseSpeedFilters(node, fps);
  const hasSpeedChange = speed !== null && (
    speed.speedRatio !== 1 ||
    speed.reverse ||
    speed.timeRemapping
  );
  
  return {
    id,
    name,
    sourceFileName,
    sourceFilePath,
    duration,
    start,
    end,
    inPoint,
    outPoint,
    sourceTimecode,
    sourceTimecodeFrame,
    fps,
    scene,
    take: shotTake,
    cameraRoll,
    reelName,
    label,
    description,
    transform,
    hasReposition,
    speed,
    hasSpeedChange,
    cdl,
    hasCDL,
  };
}

function parseCDL(colorNode: Element | null): XMLClipCDL | null {
  if (!colorNode) return null;
  
  const sopString = getTextContent(colorNode, 'asc_sop');
  const satString = getTextContent(colorNode, 'asc_sat');
  
  if (!sopString) return null;
  
  // Parse SOP: (slope_r slope_g slope_b)(offset_r offset_g offset_b)(power_r power_g power_b)
  const match = sopString.match(
    /\(\s*([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s*\)\s*\(\s*([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s*\)\s*\(\s*([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s*\)/
  );
  
  if (!match) return null;
  
  return {
    slopeR: parseFloat(match[1]),
    slopeG: parseFloat(match[2]),
    slopeB: parseFloat(match[3]),
    offsetR: parseFloat(match[4]),
    offsetG: parseFloat(match[5]),
    offsetB: parseFloat(match[6]),
    powerR: parseFloat(match[7]),
    powerG: parseFloat(match[8]),
    powerB: parseFloat(match[9]),
    saturation: satString ? parseFloat(satString) : 1.0,
  };
}

function parseTransformFilters(clipNode: Element): XMLClipTransform | null {
  // Look for motion/transform filters on the clipitem
  const filters = clipNode.querySelectorAll(':scope > filter > effect');
  
  for (const effect of Array.from(filters)) {
    const effectName = getTextContent(effect, 'name')?.toLowerCase() || '';
    const effectId = getTextContent(effect, 'effectid')?.toLowerCase() || '';
    
    // Premiere: "Basic Motion" or effectid "basic"
    // FCP7: "Motion" or effectid "motion"
    if (effectName.includes('motion') || effectId === 'basic' || effectId === 'motion') {
      const transform: XMLClipTransform = {
        scale: 100,
        scaleX: null,
        scaleY: null,
        positionX: 0,
        positionY: 0,
        rotation: 0,
        anchorX: null,
        anchorY: null,
      };
      
      const params = effect.querySelectorAll('parameter');
      for (const param of Array.from(params)) {
        const paramName = getTextContent(param, 'name')?.toLowerCase() || '';
        const valueStr = getTextContent(param, 'value') || '';
        
        // Premiere stores values as: "ticks,value,..." — extract the actual value
        const value = parseParameterValue(valueStr);
        
        if (paramName.includes('scale') && !paramName.includes('height') && !paramName.includes('width')) {
          transform.scale = value;
        } else if (paramName.includes('position')) {
          // Position is often "x y" or separate params
          if (paramName.includes('x') || paramName === 'position') {
            transform.positionX = value;
          }
          if (paramName.includes('y')) {
            transform.positionY = value;
          }
        } else if (paramName.includes('rotation')) {
          transform.rotation = value;
        }
      }
      
      return transform;
    }
  }
  
  return null;
}

function parseSpeedFilters(clipNode: Element, fps: number): XMLClipSpeed | null {
  // Check for speed filter
  const filters = clipNode.querySelectorAll(':scope > filter > effect');
  
  for (const effect of Array.from(filters)) {
    const effectName = getTextContent(effect, 'name')?.toLowerCase() || '';
    const effectId = getTextContent(effect, 'effectid')?.toLowerCase() || '';
    
    if (effectName.includes('speed') || effectName.includes('time remap') || 
        effectId.includes('speed') || effectId.includes('timeremap')) {
      const speed: XMLClipSpeed = {
        speedRatio: 1.0,
        reverse: false,
        timeRemapping: effectName.includes('remap') || effectId.includes('remap'),
      };
      
      const params = effect.querySelectorAll('parameter');
      for (const param of Array.from(params)) {
        const paramName = getTextContent(param, 'name')?.toLowerCase() || '';
        const valueStr = getTextContent(param, 'value') || '';
        const value = parseParameterValue(valueStr);
        
        if (paramName.includes('speed') || paramName.includes('rate')) {
          speed.speedRatio = value / 100; // Convert percentage to ratio
        } else if (paramName.includes('reverse')) {
          speed.reverse = value !== 0;
        }
      }
      
      return speed;
    }
  }
  
  // Check for rate override on clip (simpler speed change)
  const clipRate = clipNode.querySelector(':scope > rate > timebase');
  const fileRate = clipNode.querySelector('file > rate > timebase');
  
  if (clipRate && fileRate) {
    const clipFps = parseInt(clipRate.textContent || '24', 10);
    const fileFps = parseInt(fileRate.textContent || '24', 10);
    
    if (clipFps !== fileFps) {
      return {
        speedRatio: fileFps / clipFps,
        reverse: false,
        timeRemapping: false,
      };
    }
  }
  
  return null;
}

function parseParameterValue(valueStr: string): number {
  // Premiere format: "-91445760000000000,110.5,0,0,0,0,0,0" — value is second element
  // FCP7 format: just the number or "110.5"
  
  if (valueStr.includes(',')) {
    const parts = valueStr.split(',');
    if (parts.length >= 2) {
      return parseFloat(parts[1]) || 0;
    }
  }
  
  return parseFloat(valueStr) || 0;
}

function getTextContent(parent: Element | null | undefined, tagName: string): string | null {
  if (!parent) return null;
  const el = parent.querySelector(`:scope > ${tagName}`);
  return el?.textContent?.trim() || null;
}

/**
 * Regex fallback for server-side parsing (simplified)
 */
function parseXMLRegex(content: string): XMLParseResult {
  const warnings: string[] = ['Using regex fallback parser'];
  const clips: XMLClip[] = [];
  
  // Extract clipitems with basic regex
  const clipRegex = /<clipitem[^>]*id="([^"]*)"[\s\S]*?<name>([^<]*)<\/name>[\s\S]*?<duration>(\d+)<\/duration>[\s\S]*?<start>(\d+)<\/start>[\s\S]*?<end>(\d+)<\/end>[\s\S]*?<in>(\d+)<\/in>[\s\S]*?<out>(\d+)<\/out>[\s\S]*?<\/clipitem>/g;
  
  let match;
  let index = 0;
  while ((match = clipRegex.exec(content)) !== null) {
    clips.push({
      id: match[1],
      name: match[2],
      sourceFileName: null,
      sourceFilePath: null,
      duration: parseInt(match[3], 10),
      start: parseInt(match[4], 10),
      end: parseInt(match[5], 10),
      inPoint: parseInt(match[6], 10),
      outPoint: parseInt(match[7], 10),
      sourceTimecode: null,
      sourceTimecodeFrame: null,
      fps: 24,
      scene: null,
      take: null,
      cameraRoll: null,
      reelName: null,
      label: null,
      description: null,
      transform: null,
      hasReposition: false,
      speed: null,
      hasSpeedChange: false,
      cdl: null,
      hasCDL: false,
    });
    index++;
  }
  
  // Extract sequence info
  const seqNameMatch = content.match(/<sequence[^>]*>[\s\S]*?<name>([^<]*)<\/name>/);
  const seqName = seqNameMatch?.[1] || 'Unknown Sequence';
  
  return {
    format: 'premiere',
    version: null,
    sequences: [{
      id: 'sequence-1',
      name: seqName,
      duration: 0,
      fps: 24,
      width: 1920,
      height: 1080,
      clips,
    }],
    totalClips: clips.length,
    clipsWithReposition: 0,
    clipsWithSpeedChange: 0,
    clipsWithCDL: 0,
    warnings,
  };
}

/**
 * Match an XML clip to source media by filename and timecode
 */
export function matchClipToSourceMedia(
  clip: XMLClip,
  sourceMedia: Array<{ id: string; clipName: string; tcIn: number; tcOut: number }>
): string | null {
  // Try exact filename match first
  const exactMatch = sourceMedia.find(sm => 
    sm.clipName === clip.sourceFileName ||
    sm.clipName === clip.name
  );
  if (exactMatch) return exactMatch.id;
  
  // Try filename without extension
  const clipBase = clip.sourceFileName?.replace(/\.[^.]+$/, '') || clip.name.replace(/\.[^.]+$/, '');
  const baseMatch = sourceMedia.find(sm => {
    const smBase = sm.clipName.replace(/\.[^.]+$/, '');
    return smBase === clipBase;
  });
  if (baseMatch) return baseMatch.id;
  
  // Try timecode range overlap (if clip falls within source range)
  if (clip.sourceTimecodeFrame) {
    const tcMatch = sourceMedia.find(sm =>
      clip.sourceTimecodeFrame! >= sm.tcIn &&
      clip.sourceTimecodeFrame! <= sm.tcOut
    );
    if (tcMatch) return tcMatch.id;
  }
  
  return null;
}
