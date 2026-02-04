/**
 * FilmScribe XML Parser (Avid film finishing format)
 * 
 * Extracts: events (shots), locator comments (VFX markers), timecodes, scene/take metadata
 */

export interface FilmScribeEvent {
  eventNumber: number;
  type: string;              // "Cut", etc.
  length: number;            // frames
  
  // Master (record/sequence) timecodes
  recordIn: string;
  recordOut: string;
  recordInFrame: number;
  recordOutFrame: number;
  
  // Source clip info
  clipName: string | null;
  tapeName: string | null;
  tapeId: string | null;
  sourceIn: string | null;
  sourceOut: string | null;
  
  // Metadata
  scene: string | null;
  take: string | null;
  camera: string | null;
  comments: string | null;
  
  // Matched VFX data (populated after parsing from locators)
  vfxNotes: string[];
  vfxShotCode: string | null;      // Derived from marker: "044_0010"
  vfxDescription: string | null;   // Just the description part
}

export interface FilmScribeLocator {
  timecode: string;
  frame: number;
  text: string;
  clipName: string | null;
  color: string | null;
  sourceTimecode: string | null;  // Source TC from <Source><Timecode Type="Start TC">
  camera: string | null;          // Derived from clip name prefix (A, B, C, D, etc.)
  // Parsed from VFX ID in marker text (e.g., VFX_44_0010)
  vfxScene: string | null;      // "44"
  vfxSequence: string | null;   // "0010"
  vfxShotCode: string | null;   // "044_0010"
  vfxDescription: string | null; // "Clean up Line on Jades makeup"
}

export interface FilmScribeParseResult {
  format: 'filmscribe';
  title: string;
  tracks: string;
  eventCount: number;
  editRate: number;
  masterDuration: string | null;
  
  events: FilmScribeEvent[];
  locators: FilmScribeLocator[];
  
  // Stats
  eventsWithClips: number;
  eventsWithVfx: number;      // Events with VFX markers (these become shots)
  totalVfxMarkers: number;
  matchedVfxMarkers: number;
  
  warnings: string[];
}

/**
 * Parse timecode to frame number
 */
function tcToFrames(tc: string, fps: number = 24): number {
  if (!tc) return 0;
  const parts = tc.split(/[:;]/).map(Number);
  if (parts.length !== 4) return 0;
  const [hh, mm, ss, ff] = parts;
  return hh * 3600 * fps + mm * 60 * fps + ss * fps + ff;
}

/**
 * Check if this is a FilmScribe XML file
 */
export function isFilmScribeXML(content: string): boolean {
  return content.includes('<FilmScribeFile') || content.includes('<AssembleList>');
}

/**
 * Parse FilmScribe XML content
 */
export function parseFilmScribe(content: string): FilmScribeParseResult {
  const warnings: string[] = [];
  const events: FilmScribeEvent[] = [];
  const locators: FilmScribeLocator[] = [];
  
  // Extract header info
  const titleMatch = content.match(/<Title>([^<]*)<\/Title>/);
  const tracksMatch = content.match(/<Tracks>([^<]*)<\/Tracks>/);
  const eventCountMatch = content.match(/<EventCount>(\d+)<\/EventCount>/);
  const editRateMatch = content.match(/<EditRate>(\d+)<\/EditRate>/);
  const masterDurMatch = content.match(/<MasterDuration>[\s\S]*?<Timecode Type="TC1">([^<]*)<\/Timecode>/);
  
  const title = titleMatch?.[1] || 'Unknown';
  const tracks = tracksMatch?.[1] || 'V1';
  const eventCount = parseInt(eventCountMatch?.[1] || '0', 10);
  const editRate = parseInt(editRateMatch?.[1] || '24', 10);
  const masterDuration = masterDurMatch?.[1] || null;
  
  // Parse Events (handle attributes in any order)
  const eventRegex = /<Event Num="(\d+)"[^>]*Type="([^"]*)"[^>]*Length="(\d+)"[^>]*>([\s\S]*?)<\/Event>/g;
  let eventMatch;
  
  while ((eventMatch = eventRegex.exec(content)) !== null) {
    const [, numStr, type, lengthStr, eventContent] = eventMatch;
    
    // Master timecodes
    const masterBlock = eventContent.match(/<Master>([\s\S]*?)<\/Master>/)?.[1] || '';
    const recInMatch = masterBlock.match(/<Start>[\s\S]*?<Timecode Type="TC1">([^<]*)<\/Timecode>/);
    const recOutMatch = masterBlock.match(/<End>[\s\S]*?<Timecode Type="TC1">([^<]*)<\/Timecode>/);
    const recInFrameMatch = masterBlock.match(/<Start>[\s\S]*?<Frame>(\d+)<\/Frame>/);
    const recOutFrameMatch = masterBlock.match(/<End>[\s\S]*?<Frame>(\d+)<\/Frame>/);
    
    // Source info
    const sourceBlock = eventContent.match(/<Source>([\s\S]*?)<\/Source>/)?.[1] || '';
    const clipNameMatch = sourceBlock.match(/<ClipName>([^<]*)<\/ClipName>/);
    const tapeNameMatch = sourceBlock.match(/<TapeName>([^<]*)<\/TapeName>/);
    const tapeIdMatch = sourceBlock.match(/<Custom Name="TapeID">([^<]*)<\/Custom>/);
    const srcInMatch = sourceBlock.match(/<Start>[\s\S]*?<Timecode Type="Start TC">([^<]*)<\/Timecode>/);
    const srcOutMatch = sourceBlock.match(/<End>[\s\S]*?<Timecode Type="Start TC">([^<]*)<\/Timecode>/);
    
    // Metadata
    const sceneMatch = sourceBlock.match(/<Custom Name="SCENE">([^<]*)<\/Custom>/);
    const takeMatch = sourceBlock.match(/<Custom Name="TAKE">([^<]*)<\/Custom>/);
    const cameraMatch = sourceBlock.match(/<Custom Name="CAMERA">([^<]*)<\/Custom>/);
    const commentsMatch = sourceBlock.match(/<Custom Name="Comments">([^<]*)<\/Custom>/);
    
    const event: FilmScribeEvent = {
      eventNumber: parseInt(numStr, 10),
      type,
      length: parseInt(lengthStr, 10),
      recordIn: recInMatch?.[1] || '',
      recordOut: recOutMatch?.[1] || '',
      recordInFrame: parseInt(recInFrameMatch?.[1] || '0', 10),
      recordOutFrame: parseInt(recOutFrameMatch?.[1] || '0', 10),
      clipName: clipNameMatch?.[1] || null,
      tapeName: tapeNameMatch?.[1] || null,
      tapeId: tapeIdMatch?.[1] || null,
      sourceIn: srcInMatch?.[1] || null,
      sourceOut: srcOutMatch?.[1] || null,
      scene: sceneMatch?.[1] || null,
      take: takeMatch?.[1] || null,
      camera: cameraMatch?.[1] || null,
      comments: commentsMatch?.[1] || null,
      vfxNotes: [],
      vfxShotCode: null,
      vfxDescription: null,
    };
    
    events.push(event);
  }
  
  // Parse Locators (VFX markers)
  const locatorRegex = /<Comment Type="Locator">([\s\S]*?)<\/Comment>/g;
  let locMatch;
  
  while ((locMatch = locatorRegex.exec(content)) !== null) {
    const locContent = locMatch[1];
    
    const tcMatch = locContent.match(/<Master>[\s\S]*?<Timecode Type="TC1">([^<]*)<\/Timecode>/);
    const frameMatch = locContent.match(/<Master>[\s\S]*?<Frame>(\d+)<\/Frame>/);
    const textMatch = locContent.match(/<Text>([^<]*)<\/Text>/);
    const clipMatch = locContent.match(/<ClipName>([^<]*)<\/ClipName>/);
    const colorMatch = locContent.match(/<Color>([^<]*)<\/Color>/);
    const srcTcMatch = locContent.match(/<Source>[\s\S]*?<Timecode Type="Start TC">([^<]*)<\/Timecode>/);
    
    // Derive camera from clip name prefix (e.g., A_0111C003 → "A", B_0111C013 → "B", D011C0002 → "D")
    const clipName = clipMatch?.[1] || null;
    const cameraFromClip = clipName?.match(/^([A-Z])[\s_]/)?.[1] || clipName?.match(/^([A-Z])\d/)?.[1] || null;
    
    if (textMatch) {
      const markerText = textMatch[1];
      
      // Parse VFX ID from marker text: "VFX_44_0010 - Description" or "VFX 05_0010 - Description"
      const vfxMatch = markerText.match(/^VFX[_ ]?(\d+)[_ ](\d+)\s*[-–—]?\s*(.*)/i);
      
      let vfxScene: string | null = null;
      let vfxSequence: string | null = null;
      let vfxShotCode: string | null = null;
      let vfxDescription: string | null = null;
      
      if (vfxMatch) {
        vfxScene = vfxMatch[1];
        vfxSequence = vfxMatch[2];
        // Pad scene to 3 digits, keep sequence as-is (already 4 digits)
        vfxShotCode = `${vfxScene}_${vfxSequence}`;
        vfxDescription = vfxMatch[3]?.trim() || null;
      }
      
      locators.push({
        timecode: tcMatch?.[1] || '',
        frame: parseInt(frameMatch?.[1] || '0', 10),
        text: markerText,
        clipName: clipName,
        color: colorMatch?.[1] || null,
        sourceTimecode: srcTcMatch?.[1] || null,
        camera: cameraFromClip,
        vfxScene,
        vfxSequence,
        vfxShotCode,
        vfxDescription,
      });
    }
  }
  
  // Match locators to events by timecode
  let matchedCount = 0;
  for (const locator of locators) {
    // Find event where locator TC falls within record range
    const locFrame = locator.frame || tcToFrames(locator.timecode, editRate);
    
    for (const event of events) {
      if (locFrame >= event.recordInFrame && locFrame <= event.recordOutFrame) {
        event.vfxNotes.push(locator.text);
        // Set VFX shot code and description from the first matched locator
        if (!event.vfxShotCode && locator.vfxShotCode) {
          event.vfxShotCode = locator.vfxShotCode;
          event.vfxDescription = locator.vfxDescription;
        }
        matchedCount++;
        break;
      }
    }
  }
  
  // Count events with actual clips and VFX markers
  const eventsWithClips = events.filter(e => e.clipName !== null && !e.clipName?.startsWith('Opt')).length;
  
  // eventsWithVfx: either from events (if they have clips) or from locators (fallback)
  let eventsWithVfx: number;
  if (eventsWithClips > 0) {
    // Events have clips — count events with VFX markers
    eventsWithVfx = events.filter(e => e.clipName !== null && e.vfxShotCode !== null && !e.clipName?.startsWith('Opt')).length;
  } else {
    // Events don't have clips — count locators with VFX codes (these become shots)
    eventsWithVfx = locators.filter(l => l.vfxShotCode !== null && l.clipName !== null && !l.clipName?.startsWith('Opt')).length;
  }
  
  if (events.length !== eventCount) {
    warnings.push(`Expected ${eventCount} events, found ${events.length}`);
  }
  
  return {
    format: 'filmscribe',
    title,
    tracks,
    eventCount: events.length,
    editRate,
    masterDuration,
    events,
    locators,
    eventsWithClips,
    eventsWithVfx,
    totalVfxMarkers: locators.length,
    matchedVfxMarkers: matchedCount,
    warnings,
  };
}

/**
 * Convert FilmScribe events to shot import format
 * 
 * Handles two cases:
 * 1. Events have clips → use events with matched VFX markers
 * 2. Events don't have clips → use locators directly as shots (fallback)
 */
export function filmScribeToShots(result: FilmScribeParseResult): Array<{
  code: string;
  clipName: string | null;
  cameraRoll: string | null;
  sourceIn: string | null;
  sourceOut: string | null;
  recordIn: string | null;
  recordOut: string | null;
  durationFrames: number;
  vfxNotes: string | null;
  scene: string | null;
  take: string | null;
  camera: string | null;
}> {
  // Check if events have clips (REEL03 style)
  const eventsWithClips = result.events.filter(e => e.clipName !== null && !e.clipName.startsWith('Opt'));
  
  if (eventsWithClips.length > 0) {
    // Case 1: Events have clips — use existing logic
    return result.events
      .filter(e => e.clipName !== null && e.vfxShotCode !== null && !e.clipName.startsWith('Opt'))
      .map(event => ({
        code: event.vfxShotCode!,
        clipName: event.clipName,
        cameraRoll: event.tapeId || event.tapeName,
        sourceIn: event.sourceIn,
        sourceOut: event.sourceOut,
        recordIn: event.recordIn,
        recordOut: event.recordOut,
        durationFrames: event.length,
        vfxNotes: event.vfxDescription || (event.vfxNotes.length > 0 ? event.vfxNotes.join('\n') : null),
        scene: event.scene,
        take: event.take,
        camera: event.camera,
      }));
  }
  
  // Case 2: Events don't have clips — build shots from locators directly (REEL01 style)
  // Each locator with a VFX code becomes a shot
  // Find the matching event to get duration
  return result.locators
    .filter(loc => loc.vfxShotCode !== null && loc.clipName !== null && !loc.clipName.startsWith('Opt'))
    .map(locator => {
      // Find the enclosing event to get duration
      const locFrame = locator.frame || tcToFrames(locator.timecode, result.editRate);
      const matchingEvent = result.events.find(
        e => locFrame >= e.recordInFrame && locFrame <= e.recordOutFrame
      );
      
      return {
        code: locator.vfxShotCode!,
        clipName: locator.clipName,
        cameraRoll: null,
        sourceIn: locator.sourceTimecode || null,
        sourceOut: null,
        recordIn: locator.timecode,
        recordOut: matchingEvent?.recordOut || null,
        durationFrames: matchingEvent?.length || 0,
        vfxNotes: locator.vfxDescription,
        scene: locator.vfxScene,
        take: null,
        camera: locator.camera,
      };
    });
}
