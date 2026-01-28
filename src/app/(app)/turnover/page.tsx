"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockProjects } from "@/lib/mock-data";
import { parseEDL, type EDLEvent } from "@/lib/edl-parser";
import { Upload, FileText, Check, AlertCircle } from "lucide-react";

export default function TurnoverPage() {
  const [selectedProject, setSelectedProject] = useState("p1");
  const [events, setEvents] = useState<EDLEvent[]>([]);
  const [fileName, setFileName] = useState("");
  const [imported, setImported] = useState(false);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImported(false);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (file.name.toLowerCase().endsWith(".edl")) {
        const parsed = parseEDL(content);
        setEvents(parsed);
      } else {
        // AAF stub
        setEvents([]);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleImport = () => {
    setImported(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Turnover Import</h1>
        <p className="text-muted-foreground mt-1">Import EDL/AAF files to create shots from editorial turnovers</p>
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
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {mockProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">EDL / AAF File</label>
                <div className="mt-1.5">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">
                      {fileName || "Drop EDL file or click to browse"}
                    </span>
                    <input type="file" accept=".edl,.aaf" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              </div>
              {fileName && !fileName.toLowerCase().endsWith(".edl") && (
                <div className="flex items-center gap-2 text-amber-400 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  AAF parsing is not yet supported. Please use EDL format.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold">{events.length}</div>
                <p className="text-sm text-muted-foreground">Shots detected</p>
                {events.length > 0 && !imported && (
                  <Button className="w-full mt-2" onClick={handleImport}>
                    <Check className="h-4 w-4 mr-2" />Confirm Import
                  </Button>
                )}
                {imported && (
                  <Badge className="bg-green-600 text-white border-0">
                    <Check className="h-3 w-3 mr-1" />Imported Successfully
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Preview — {events.length} events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">Upload an EDL file to preview shots</p>
                </div>
              ) : (
                <div className="overflow-auto max-h-[600px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border">
                        <th className="text-left p-2 text-xs text-muted-foreground">#</th>
                        <th className="text-left p-2 text-xs text-muted-foreground">Reel / Clip</th>
                        <th className="text-left p-2 text-xs text-muted-foreground">Source In</th>
                        <th className="text-left p-2 text-xs text-muted-foreground">Source Out</th>
                        <th className="text-left p-2 text-xs text-muted-foreground">Record In</th>
                        <th className="text-left p-2 text-xs text-muted-foreground">Record Out</th>
                        <th className="text-left p-2 text-xs text-muted-foreground">Frames</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((event, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="p-2 font-mono">{event.eventNumber}</td>
                          <td className="p-2">
                            <div className="font-medium">{event.reelName}</div>
                            {event.clipName && <div className="text-xs text-muted-foreground">{event.clipName}</div>}
                          </td>
                          <td className="p-2 font-mono text-xs">{event.sourceIn}</td>
                          <td className="p-2 font-mono text-xs">{event.sourceOut}</td>
                          <td className="p-2 font-mono text-xs">{event.recordIn}</td>
                          <td className="p-2 font-mono text-xs">{event.recordOut}</td>
                          <td className="p-2 font-mono text-xs">{event.frameEnd - event.frameStart}f</td>
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
