"use client";

import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockProjects, mockSequences } from "@/lib/mock-data";
import { parseEDL, getVideoEvents, type EDLParseResult, type EDLEvent } from "@/lib/edl-parser";
import { Upload, FileText, Check, AlertCircle, AlertTriangle, Film, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TurnoverPage() {
  const [selectedProject, setSelectedProject] = useState("p1");
  const [selectedSequence, setSelectedSequence] = useState("new");
  const [parseResult, setParseResult] = useState<EDLParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [imported, setImported] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projectSequences = mockSequences.filter(s => s.projectId === selectedProject);

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    setImported(false);
    setParseResult(null);

    if (!file.name.toLowerCase().endsWith(".edl")) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      try {
        const result = parseEDL(content);
        setParseResult(result);
      } catch {
        setParseResult(null);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleClear = () => {
    setFileName("");
    setParseResult(null);
    setImported(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = () => {
    setImported(true);
  };

  const videoEvents = parseResult ? getVideoEvents(parseResult) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Turnover Import</h1>
        <p className="text-muted-foreground mt-1">Import EDL files to create shots from editorial turnovers</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Import Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Target Project</label>
                <Select value={selectedProject} onValueChange={(v) => { setSelectedProject(v); setSelectedSequence("new"); }}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {mockProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Target Sequence</label>
                <Select value={selectedSequence} onValueChange={setSelectedSequence}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Create New Sequence</SelectItem>
                    {projectSequences.map(s => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">EDL File</label>
                <div
                  className={cn(
                    "mt-1.5 relative",
                    isDragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg"
                  )}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <label className={cn(
                    "flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                    isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
                    fileName && "border-primary/30 bg-primary/5"
                  )}>
                    {fileName ? (
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-8 w-8 text-primary" />
                        <span className="text-sm text-primary font-medium">{fileName}</span>
                        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={(e) => { e.preventDefault(); handleClear(); }}>
                          <X className="h-3 w-3 mr-1" />Clear
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">Drop EDL file here</span>
                        <span className="text-xs text-muted-foreground/60 mt-1">or click to browse</span>
                      </>
                    )}
                    <input ref={fileInputRef} type="file" accept=".edl" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              </div>
              {fileName && !fileName.toLowerCase().endsWith(".edl") && (
                <div className="flex items-center gap-2 text-amber-400 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Only CMX 3600 EDL files are supported. AAF parsing coming soon.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Parse Summary */}
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
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-lg font-bold">{parseResult.totalEvents}</p>
                    <p className="text-[10px] text-muted-foreground">TOTAL</p>
                  </div>
                  <div className="rounded-md bg-blue-600/10 p-2">
                    <p className="text-lg font-bold text-blue-400">{parseResult.videoEvents}</p>
                    <p className="text-[10px] text-muted-foreground">VIDEO</p>
                  </div>
                  <div className="rounded-md bg-purple-600/10 p-2">
                    <p className="text-lg font-bold text-purple-400">{parseResult.audioEvents}</p>
                    <p className="text-[10px] text-muted-foreground">AUDIO</p>
                  </div>
                </div>
                {parseResult.fcm !== 'UNKNOWN' && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{parseResult.fcm === 'DROP_FRAME' ? 'Drop Frame' : 'Non-Drop Frame'}</Badge>
                  </div>
                )}
                {videoEvents.length > 0 && !imported && (
                  <Button className="w-full" onClick={handleImport}>
                    <Check className="h-4 w-4 mr-2" />Import {videoEvents.length} Video Shots
                  </Button>
                )}
                {imported && (
                  <div className="flex items-center justify-center gap-2 py-2">
                    <Badge className="bg-green-600 text-white border-0">
                      <Check className="h-3 w-3 mr-1" />Imported Successfully
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Warnings */}
          {parseResult && parseResult.warnings.length > 0 && (
            <Card className="border-amber-600/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  {parseResult.warnings.length} Warning{parseResult.warnings.length !== 1 ? 's' : ''}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5 max-h-40 overflow-auto">
                  {parseResult.warnings.map((w, i) => (
                    <div key={i} className="text-xs">
                      <span className="text-muted-foreground">Line {w.line}:</span>{' '}
                      <span className="text-amber-300">{w.message}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Parse Preview
                {videoEvents.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">{videoEvents.length} video events</Badge>
                )}
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
                          <td className="p-2">
                            {event.clipName ? (
                              <span className="text-xs">{event.clipName}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">—</span>
                            )}
                          </td>
                          <td className="p-2">
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {event.editType}{event.transitionDuration ? ` ${event.transitionDuration}` : ''}
                            </Badge>
                          </td>
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
    </div>
  );
}
