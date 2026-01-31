/**
 * FCP XML Export - Generate Final Cut Pro XML from shot data
 * Uses FCP XML 1.9 format (widely compatible with Resolve, Premiere, etc.)
 */

export interface XMLExportShot {
  id: string;
  code: string;
  clipName?: string | null;
  sourceIn?: string | null;
  sourceOut?: string | null;
  recordIn?: string | null;
  recordOut?: string | null;
  durationFrames?: number | null;
  filePath?: string | null;
}

export interface XMLExportOptions {
  title: string;
  fps?: number;
  width?: number;
  height?: number;
}

/**
 * Convert timecode string to frame count
 */
function timecodeToFrames(tc: string, fps: number): number {
  const parts = tc.replace(';', ':').split(':').map(Number);
  if (parts.length !== 4) return 0;
  const [h, m, s, f] = parts;
  return (h * 3600 + m * 60 + s) * fps + f;
}

/**
 * Generate FCP XML content
 */
export function generateFCPXML(shots: XMLExportShot[], options: XMLExportOptions): string {
  const { title, fps = 24, width = 1920, height = 1080 } = options;
  const timebase = fps;
  const ntsc = fps === 29.97 || fps === 23.976 ? 'TRUE' : 'FALSE';
  
  // Calculate total duration
  let totalDuration = 0;
  for (const shot of shots) {
    if (shot.durationFrames) {
      totalDuration += shot.durationFrames;
    } else if (shot.recordIn && shot.recordOut) {
      totalDuration += timecodeToFrames(shot.recordOut, fps) - timecodeToFrames(shot.recordIn, fps);
    } else {
      totalDuration += 100; // Default 100 frames
    }
  }
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
  <project>
    <name>${escapeXML(title)}</name>
    <children>
      <sequence>
        <name>${escapeXML(title)}</name>
        <duration>${totalDuration}</duration>
        <rate>
          <timebase>${timebase}</timebase>
          <ntsc>${ntsc}</ntsc>
        </rate>
        <media>
          <video>
            <format>
              <samplecharacteristics>
                <width>${width}</width>
                <height>${height}</height>
                <pixelaspectratio>square</pixelaspectratio>
                <rate>
                  <timebase>${timebase}</timebase>
                  <ntsc>${ntsc}</ntsc>
                </rate>
              </samplecharacteristics>
            </format>
            <track>
`;

  // Add clips to track
  let recordStart = 0;
  for (const shot of shots) {
    const duration = shot.durationFrames || 100;
    const sourceStart = shot.sourceIn ? timecodeToFrames(shot.sourceIn, fps) : 0;
    const sourceEnd = shot.sourceOut ? timecodeToFrames(shot.sourceOut, fps) : sourceStart + duration;
    const clipDuration = sourceEnd - sourceStart;
    
    xml += `              <clipitem>
                <name>${escapeXML(shot.code)}</name>
                <duration>${clipDuration}</duration>
                <start>${recordStart}</start>
                <end>${recordStart + clipDuration}</end>
                <in>${sourceStart}</in>
                <out>${sourceEnd}</out>
                <masterclipid>${escapeXML(shot.id)}</masterclipid>
                <file id="${escapeXML(shot.id)}">
                  <name>${escapeXML(shot.clipName || shot.code)}</name>
                  <pathurl>${escapeXML(shot.filePath || '')}</pathurl>
                  <rate>
                    <timebase>${timebase}</timebase>
                    <ntsc>${ntsc}</ntsc>
                  </rate>
                  <duration>${clipDuration}</duration>
                  <media>
                    <video>
                      <samplecharacteristics>
                        <width>${width}</width>
                        <height>${height}</height>
                      </samplecharacteristics>
                    </video>
                  </media>
                </file>
              </clipitem>
`;
    recordStart += clipDuration;
  }

  xml += `            </track>
          </video>
        </media>
      </sequence>
    </children>
  </project>
</xmeml>`;

  return xml;
}

/**
 * Escape special XML characters
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Download FCP XML as file
 */
export function downloadFCPXML(shots: XMLExportShot[], options: XMLExportOptions): void {
  const content = generateFCPXML(shots, options);
  const blob = new Blob([content], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${options.title.replace(/[^a-zA-Z0-9]/g, '_')}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
