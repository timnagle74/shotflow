// ASC CDL Export Utilities

export interface CDLData {
  id: string;
  shotCode: string;
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

/** Export a single CDL as ASC CDL XML (.cdl) format */
export function exportCDL(cdl: CDLData): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ColorDecisionList xmlns="urn:ASC:CDL:v1.01">
  <ColorDecision>
    <ColorCorrection id="${escapeXml(cdl.shotCode)}">
      <SOPNode>
        <Slope>${fmt(cdl.slopeR)} ${fmt(cdl.slopeG)} ${fmt(cdl.slopeB)}</Slope>
        <Offset>${fmt(cdl.offsetR)} ${fmt(cdl.offsetG)} ${fmt(cdl.offsetB)}</Offset>
        <Power>${fmt(cdl.powerR)} ${fmt(cdl.powerG)} ${fmt(cdl.powerB)}</Power>
      </SOPNode>
      <SatNode>
        <Saturation>${fmt(cdl.saturation)}</Saturation>
      </SatNode>
    </ColorCorrection>
  </ColorDecision>
</ColorDecisionList>`;
}

/** Export a single CDL as .cc (Color Correction) format */
export function exportCC(cdl: CDLData): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ColorCorrection xmlns="urn:ASC:CDL:v1.01" id="${escapeXml(cdl.shotCode)}">
  <SOPNode>
    <Slope>${fmt(cdl.slopeR)} ${fmt(cdl.slopeG)} ${fmt(cdl.slopeB)}</Slope>
    <Offset>${fmt(cdl.offsetR)} ${fmt(cdl.offsetG)} ${fmt(cdl.offsetB)}</Offset>
    <Power>${fmt(cdl.powerR)} ${fmt(cdl.powerG)} ${fmt(cdl.powerB)}</Power>
  </SOPNode>
  <SatNode>
    <Saturation>${fmt(cdl.saturation)}</Saturation>
  </SatNode>
</ColorCorrection>`;
}

/** Bulk export all CDLs for a project as a single CDL file */
export function exportProjectCDL(projectName: string, cdls: CDLData[]): string {
  const corrections = cdls.map(cdl => `    <ColorCorrection id="${escapeXml(cdl.shotCode)}">
      <SOPNode>
        <Slope>${fmt(cdl.slopeR)} ${fmt(cdl.slopeG)} ${fmt(cdl.slopeB)}</Slope>
        <Offset>${fmt(cdl.offsetR)} ${fmt(cdl.offsetG)} ${fmt(cdl.offsetB)}</Offset>
        <Power>${fmt(cdl.powerR)} ${fmt(cdl.powerG)} ${fmt(cdl.powerB)}</Power>
      </SOPNode>
      <SatNode>
        <Saturation>${fmt(cdl.saturation)}</Saturation>
      </SatNode>
    </ColorCorrection>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Project: ${escapeXml(projectName)} -->
<ColorDecisionList xmlns="urn:ASC:CDL:v1.01">
  <ColorDecision>
${corrections}
  </ColorDecision>
</ColorDecisionList>`;
}

/** Format number to 6 decimal places */
function fmt(n: number): string {
  return n.toFixed(6);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Trigger browser download of a text file */
export function downloadFile(content: string, filename: string, mimeType = 'application/xml') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
