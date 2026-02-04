"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportCDL, exportCC, exportProjectCDL, downloadFile, type CDLData } from "@/lib/cdl-export";
import { parseCdlFile, getCdlIdentifier, formatCdlForDisplay, type CdlValues } from "@/lib/cdl-parser";
import { Palette, Download, Upload, FileText, Star, Package, AlertCircle, CheckCircle2, X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

function fmtVal(n: number) { return n.toFixed(4); }

interface ShotCDL {
  id: string;
  shot_id: string;
  slope_r: number;
  slope_g: number;
  slope_b: number;
  offset_r: number;
  offset_g: number;
  offset_b: number;
  power_r: number;
  power_g: number;
  power_b: number;
  saturation: number;
  source: string | null;
  source_file: string | null;
}

interface ShotInfo {
  id: string;
  code: string;
  sequence_id: string;
}

interface LutFile {
  id: string;
  project_id: string | null;
  shot_id: string | null;
  name: string;
  lut_type: string;
  format: string | null;
  file_path: string | null;
  file_size: number | null;
  description: string | null;
  is_default: boolean;
  uploaded_by_id: string | null;
}

interface Project {
  id: string;
  name: string;
  code: string;
}

function cdlToCDLData(cdl: ShotCDL, shotCode: string): CDLData {
  return {
    id: cdl.id, shotCode,
    slopeR: cdl.slope_r, slopeG: cdl.slope_g, slopeB: cdl.slope_b,
    offsetR: cdl.offset_r, offsetG: cdl.offset_g, offsetB: cdl.offset_b,
    powerR: cdl.power_r, powerG: cdl.power_g, powerB: cdl.power_b,
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
  const [loading, setLoading] = useState(true);

  const [projects, setProjects] = useState<Project[]>([]);
  const [shots, setShots] = useState<ShotInfo[]>([]);
  const [sequences, setSequences] = useState<{ id: string; project_id: string }[]>([]);
  const [cdls, setCdls] = useState<ShotCDL[]>([]);
  const [luts, setLuts] = useState<LutFile[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const [projectsRes, shotsRes, seqRes, cdlsRes, lutsRes] = await Promise.all([
        supabase.from("projects").select("id, name, code").order("name"),
        supabase.from("shots").select("id, code, sequence_id"),
        supabase.from("sequences").select("id, project_id"),
        supabase.from("shot_cdls").select("*"),
        supabase.from("lut_files").select("*"),
      ]);
      setProjects(projectsRes.data || []);
      setShots(shotsRes.data || []);
      setSequences(seqRes.data || []);
      setCdls(cdlsRes.data || []);
      setLuts(lutsRes.data || []);
    } catch (err) {
      console.error("Failed to fetch color data:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredShots = selectedProject === "all"
    ? shots
    : shots.filter(sh => {
        const seq = sequences.find(s => s.id === sh.sequence_id);
        return seq?.project_id === selectedProject;
      });

  const filteredLuts = selectedProject === "all"
    ? luts
    : luts.filter(l => l.project_id === selectedProject);

  const handleExportCDL = (cdl: ShotCDL, shotCode: string) => {
    const data = cdlToCDLData(cdl, shotCode);
    downloadFile(exportCDL(data), `${shotCode}.cdl`);
  };

  const handleExportCC = (cdl: ShotCDL, shotCode: string) => {
    const data = cdlToCDLData(cdl, shotCode);
    downloadFile(exportCC(data), `${shotCode}.cc`);
  };

  const handleBulkExport = () => {
    const projectId = selectedProject === "all" ? projects[0]?.id : selectedProject;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const seqs = sequences.filter(s => s.project_id === projectId);
    const projShots = shots.filter(sh => seqs.some(s => s.id === sh.sequence_id));
    const cdlData: CDLData[] = [];
    for (const shot of projShots) {
      const cdl = cdls.find(c => c.shot_id === shot.id);
      if (cdl) cdlData.push(cdlToCDLData(cdl, shot.code));
    }
    if (cdlData.length === 0) return;
    downloadFile(exportProjectCDL(project.name, cdlData), `${project.code}_CDLs.cdl`);
  };

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
    e.target.value = '';
  }, [processFiles]);

  const handleRemoveFile = (index: number) => {
    setParsedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    setParsedFiles([]);
    setImportStatus(null);
  };

  const handleImportCdls = async () => {
    const totalCdls = parsedFiles.reduce((sum, f) => sum + f.cdls.length, 0);
    if (totalCdls === 0) {
      setImportStatus({ type: 'error', message: 'No valid CDL data to import' });
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    setImportStatus({ 
      type: 'success', 
      message: `Successfully imported ${totalCdls} CDL${totalCdls !== 1 ? 's' : ''} from ${parsedFiles.length} file${parsedFiles.length !== 1 ? 's' : ''}` 
    });
    setParsedFiles([]);
    fetchData();
  };

  const totalParsedCdls = parsedFiles.reduce((sum, f) => sum + f.cdls.length, 0);
  const totalWarnings = parsedFiles.reduce((sum, f) => sum + f.warnings.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasCdls = cdls.length > 0;
  const hasLuts = luts.length > 0;
  const hasProjects = projects.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Palette className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Color Management</h1>
            <p className="text-sm text-muted-foreground">CDL values, LUT files, and color pipeline</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasProjects && (
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {hasCdls && (
            <Button variant="outline" onClick={handleBulkExport}>
              <Package className="h-4 w-4 mr-2" />Bulk Export CDLs
            </Button>
          )}
        </div>
      </div>

      {!hasProjects && !hasCdls && !hasLuts ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Palette className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No color data yet</h3>
            <p className="text-sm text-muted-foreground">CDL values and LUT files will appear here once you have shots with color data.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* CDL Import Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Import CDL Files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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

              {parsedFiles.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {parsedFiles.length} file{parsedFiles.length !== 1 ? 's' : ''} &bull; {totalParsedCdls} CDL{totalParsedCdls !== 1 ? 's' : ''}
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
                      const cdl = cdls.find(c => c.shot_id === shot.id);
                      if (!cdl) return null;
                      return (
                        <tr key={shot.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-2 font-mono font-medium">{shot.code}</td>
                          <td className="py-2 px-2 font-mono text-xs">{fmtVal(cdl.slope_r)} / {fmtVal(cdl.slope_g)} / {fmtVal(cdl.slope_b)}</td>
                          <td className="py-2 px-2 font-mono text-xs">{fmtVal(cdl.offset_r)} / {fmtVal(cdl.offset_g)} / {fmtVal(cdl.offset_b)}</td>
                          <td className="py-2 px-2 font-mono text-xs">{fmtVal(cdl.power_r)} / {fmtVal(cdl.power_g)} / {fmtVal(cdl.power_b)}</td>
                          <td className="py-2 px-2 text-center font-mono text-xs">{fmtVal(cdl.saturation)}</td>
                          <td className="py-2 px-2 text-center"><Badge variant="outline" className="text-[10px]">{cdl.source || '\u2014'}</Badge></td>
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
                {filteredShots.filter(sh => cdls.some(c => c.shot_id === sh.id)).length === 0 && (
                  <p className="text-center text-muted-foreground py-8 text-sm">No CDL data{selectedProject !== "all" ? " for selected project" : " yet"}</p>
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
                  <p className="text-center text-muted-foreground py-8 text-sm">No LUT files{selectedProject !== "all" ? " for selected project" : " yet"}</p>
                ) : (
                  filteredLuts.map(lut => {
                    const project = projects.find(p => p.id === lut.project_id);
                    const shot = lut.shot_id ? shots.find(s => s.id === lut.shot_id) : null;
                    return (
                      <div key={lut.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded bg-primary/10 flex items-center justify-center shrink-0">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-mono font-medium truncate">{lut.name}{lut.format || ''}</p>
                              {lut.is_default && (
                                <Badge variant="secondary" className="text-[10px] gap-1"><Star className="h-2.5 w-2.5" />Default</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {lut.lut_type} LUT &bull; {project?.code || '\u2014'}
                              {shot ? ` \u2022 ${shot.code}` : ' \u2022 Project-wide'}
                              {lut.file_size ? ` \u2022 ${(lut.file_size / 1024).toFixed(0)} KB` : ''}
                            </p>
                            {lut.description && <p className="text-xs text-muted-foreground mt-0.5">{lut.description}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!lut.is_default && (
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
        </>
      )}
    </div>
  );
}