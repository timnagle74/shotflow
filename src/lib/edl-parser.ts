/**
 * EDL Parser — CMX 3600 format (standard Avid/Resolve export)
 *
 * Handles:
 * - Event lines with event#, reel, track, edit type, 4x timecodes
 * - Comment lines (* FROM CLIP NAME, * SOURCE FILE, * EFFECT NAME, etc.)
 * - Drop-frame (;) and non-drop-frame (:) timecodes
 * - Audio/video track types
 * - Transition types (C=cut, D=dissolve, Wxxx=wipe, K=key)
 * - Speed changes noted in comments
 * - Malformed line tolerance with warnings
 */

export interface EDLEvent {
  eventNumber: number;
  reelName: string;
  trackType: string;
  editType: string;
  transitionDuration?: number; // frames, for dissolves/wipes
  sourceIn: string;
  sourceOut: string;
  recordIn: string;
  recordOut: string;
  clipName?: string;
  sourceFile?: string;
  comments: string[];
  frameStart: number;
  frameEnd: number;
  durationFrames: number;
}

export interface EDLParseResult {
  title: string;
  fcm: 'DROP_FRAME' | 'NON_DROP_FRAME' | 'UNKNOWN';
  events: EDLEvent[];
  warnings: ParseWarning[];
  totalEvents: number;
  videoEvents: number;
  audioEvents: number;
}

export interface ParseWarning {
  line: number;
  message: string;
  raw: string;
}

function timecodeToFrames(tc: string, fps: number = 24): number {
  const parts = tc.split(/[:;]/);
  if (parts.length !== 4) return 0;
  const [h, m, s, f] = parts.map(Number);
  if ([h, m, s, f].some(isNaN)) return 0;
  return h * 3600 * fps + m * 60 * fps + s * fps + f;
}

export function framesToTimecode(totalFrames: number, fps: number = 24): string {
  const h = Math.floor(totalFrames / (3600 * fps));
  const m = Math.floor((totalFrames % (3600 * fps)) / (60 * fps));
  const s = Math.floor((totalFrames % (60 * fps)) / fps);
  const f = totalFrames % fps;
  return [h, m, s, f].map(v => String(v).padStart(2, '0')).join(':');
}

/**
 * Parse a CMX 3600 EDL string.
 * Returns structured events plus any parse warnings.
 */
export function parseEDL(content: string, fps: number = 24): EDLParseResult {
  const rawLines = content.split(/\r?\n/);
  const warnings: ParseWarning[] = [];
  const events: EDLEvent[] = [];
  let title = '';
  let fcm: EDLParseResult['fcm'] = 'UNKNOWN';
  let currentEvent: Partial<EDLEvent> | null = null;

  // Regex for standard CMX 3600 event line
  // 001  REEL001  V  C        01:00:00:00 01:00:05:00 01:00:00:00 01:00:05:00
  // Also handles transitions: 002  REEL002  V  D 030  ...
  const eventRegex =
    /^(\d{3,6})\s+(\S+)\s+(V|A\d?|AA|B|AA\/V)\s+(C|D|W\d{3}|K|KB|KO)\s*(\d{3})?\s+(\d{2}:\d{2}:\d{2}[:;]\d{2})\s+(\d{2}:\d{2}:\d{2}[:;]\d{2})\s+(\d{2}:\d{2}:\d{2}[:;]\d{2})\s+(\d{2}:\d{2}:\d{2}[:;]\d{2})/;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trimEnd();
    const lineNum = i + 1;

    // Skip blank lines
    if (line.trim() === '') continue;

    // Title line
    const titleMatch = line.match(/^TITLE:\s*(.+)/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }

    // FCM (Frame Code Mode)
    const fcmMatch = line.match(/^FCM:\s*(DROP\s*FRAME|NON[\s-]*DROP\s*FRAME)/i);
    if (fcmMatch) {
      fcm = fcmMatch[1].toUpperCase().includes('NON') ? 'NON_DROP_FRAME' : 'DROP_FRAME';
      continue;
    }

    // Event line
    const eventMatch = line.match(eventRegex);
    if (eventMatch) {
      // Push previous event
      if (currentEvent && currentEvent.eventNumber !== undefined) {
        events.push(currentEvent as EDLEvent);
      }

      const sourceIn = eventMatch[6];
      const sourceOut = eventMatch[7];
      const frameStart = timecodeToFrames(sourceIn, fps);
      const frameEnd = timecodeToFrames(sourceOut, fps);

      currentEvent = {
        eventNumber: parseInt(eventMatch[1]),
        reelName: eventMatch[2],
        trackType: eventMatch[3],
        editType: eventMatch[4],
        transitionDuration: eventMatch[5] ? parseInt(eventMatch[5]) : undefined,
        sourceIn,
        sourceOut,
        recordIn: eventMatch[8],
        recordOut: eventMatch[9],
        frameStart,
        frameEnd,
        durationFrames: frameEnd - frameStart,
        comments: [],
      };
      continue;
    }

    // Comment lines (start with * or are indented metadata)
    if (line.startsWith('*') || line.startsWith('>>>')) {
      if (currentEvent) {
        // Extract specific metadata
        const clipMatch = line.match(/\*?\s*FROM CLIP NAME:\s*(.+)/i);
        if (clipMatch) {
          currentEvent.clipName = clipMatch[1].trim();
        }

        const sourceMatch = line.match(/\*?\s*SOURCE FILE:\s*(.+)/i);
        if (sourceMatch) {
          currentEvent.sourceFile = sourceMatch[1].trim();
        }

        // Store all comments
        if (!currentEvent.comments) currentEvent.comments = [];
        currentEvent.comments.push(line.replace(/^\*\s*/, '').trim());
      }
      continue;
    }

    // M2 speed change lines (e.g., M2   REEL001  024.0  01:00:00:00)
    if (line.match(/^M2\s+/)) {
      if (currentEvent) {
        if (!currentEvent.comments) currentEvent.comments = [];
        currentEvent.comments.push(`Speed: ${line.trim()}`);
      }
      continue;
    }

    // Lines that don't match anything known — skip silently for TITLE/header area,
    // warn if we're past the first event
    if (events.length > 0 || currentEvent) {
      // Only warn for non-blank, non-recognized lines after events start
      if (line.trim().length > 0 && !line.match(/^TITLE:|^FCM:|^\s*$/i)) {
        warnings.push({ line: lineNum, message: 'Unrecognized line format', raw: line });
      }
    }
  }

  // Push last event
  if (currentEvent && currentEvent.eventNumber !== undefined) {
    events.push(currentEvent as EDLEvent);
  }

  // Separate counts
  const videoEvents = events.filter(e => e.trackType === 'V');
  const audioEvents = events.filter(e => e.trackType.startsWith('A'));

  return {
    title,
    fcm,
    events,
    warnings,
    totalEvents: events.length,
    videoEvents: videoEvents.length,
    audioEvents: audioEvents.length,
  };
}

/**
 * Get only video events from an EDL parse result.
 */
export function getVideoEvents(result: EDLParseResult): EDLEvent[] {
  return result.events.filter(e => e.trackType === 'V');
}

/**
 * Generate a suggested shot code from an EDL event.
 */
export function suggestShotCode(event: EDLEvent, sequenceCode: string, index: number): string {
  const shotNum = (index + 1) * 10;
  return `${sequenceCode}_${String(shotNum).padStart(4, '0')}`;
}
