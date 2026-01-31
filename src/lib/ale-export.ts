/**
 * ALE Export - Generate Avid Log Exchange files from shot data
 */

export interface ALEExportShot {
  code: string;
  clipName?: string | null;
  sourceIn?: string | null;
  sourceOut?: string | null;
  duration?: string | null;
  scene?: string | null;
  take?: string | null;
  camera?: string | null;
  cameraModel?: string | null;
  lens?: string | null;
  focalLength?: string | null;
  iso?: string | null;
  shutter?: string | null;
  whiteBalance?: string | null;
  ascSop?: string | null;
  ascSat?: string | null;
  lut?: string | null;
  notes?: string | null;
}

export interface ALEExportOptions {
  title: string;
  fps?: string;
  videoFormat?: string;
}

/**
 * Generate ALE content
 */
export function generateALE(shots: ALEExportShot[], options: ALEExportOptions): string {
  const { title, fps = '24', videoFormat = '1080' } = options;
  const lines: string[] = [];
  
  // Heading section
  lines.push('Heading');
  lines.push(`FIELD_DELIM\tTABS`);
  lines.push(`VIDEO_FORMAT\t${videoFormat}`);
  lines.push(`FPS\t${fps}`);
  lines.push('');
  
  // Column section - define all columns we'll export
  lines.push('Column');
  const columns = [
    'Name',
    'Clip Name',
    'Start',
    'End',
    'Duration',
    'Scene',
    'Take',
    'Camera',
    'Camera Model',
    'Lens',
    'Focal Length',
    'ISO',
    'Shutter',
    'White Balance',
    'ASC_SOP',
    'ASC_SAT',
    'LUT',
    'Comments'
  ];
  lines.push(columns.join('\t'));
  lines.push('');
  
  // Data section
  lines.push('Data');
  
  for (const shot of shots) {
    const row = [
      shot.code || '',
      shot.clipName || shot.code || '',
      shot.sourceIn || '00:00:00:00',
      shot.sourceOut || '00:00:04:00',
      shot.duration || '00:00:04:00',
      shot.scene || '',
      shot.take || '',
      shot.camera || '',
      shot.cameraModel || '',
      shot.lens || '',
      shot.focalLength || '',
      shot.iso || '',
      shot.shutter || '',
      shot.whiteBalance || '',
      shot.ascSop || '',
      shot.ascSat || '',
      shot.lut || '',
      shot.notes || ''
    ];
    lines.push(row.join('\t'));
  }
  
  return lines.join('\n');
}

/**
 * Download ALE as file
 */
export function downloadALE(shots: ALEExportShot[], options: ALEExportOptions): void {
  const content = generateALE(shots, options);
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${options.title.replace(/[^a-zA-Z0-9]/g, '_')}.ale`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
