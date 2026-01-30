"use client";

import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockProjects, mockSequences } from "@/lib/mock-data";
import { parseEDL, getVideoEvents, type EDLParseResult } from "@/lib/edl-parser";
import { parseAleFile, getClipName, isCircled, getSceneTake, parseAscSop, parseAscSat, type AleParseResult } from "@/lib/ale-parser";
import { Upload, FileText, Check, AlertCircle, AlertTriangle, Film, X, Database, Video, FolderOpen, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TurnoverFile {
  id: string;
  file: File;
  type: 'ref' | 'plate';
  description?: string;
  matchedShot?: string; // Shot code this file matches to
}

export default function TurnoverPage() {
  const [selectedProject, setSelectedProject] = useState("p1");
  const [selectedSequence, setSelectedSequence] = useState("new");

  // EDL state
  const [parseResult, setParseResult] = useState<EDLParseResult | null>(null);
  const [edlFileName, setEdlFileName] = useState("");
  const [edlImported, setEdlImported] = useState(false);
  const [edlDragOver, setEdlDragOver] = useState(false);
  const edlFileRef = useRef<HTMLInputElement>(null);

  // ALE state
  const [aleResult, setAleResult] = useState<AleParseResult | null>(null);
  const [aleFileName, setAleFileName] = useState("");
  const [aleImported, setAleImported] = useState(false);
  const [aleDragOver, setAleDragOver] = useState(false);
  const aleFileRef = useRef<HTMLInputElement>(null);

  // Turnover files (refs + plates)
  const [turnoverFiles, setTurnoverFiles] = useState<TurnoverFile[]>([]);
  const [refDragOver, setRefDragOver] = useState(false);
  const [plateDragOver, setPlateDragOver] = useState(false);
  const refFileRef = useRef<HTMLInputElement>(null);
  const plateFileRef = useRef<HTMLInputElement>(null);

  const projectSequences = mockSequences.filter(s => s.projectId === selectedProject);

  // EDL handlers
  const handleEdlFile = useCallback((file: File) => {
    setEdlFileName(file.name);
    setEdlImported(false);
    setParseResult(null);
    if (!file.name.toLowerCase().endsWith(".edl")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      try { setParseResult(parseEDL(content)); } catch { setParseResult(null); }
    };
    reader.readAsText(file);
  }, []);

  // ALE handlers
  const handleAleFile = useCallback((file: File) => {
    setAleFileName(file.name);
    setAleImported(false);
    setAleResult(null);
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".ale") && !ext.endsWith(".txt")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      try { setAleResult(parseAleFile(content)); } catch { setAleResult(null); }
    };
    reader.readAsText(file);
  }, []);

  const handleEdlUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleEdlFile(f); }, [handleEdlFile]);
  const handleAleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleAleFile(f); }, [handleAleFile]);

  const handleEdlDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setEdlDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleEdlFile(f); }, [handleEdlFile]);
  const handleAleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setAleDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleAleFile(f); }, [handleAleFile]);

  const clearEdl = () => { setEdlFileName(""); setParseResult(null); setEdlImported(false); if (edlFileRef.current) edlFileRef.current.value = ""; };
  const clearAle = () => { setAleFileName(""); setAleResult(null); setAleImported(false); if (aleFileRef.current) aleFileRef.current.value = ""; };

  // Ref/Plate handlers
  const handleRefFiles = useCallback((files: FileList | File[]) => {
    const newFiles: TurnoverFile[] = Array.from(files).map(file => ({
      id: crypto.randomUUID(),
      file,
      type: 'ref' as const,
    }));
    setTurnoverFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handlePlateFiles = useCallback((files: FileList | File[]) => {
    const newFiles: TurnoverFile[] = Array.from(files).map(file => ({
      id: crypto.randomUUID(),
      file,
      type: 'plate' as const,
    }));
    setTurnoverFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleRefUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleRefFiles(e.target.files);
    if (refFileRef.current) refFileRef.current.value = "";
  }, [handleRefFiles]);

  const handlePlateUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handlePlateFiles(e.target.files);
    if (plateFileRef.current) plateFileRef.current.value = "";
  }, [handlePlateFiles]);

  const handleRefDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setRefDragOver(false);
    if (e.dataTransfer.files) handleRefFiles(e.dataTransfer.files);
  }, [handleRefFiles]);

  const handlePlateDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setPlateDragOver(false);
    if (e.dataTransfer.files) handlePlateFiles(e.dataTransfer.files);
  }, [handlePlateFiles]);

  const removeFile = useCallback((id: string) => {
    setTurnoverFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const updateFileDescription = useCallback((id: string, description: string) => {
    setTurnoverFiles(prev => prev.map(f => f.id === id ? { ...f, description } : f));
  }, []);

  const refFiles = turnoverFiles.filter(f => f.type === 'ref');
  const plateFiles = turnoverFiles.filter(f => f.type === 'plate');

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const videoEvents = parseResult ? getVideoEvents(parseResult) : [];
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleEdlImport = useCallback(async () => {
    if (videoEvents.length === 0) return;
    
    setImporting(true);
    setImportError(null);

    try {
      const formData = new FormData();
      
      // Get real project ID from mock data for now
      const project = mockProjects.find(p => p.id === selectedProject);
      formData.append("projectId", project?.id || selectedProject);
      
      if (selectedSequence !== "new") {
        formData.append("sequenceId", selectedSequence);
      }
      
      // Use EDL title or filename as sequence name
      const seqName = parseResult?.title || edlFileName.replace(/\.edl$/i, "");
      formData.append("sequenceName", seqName);
      formData.append("sequenceCode", seqName.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase().slice(0, 20));

      // Build shots from EDL events
      const shots = videoEvents.map((event, idx) => ({
        code: event.clipName || event.reelName || `SHOT_${String(idx + 1).padStart(3, "0")}`,
        clipName: event.clipName,
        sourceIn: event.sourceIn,
        sourceOut: event.sourceOut,
        recordIn: event.recordIn,
        recordOut: event.recordOut,
        durationFrames: event.durationFrames,
      }));
      formData.append("shots", JSON.stringify(shots));

      // Add ref files
      for (const f of refFiles) {
        formData.append("refs", f.file);
      }

      // Add plate files
      for (const f of plateFiles) {
        formData.append("plates", f.file);
      }

      const response = await fetch("/api/turnover/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Import failed");
      }

      const result = await response.json();
      console.log("Import result:", result);
      
      setEdlImported(true);
    } catch (err) {
      console.error("Import error:", err);
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }, [videoEvents, selectedProject, selectedSequence, parseResult, edlFileName, refFiles, plateFiles]);

  const handleAleImport = () => {
    // In production: save to shot_metadata + shot_cdls via Supabase
    // For now, mark as imported
    setAleImported(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Turnover Import</h1>
        <p className="text-muted-foreground mt-1">Import EDL or ALE files to create shots and metadata from editorial turnovers</p>
      </div>

      {/* Import Settings */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Import Settings</CardTitle></CardHeader>
        <CardContent className="flex gap-4 flex-wrap">
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Target Project</label>
            <Select value={selectedProject} onValueChange={(v) => { setSelectedProject(v); setSelectedSequence("new"); }}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>{mockProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm font-medium">Target Sequence</label>
            <Select value={selectedSequence} onValueChange={setSelectedSequence}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Create New Sequence</SelectItem>
                {projectSequences.map(s => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Source Materials Upload */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Reference Clips */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Video className="h-4 w-4" />
              Reference Clips
              {refFiles.length > 0 && <Badge variant="secondary" className="ml-auto">{refFiles.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className={cn("relative", refDragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg")}
              onDrop={handleRefDrop}
              onDragOver={(e) => { e.preventDefault(); setRefDragOver(true); }}
              onDragLeave={() => setRefDragOver(false)}
            >
              <label className={cn(
                "flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                refDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              )}>
                <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">Drop reference clips here</span>
                <span className="text-[10px] text-muted-foreground/60">Shows shots in sequence context</span>
                <input ref={refFileRef} type="file" accept=".mov,.mp4,.mxf,.m4v" multiple className="hidden" onChange={handleRefUpload} />
              </label>
            </div>
            {refFiles.length > 0 && (
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {refFiles.map(f => (
                  <div key={f.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md group">
                    <Film className="h-4 w-4 text-blue-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{f.file.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatFileSize(f.file.size)}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeFile(f.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source Plates */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Source Plates
              {plateFiles.length > 0 && <Badge variant="secondary" className="ml-auto">{plateFiles.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className={cn("relative", plateDragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg")}
              onDrop={handlePlateDrop}
              onDragOver={(e) => { e.preventDefault(); setPlateDragOver(true); }}
              onDragLeave={() => setPlateDragOver(false)}
            >
              <label className={cn(
                "flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                plateDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              )}>
                <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">Drop source plates here</span>
                <span className="text-[10px] text-muted-foreground/60">Clean plates, hero plates, BG elements</span>
                <input ref={plateFileRef} type="file" accept=".mov,.mp4,.mxf,.exr,.dpx,.tif,.tiff" multiple className="hidden" onChange={handlePlateUpload} />
              </label>
            </div>
            {plateFiles.length > 0 && (
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {plateFiles.map(f => (
                  <div key={f.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md group">
                    <Film className="h-4 w-4 text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{f.file.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatFileSize(f.file.size)}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeFile(f.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="edl">
        <TabsList>
          <TabsTrigger value="edl" className="gap-1.5"><FileText className="h-3.5 w-3.5" />EDL Import</TabsTrigger>
          <TabsTrigger value="ale" className="gap-1.5"><Database className="h-3.5 w-3.5" />ALE Import</TabsTrigger>
        </TabsList>

        {/* ─── EDL Tab ─── */}
        <TabsContent value="edl">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">EDL File</CardTitle></CardHeader>
                <CardContent>
                  <div
                    className={cn("relative", edlDragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg")}
                    onDrop={handleEdlDrop}
                    onDragOver={(e) => { e.preventDefault(); setEdlDragOver(true); }}
                    onDragLeave={() => setEdlDragOver(false)}
                  >
                    <label className={cn(
                      "flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                      edlDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
                      edlFileName && "border-primary/30 bg-primary/5"
                    )}>
                      {edlFileName ? (
                        <div className="flex flex-col items-center gap-2">
                          <FileText className="h-8 w-8 text-primary" />
                          <span className="text-sm text-primary font-medium">{edlFileName}</span>
                          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={(e) => { e.preventDefault(); clearEdl(); }}><X className="h-3 w-3 mr-1" />Clear</Button>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                          <span className="text-sm text-muted-foreground">Drop EDL file here</span>
                          <span className="text-xs text-muted-foreground/60 mt-1">or click to browse</span>
                        </>
                      )}
                      <input ref={edlFileRef} type="file" accept=".edl" className="hidden" onChange={handleEdlUpload} />
                    </label>
                  </div>
                  {edlFileName && !edlFileName.toLowerCase().endsWith(".edl") && (
                    <div className="flex items-center gap-2 text-amber-400 text-sm mt-3">
                      <AlertCircle className="h-4 w-4 shrink-0" />Only CMX 3600 EDL files are supported.
                    </div>
                  )}
                </CardContent>
              </Card>

              {parseResult && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    {parseResult.title && (
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">EDL Title</label>
                        <p className="text-sm font-mono font-medium">{parseResult.title}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md bg-muted/50 p-2"><p className="text-lg font-bold">{parseResult.totalEvents}</p><p className="text-[10px] text-muted-foreground">TOTAL</p></div>
                      <div className="rounded-md bg-blue-600/10 p-2"><p className="text-lg font-bold text-blue-400">{parseResult.videoEvents}</p><p className="text-[10px] text-muted-foreground">VIDEO</p></div>
                      <div className="rounded-md bg-purple-600/10 p-2"><p className="text-lg font-bold text-purple-400">{parseResult.audioEvents}</p><p className="text-[10px] text-muted-foreground">AUDIO</p></div>
                    </div>
                    {parseResult.fcm !== 'UNKNOWN' && <Badge variant="outline" className="text-xs">{parseResult.fcm === 'DROP_FRAME' ? 'Drop Frame' : 'Non-Drop Frame'}</Badge>}
                    {videoEvents.length > 0 && !edlImported && (
                      <Button className="w-full" onClick={handleEdlImport} disabled={importing}>
                        {importing ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing...</>
                        ) : (
                          <><Check className="h-4 w-4 mr-2" />Import {videoEvents.length} Shot{videoEvents.length !== 1 ? 's' : ''} + {refFiles.length} Refs + {plateFiles.length} Plates</>
                        )}
                      </Button>
                    )}
                    {importError && <div className="flex items-center gap-2 text-red-400 text-sm"><AlertCircle className="h-4 w-4" />{importError}</div>}
                    {edlImported && <div className="flex items-center justify-center gap-2 py-2"><Badge className="bg-green-600 text-white border-0"><Check className="h-3 w-3 mr-1" />Imported Successfully</Badge></div>}
                  </CardContent>
                </Card>
              )}

              {parseResult && parseResult.warnings.length > 0 && (
                <Card className="border-amber-600/30">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-amber-400"><AlertTriangle className="h-4 w-4" />{parseResult.warnings.length} Warning{parseResult.warnings.length !== 1 ? 's' : ''}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 max-h-40 overflow-auto">
                      {parseResult.warnings.map((w, i) => <div key={i} className="text-xs"><span className="text-muted-foreground">Line {w.line}:</span> <span className="text-amber-300">{w.message}</span></div>)}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />Parse Preview
                    {videoEvents.length > 0 && <Badge variant="secondary" className="ml-auto">{videoEvents.length} video events</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {videoEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Film className="h-12 w-12 mb-3 opacity-20" />
                      <p className="text-sm">Upload an EDL file to preview shots</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Supports CMX 3600 format (Avid, Resolve, Premiere)</p>
                    </div>
                  ) : (
                    <div className="overflow-auto max-h-[600px] -mx-2">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card z-10">
                          <tr className="border-b border-border">
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">#</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">Reel</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">Clip Name</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">Edit</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">Src In</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">Src Out</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">Rec In</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">Rec Out</th>
                            <th className="text-right p-2 text-xs font-medium text-muted-foreground">Dur</th>
                          </tr>
                        </thead>
                        <tbody>
                          {videoEvents.map((event, i) => (
                            <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                              <td className="p-2 font-mono text-xs text-muted-foreground">{String(event.eventNumber).padStart(3, '0')}</td>
                              <td className="p-2 font-mono text-xs font-medium">{event.reelName}</td>
                              <td className="p-2">{event.clipName ? <span className="text-xs">{event.clipName}</span> : <span className="text-xs text-muted-foreground italic">—</span>}</td>
                              <td className="p-2"><Badge variant="outline" className="text-[10px] font-mono">{event.editType}{event.transitionDuration ? ` ${event.transitionDuration}` : ''}</Badge></td>
                              <td className="p-2 font-mono text-xs">{event.sourceIn}</td>
                              <td className="p-2 font-mono text-xs">{event.sourceOut}</td>
                              <td className="p-2 font-mono text-xs">{event.recordIn}</td>
                              <td className="p-2 font-mono text-xs">{event.recordOut}</td>
                              <td className="p-2 font-mono text-xs text-right">{event.durationFrames}f</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ─── ALE Tab ─── */}
        <TabsContent value="ale">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">ALE File</CardTitle></CardHeader>
                <CardContent>
                  <div
                    className={cn("relative", aleDragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg")}
                    onDrop={handleAleDrop}
                    onDragOver={(e) => { e.preventDefault(); setAleDragOver(true); }}
                    onDragLeave={() => setAleDragOver(false)}
                  >
                    <label className={cn(
                      "flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                      aleDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
                      aleFileName && "border-primary/30 bg-primary/5"
                    )}>
                      {aleFileName ? (
                        <div className="flex flex-col items-center gap-2">
                          <Database className="h-8 w-8 text-primary" />
                          <span className="text-sm text-primary font-medium">{aleFileName}</span>
                          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={(e) => { e.preventDefault(); clearAle(); }}><X className="h-3 w-3 mr-1" />Clear</Button>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                          <span className="text-sm text-muted-foreground">Drop ALE file here</span>
                          <span className="text-xs text-muted-foreground/60 mt-1">.ale or .txt — Avid Log Exchange format</span>
                        </>
                      )}
                      <input ref={aleFileRef} type="file" accept=".ale,.txt" className="hidden" onChange={handleAleUpload} />
                    </label>
                  </div>
                  {aleFileName && !aleFileName.toLowerCase().endsWith(".ale") && !aleFileName.toLowerCase().endsWith(".txt") && (
                    <div className="flex items-center gap-2 text-amber-400 text-sm mt-3">
                      <AlertCircle className="h-4 w-4 shrink-0" />Only .ale and .txt files are supported.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ALE Summary */}
              {aleResult && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    {aleResult.heading.fps && (
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Frame Rate</label>
                        <p className="text-sm font-mono font-medium">{aleResult.heading.fps} fps</p>
                      </div>
                    )}
                    {aleResult.heading.videoFormat && (
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Video Format</label>
                        <p className="text-sm font-mono font-medium">{aleResult.heading.videoFormat}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className="text-lg font-bold">{aleResult.recordCount}</p>
                        <p className="text-[10px] text-muted-foreground">RECORDS</p>
                      </div>
                      <div className="rounded-md bg-blue-600/10 p-2">
                        <p className="text-lg font-bold text-blue-400">{aleResult.columns.length}</p>
                        <p className="text-[10px] text-muted-foreground">COLUMNS</p>
                      </div>
                    </div>
                    {aleResult.recordCount > 0 && !aleImported && (
                      <Button className="w-full" onClick={handleAleImport}>
                        <Check className="h-4 w-4 mr-2" />Import {aleResult.recordCount} Records
                      </Button>
                    )}
                    {aleImported && (
                      <div className="flex items-center justify-center gap-2 py-2">
                        <Badge className="bg-green-600 text-white border-0"><Check className="h-3 w-3 mr-1" />Imported to shot_metadata + shot_cdls</Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ALE Warnings */}
              {aleResult && aleResult.warnings.length > 0 && (
                <Card className="border-amber-600/30">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-amber-400"><AlertTriangle className="h-4 w-4" />{aleResult.warnings.length} Warning{aleResult.warnings.length !== 1 ? 's' : ''}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 max-h-40 overflow-auto">
                      {aleResult.warnings.map((w, i) => <div key={i} className="text-xs text-amber-300">{w}</div>)}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ALE Preview Table */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Database className="h-4 w-4" />ALE Preview
                    {aleResult && aleResult.recordCount > 0 && <Badge variant="secondary" className="ml-auto">{aleResult.recordCount} records</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!aleResult || aleResult.recordCount === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Database className="h-12 w-12 mb-3 opacity-20" />
                      <p className="text-sm">Upload an ALE file to preview metadata</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Supports Silverstack, Pomfort, and standard ALE exports</p>
                    </div>
                  ) : (
                    <div className="overflow-auto max-h-[600px] -mx-2">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card z-10">
                          <tr className="border-b border-border">
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">Name / Clip</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">Scene</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">Take</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">TC In</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">TC Out</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">Duration</th>
                            <th className="text-center p-2 text-xs font-medium text-muted-foreground">Circled</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">Camera</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">ASC_SOP</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">ASC_SAT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aleResult.records.map((rec, i) => {
                            const clipName = getClipName(rec);
                            const { scene, take } = getSceneTake(rec);
                            const circled = isCircled(rec);
                            const tcIn = rec['Start'] || rec['Start TC'] || rec['Src Start TC'] || '';
                            const tcOut = rec['End'] || rec['End TC'] || rec['Src End TC'] || '';
                            const duration = rec['Duration'] || rec['Duration TC'] || '';
                            const camera = rec['Camera Type'] || rec['Camera'] || rec['Camera Model'] || '';
                            const ascSop = rec['ASC_SOP'] || rec['ASC SOP'] || '';
                            const ascSat = rec['ASC_SAT'] || rec['ASC SAT'] || '';

                            return (
                              <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                                <td className="p-2 font-mono text-xs font-medium max-w-[200px] truncate">{clipName || <span className="text-muted-foreground italic">—</span>}</td>
                                <td className="p-2 text-xs">{scene || '—'}</td>
                                <td className="p-2 text-xs">{take || '—'}</td>
                                <td className="p-2 font-mono text-xs">{tcIn || '—'}</td>
                                <td className="p-2 font-mono text-xs">{tcOut || '—'}</td>
                                <td className="p-2 font-mono text-xs">{duration || '—'}</td>
                                <td className="p-2 text-center">{circled ? <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-[10px]">●</Badge> : <span className="text-muted-foreground/40">—</span>}</td>
                                <td className="p-2 text-xs max-w-[120px] truncate">{camera || '—'}</td>
                                <td className="p-2 font-mono text-[10px] max-w-[180px] truncate">{ascSop || '—'}</td>
                                <td className="p-2 font-mono text-xs">{ascSat || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
