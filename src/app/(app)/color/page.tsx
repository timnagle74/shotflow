"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { mockShots, mockSequences, mockProjects, mockShotCDLs, mockLutFiles } from "@/lib/mock-data";
import { exportCDL, exportCC, exportProjectCDL, downloadFile, type CDLData } from "@/lib/cdl-export";
import { Palette, Download, Upload, FileText, Star, Package } from "lucide-react";

function fmtVal(n: number) { return n.toFixed(4); }

function cdlToCDLData(cdl: typeof mockShotCDLs[0], shotCode: string): CDLData {
  return {
    id: cdl.id, shotCode,
    slopeR: cdl.slopeR, slopeG: cdl.slopeG, slopeB: cdl.slopeB,
    offsetR: cdl.offsetR, offsetG: cdl.offsetG, offsetB: cdl.offsetB,
    powerR: cdl.powerR, powerG: cdl.powerG, powerB: cdl.powerB,
    saturation: cdl.saturation,
  };
}

export default function ColorManagementPage() {
  const [selectedProject, setSelectedProject] = useState<string>("all");

  const filteredShots = selectedProject === "all"
    ? mockShots
    : mockShots.filter(sh => {
        const seq = mockSequences.find(s => s.id === sh.sequenceId);
        return seq?.projectId === selectedProject;
      });

  const filteredLuts = selectedProject === "all"
    ? mockLutFiles
    : mockLutFiles.filter(l => l.projectId === selectedProject);

  const handleExportCDL = (cdl: typeof mockShotCDLs[0], shotCode: string) => {
    const data = cdlToCDLData(cdl, shotCode);
    downloadFile(exportCDL(data), `${shotCode}.cdl`);
  };

  const handleExportCC = (cdl: typeof mockShotCDLs[0], shotCode: string) => {
    const data = cdlToCDLData(cdl, shotCode);
    downloadFile(exportCC(data), `${shotCode}.cc`);
  };

  const handleBulkExport = () => {
    const projectId = selectedProject === "all" ? "p1" : selectedProject;
    const project = mockProjects.find(p => p.id === projectId);
    if (!project) return;

    const seqs = mockSequences.filter(s => s.projectId === projectId);
    const shots = mockShots.filter(sh => seqs.some(s => s.id === sh.sequenceId));
    const cdls: CDLData[] = [];
    for (const shot of shots) {
      const cdl = mockShotCDLs.find(c => c.shotId === shot.id);
      if (cdl) cdls.push(cdlToCDLData(cdl, shot.code));
    }
    if (cdls.length === 0) return;
    downloadFile(exportProjectCDL(project.name, cdls), `${project.code}_CDLs.cdl`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Palette className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Color Management</h1>
            <p className="text-sm text-muted-foreground">CDL values, LUT files, and color pipeline</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {mockProjects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleBulkExport}>
            <Package className="h-4 w-4 mr-2" />Bulk Export CDLs
          </Button>
        </div>
      </div>

      {/* CDL Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Shot CDL Values</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 px-2 font-medium">Shot</th>
                  <th className="text-left py-2 px-2 font-medium">Slope (R/G/B)</th>
                  <th className="text-left py-2 px-2 font-medium">Offset (R/G/B)</th>
                  <th className="text-left py-2 px-2 font-medium">Power (R/G/B)</th>
                  <th className="text-center py-2 px-2 font-medium">Sat</th>
                  <th className="text-center py-2 px-2 font-medium">Source</th>
                  <th className="text-right py-2 px-2 font-medium">Export</th>
                </tr>
              </thead>
              <tbody>
                {filteredShots.map(shot => {
                  const cdl = mockShotCDLs.find(c => c.shotId === shot.id);
                  if (!cdl) return null;
                  return (
                    <tr key={shot.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-2 font-mono font-medium">{shot.code}</td>
                      <td className="py-2 px-2 font-mono text-xs">{fmtVal(cdl.slopeR)} / {fmtVal(cdl.slopeG)} / {fmtVal(cdl.slopeB)}</td>
                      <td className="py-2 px-2 font-mono text-xs">{fmtVal(cdl.offsetR)} / {fmtVal(cdl.offsetG)} / {fmtVal(cdl.offsetB)}</td>
                      <td className="py-2 px-2 font-mono text-xs">{fmtVal(cdl.powerR)} / {fmtVal(cdl.powerG)} / {fmtVal(cdl.powerB)}</td>
                      <td className="py-2 px-2 text-center font-mono text-xs">{fmtVal(cdl.saturation)}</td>
                      <td className="py-2 px-2 text-center"><Badge variant="outline" className="text-[10px]">{cdl.source}</Badge></td>
                      <td className="py-2 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleExportCDL(cdl, shot.code)} title="Export .cdl">
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleExportCC(cdl, shot.code)} title="Export .cc">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredShots.filter(sh => mockShotCDLs.some(c => c.shotId === sh.id)).length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">No CDL data for selected project</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* LUT Files */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">LUT Files</CardTitle>
            <Button size="sm" variant="outline">
              <Upload className="h-4 w-4 mr-2" />Upload LUT
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredLuts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">No LUT files for selected project</p>
            ) : (
              filteredLuts.map(lut => {
                const project = mockProjects.find(p => p.id === lut.projectId);
                const shot = lut.shotId ? mockShots.find(s => s.id === lut.shotId) : null;
                return (
                  <div key={lut.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-mono font-medium truncate">{lut.name}{lut.format}</p>
                          {lut.isDefault && (
                            <Badge variant="secondary" className="text-[10px] gap-1"><Star className="h-2.5 w-2.5" />Default</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {lut.lutType} LUT • {project?.code || '—'}
                          {shot ? ` • ${shot.code}` : ' • Project-wide'}
                          {lut.fileSize ? ` • ${(lut.fileSize / 1024).toFixed(0)} KB` : ''}
                        </p>
                        {lut.description && <p className="text-xs text-muted-foreground mt-0.5">{lut.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!lut.isDefault && (
                        <Button variant="ghost" size="sm" className="text-xs">Set Default</Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
