"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockShots, mockSequences, mockProjects, mockShotCDLs, mockLutFiles } from "@/lib/mock-data";
import { exportCDL, exportCC, exportProjectCDL, downloadFile, type CDLData } from "@/lib/cdl-export";
import { parseCdlFile, getCdlIdentifier, formatCdlForDisplay, type CdlValues } from "@/lib/cdl-parser";
import { Palette, Download, Upload, FileText, Star, Package, AlertCircle, CheckCircle2, X } from "lucide-react";

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

interface ParsedCdlFile {
  filename: string;
  cdls: CdlValues[];
  warnings: string[];
  format: string;
}

export default function ColorManagementPage() {
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [parsedFiles, setParsedFiles] = useState<ParsedCdlFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  // CDL Import handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const newParsedFiles: ParsedCdlFile[] = [];
    
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.cdl') && 
          !file.name.toLowerCase().endsWith('.cc') &&
          !file.name.toLowerCase().endsWith('.ccc')) {
        continue;
      }
      
      try {
        const content = await file.text();
        const result = parseCdlFile(content);
        newParsedFiles.push({
          filename: file.name,
          cdls: result.cdls,
          warnings: result.warnings,
          format: result.format,
        });
      } catch (err) {
        newParsedFiles.push({
          filename: file.name,
          cdls: [],
          warnings: [`Failed to read file: ${err instanceof Error ? err.message : 'Unknown error'}`],
          format: 'unknown',
        });
      }
    }
    
    if (newParsedFiles.length > 0) {
      setParsedFiles(prev => [...prev, ...newParsedFiles]);
      setImportStatus(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files?.length) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      processFiles(e.target.files);
    }
    e.target.value = ''; // Reset for re-selection
  }, [processFiles]);

  const handleRemoveFile = (index: number) => {
    setParsedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    setParsedFiles([]);
    setImportStatus(null);
  };

  const handleImportCdls = async () => {
    // In a real implementation, this would save to the database
    // For now, we'll just simulate the import
    const totalCdls = parsedFiles.reduce((sum, f) => sum + f.cdls.length, 0);
    
    if (totalCdls === 0) {
      setImportStatus({ type: 'error', message: 'No valid CDL data to import' });
      return;
    }

    // Simulate import
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setImportStatus({ 
      type: 'success', 
      message: `Successfully imported ${totalCdls} CDL${totalCdls !== 1 ? 's' : ''} from ${parsedFiles.length} file${parsedFiles.length !== 1 ? 's' : ''}` 
    });
    setParsedFiles([]);
  };

  const totalParsedCdls = parsedFiles.reduce((sum, f) => sum + f.cdls.length, 0);
  const totalWarnings = parsedFiles.reduce((sum, f) => sum + f.warnings.length, 0);

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

      {/* CDL Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Import CDL Files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-muted-foreground/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className={`h-10 w-10 mx-auto mb-3 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="text-sm font-medium mb-1">
              {isDragging ? 'Drop CDL files here' : 'Drag & drop CDL files here'}
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Supports .cdl, .cc, and .ccc files
            </p>
            <label>
              <input
                type="file"
                multiple
                accept=".cdl,.cc,.ccc"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button variant="outline" size="sm" asChild>
                <span>Browse Files</span>
              </Button>
            </label>
          </div>

          {/* Import Status */}
          {importStatus && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              importStatus.type === 'success' 
                ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                : 'bg-red-500/10 text-red-600 dark:text-red-400'
            }`}>
              {importStatus.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span className="text-sm">{importStatus.message}</span>
            </div>
          )}

          {/* Parsed Files Preview */}
          {parsedFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">
                    {parsedFiles.length} file{parsedFiles.length !== 1 ? 's' : ''} • {totalParsedCdls} CDL{totalParsedCdls !== 1 ? 's' : ''}
                  </span>
                  {totalWarnings > 0 && (
                    <Badge variant="outline" className="text-amber-600 border-amber-600/30">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {totalWarnings} warning{totalWarnings !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleClearAll}>
                    Clear All
                  </Button>
                  <Button size="sm" onClick={handleImportCdls} disabled={totalParsedCdls === 0}>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {totalParsedCdls} CDL{totalParsedCdls !== 1 ? 's' : ''}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {parsedFiles.map((file, fileIndex) => (
                  <div key={fileIndex} className="border border-border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{file.filename}</span>
                        <Badge variant="secondary" className="text-[10px]">{file.format.toUpperCase()}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {file.cdls.length} CDL{file.cdls.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveFile(fileIndex)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    
                    {/* Warnings */}
                    {file.warnings.length > 0 && (
                      <div className="px-3 py-2 bg-amber-500/5 border-t border-amber-500/20">
                        {file.warnings.map((warning, i) => (
                          <p key={i} className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
                            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                            {warning}
                          </p>
                        ))}
                      </div>
                    )}
                    
                    {/* CDL Preview Table */}
                    {file.cdls.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-t border-border text-muted-foreground">
                              <th className="text-left py-1.5 px-3 font-medium">ID/Description</th>
                              <th className="text-left py-1.5 px-3 font-medium">Slope</th>
                              <th className="text-left py-1.5 px-3 font-medium">Offset</th>
                              <th className="text-left py-1.5 px-3 font-medium">Power</th>
                              <th className="text-center py-1.5 px-3 font-medium">Sat</th>
                            </tr>
                          </thead>
                          <tbody>
                            {file.cdls.map((cdl, cdlIndex) => {
                              const formatted = formatCdlForDisplay(cdl);
                              return (
                                <tr key={cdlIndex} className="border-t border-border/50 hover:bg-muted/20">
                                  <td className="py-1.5 px-3 font-mono truncate max-w-[200px]" title={getCdlIdentifier(cdl)}>
                                    {getCdlIdentifier(cdl)}
                                  </td>
                                  <td className="py-1.5 px-3 font-mono">{formatted.slope}</td>
                                  <td className="py-1.5 px-3 font-mono">{formatted.offset}</td>
                                  <td className="py-1.5 px-3 font-mono">{formatted.power}</td>
                                  <td className="py-1.5 px-3 text-center font-mono">{formatted.saturation}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
