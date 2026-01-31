/**
 * EDL Export - Generate CMX 3600 EDL from shot data
 */

export interface EDLExportShot {
  code: string;
  clipName?: string | null;
  sourceIn?: string | null;
  sourceOut?: string | null;
  recordIn?: string | null;
  recordOut?: string | null;
  reelName?: string | null;
}

export interface EDLExportOptions {
  title: string;
  fps?: number;
  dropFrame?: boolean;
}

/**
 * Generate a timecode string from frame number
 */
function framesToTimecode(frames: number, fps: number = 24, dropFrame: boolean = false): string {
  const totalSeconds = Math.floor(frames / fps);
  const remainingFrames = frames % fps;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  const sep = dropFrame ? ';' : ':';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}${sep}${String(remainingFrames).padStart(2, '0')}`;
}

/**
 * Generate CMX 3600 EDL content
 */
export function generateEDL(shots: EDLExportShot[], options: EDLExportOptions): string {
  const { title, fps = 24, dropFrame = false } = options;
  const lines: string[] = [];
  
  // Header
  lines.push(`TITLE: ${title}`);
  lines.push(`FCM: ${dropFrame ? 'DROP FRAME' : 'NON-DROP FRAME'}`);
  lines.push('');
  
  // Generate events
  let eventNumber = 1;
  let recordPosition = 0; // Running record position in frames
  
  for (const shot of shots) {
    const eventNum = String(eventNumber).padStart(3, '0');
    const reelName = (shot.reelName || shot.clipName || 'AX').substring(0, 8).padEnd(8, ' ');
    
    // Calculate timecodes
    const sourceIn = shot.sourceIn || framesToTimecode(0, fps, dropFrame);
    const sourceOut = shot.sourceOut || framesToTimecode(100, fps, dropFrame);
    const recordIn = shot.recordIn || framesToTimecode(recordPosition, fps, dropFrame);
    const recordOut = shot.recordOut || framesToTimecode(recordPosition + 100, fps, dropFrame);
    
    // Main event line
    // Format: ### REEL V C SRCIN SRCOUT RECIN RECOUT
    lines.push(`${eventNum}  ${reelName} V     C        ${sourceIn} ${sourceOut} ${recordIn} ${recordOut}`);
    
    // Clip name comment
    if (shot.clipName || shot.code) {
      lines.push(`* FROM CLIP NAME: ${shot.clipName || shot.code}`);
    }
    
    lines.push('');
    eventNumber++;
    recordPosition += 100; // Advance record position
  }
  
  return lines.join('\n');
}

/**
 * Download EDL as file
 */
export function downloadEDL(shots: EDLExportShot[], options: EDLExportOptions): void {
  const content = generateEDL(shots, options);
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${options.title.replace(/[^a-zA-Z0-9]/g, '_')}.edl`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
