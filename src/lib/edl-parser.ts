export interface EDLEvent {
  eventNumber: number;
  reelName: string;
  trackType: string;
  editType: string;
  sourceIn: string;
  sourceOut: string;
  recordIn: string;
  recordOut: string;
  clipName?: string;
  sourceFile?: string;
  frameStart: number;
  frameEnd: number;
}

function timecodeToFrames(tc: string, fps: number = 24): number {
  const parts = tc.split(/[:;]/);
  if (parts.length !== 4) return 0;
  const [h, m, s, f] = parts.map(Number);
  return h * 3600 * fps + m * 60 * fps + s * fps + f;
}

export function parseEDL(content: string): EDLEvent[] {
  const lines = content.split('\n').map(l => l.trim());
  const events: EDLEvent[] = [];
  let currentEvent: Partial<EDLEvent> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Event line: 001  REEL001  V  C  01:00:00:00 01:00:05:00 01:00:00:00 01:00:05:00
    const eventMatch = line.match(
      /^(\d{3,})\s+(\S+)\s+(V|A\d?|AA)\s+(C|D|W\d+|K)\s+(\d{2}:\d{2}:\d{2}[:;]\d{2})\s+(\d{2}:\d{2}:\d{2}[:;]\d{2})\s+(\d{2}:\d{2}:\d{2}[:;]\d{2})\s+(\d{2}:\d{2}:\d{2}[:;]\d{2})/
    );

    if (eventMatch) {
      if (currentEvent && currentEvent.eventNumber !== undefined) {
        events.push(currentEvent as EDLEvent);
      }

      const sourceIn = eventMatch[5];
      const sourceOut = eventMatch[6];

      currentEvent = {
        eventNumber: parseInt(eventMatch[1]),
        reelName: eventMatch[2],
        trackType: eventMatch[3],
        editType: eventMatch[4],
        sourceIn,
        sourceOut,
        recordIn: eventMatch[7],
        recordOut: eventMatch[8],
        frameStart: timecodeToFrames(sourceIn),
        frameEnd: timecodeToFrames(sourceOut),
      };
    }

    // FROM CLIP NAME or * FROM CLIP NAME
    if (currentEvent) {
      const clipMatch = line.match(/\*?\s*FROM CLIP NAME:\s*(.+)/i);
      if (clipMatch) {
        currentEvent.clipName = clipMatch[1].trim();
      }

      const sourceMatch = line.match(/\*?\s*SOURCE FILE:\s*(.+)/i);
      if (sourceMatch) {
        currentEvent.sourceFile = sourceMatch[1].trim();
      }
    }
  }

  if (currentEvent && currentEvent.eventNumber !== undefined) {
    events.push(currentEvent as EDLEvent);
  }

  // Filter to video events only
  return events.filter(e => e.trackType === 'V');
}
