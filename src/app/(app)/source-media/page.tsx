"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Upload, 
  Film, 
  Camera, 
  Calendar, 
  FileVideo,
  Palette,
  Search,
  X,
  CheckCircle,
  AlertCircle,
  Loader2
} from "lucide-react";
import { aleToSourceMedia, summarizeSourceMedia } from "@/lib/source-media-importer";
import type { SourceMediaInsert } from "@/lib/source-media.types";

// Mock project for demo
const MOCK_PROJECT_ID = "proj-001";

interface ImportedALE {
  filename: string;
  records: SourceMediaInsert[];
  warnings: string[];
}

export default function SourceMediaPage() {
  const [importedALEs, setImportedALEs] = useState<ImportedALE[]>([]);
  const [allRecords, setAllRecords] = useState<SourceMediaInsert[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<SourceMediaInsert | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFilesDrop = useCallback(async (files: FileList) => {
    setIsImporting(true);
    const newImports: ImportedALE[] = [];
    
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.ale')) {
        continue;
      }
      
      try {
        const content = await file.text();
        const { records, warnings } = aleToSourceMedia(content, {
          projectId: MOCK_PROJECT_ID,
          aleSource: file.name,
        });
        
        newImports.push({
          filename: file.name,
          records,
          warnings,
        });
      } catch (err) {
        console.error(`Error parsing ${file.name}:`, err);
        newImports.push({
          filename: file.name,
          records: [],
          warnings: [`Failed to parse: ${err}`],
        });
      }
    }
    
    setImportedALEs(prev => [...prev, ...newImports]);
    setAllRecords(prev => [...prev, ...newImports.flatMap(i => i.records)]);
    setIsImporting(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFilesDrop(e.dataTransfer.files);
    }
  }, [handleFilesDrop]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesDrop(e.target.files);
    }
  }, [handleFilesDrop]);

  const removeALE = useCallback((filename: string) => {
    setImportedALEs(prev => prev.filter(a => a.filename !== filename));
    setAllRecords(prev => prev.filter(r => r.ale_source !== filename));
  }, []);

  const summary = summarizeSourceMedia(allRecords as any);
  
  const filteredRecords = allRecords.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.clip_name.toLowerCase().includes(q) ||
      r.scene?.toLowerCase().includes(q) ||
      r.camera?.toLowerCase().includes(q) ||
      r.camera_roll?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Source Media</h1>
          <p className="text-muted-foreground">
            Import dailies metadata from ALE files. Shots will auto-link to this master database.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled>
            <FileVideo className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button disabled={allRecords.length === 0}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Save to Database
          </Button>
        </div>
      </div>

      {/* Import Drop Zone */}
      <Card>
        <CardContent className="pt-6">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver 
                ? "border-primary bg-primary/5" 
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
          >
            {isImporting ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Importing ALE files...</p>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-1">Drop ALE files here</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Import camera metadata from your dailies
                </p>
                <Label htmlFor="ale-upload">
                  <Button variant="secondary" asChild>
                    <span>Browse Files</span>
                  </Button>
                </Label>
                <Input
                  id="ale-upload"
                  type="file"
                  accept=".ale,.ALE"
                  multiple
                  className="hidden"
                  onChange={handleFileInput}
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Imported ALEs */}
      {importedALEs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Imported Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {importedALEs.map(ale => (
                <Badge 
                  key={ale.filename} 
                  variant={ale.warnings.length > 0 ? "secondary" : "default"}
                  className="pl-3 pr-1 py-1.5 text-sm"
                >
                  {ale.warnings.length > 0 && (
                    <AlertCircle className="h-3 w-3 mr-1 text-yellow-500" />
                  )}
                  {ale.filename}
                  <span className="ml-1 text-xs opacity-70">({ale.records.length})</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 ml-1 hover:bg-destructive/20"
                    onClick={() => removeALE(ale.filename)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {allRecords.length > 0 && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Clips</CardDescription>
              <CardTitle className="text-3xl">{summary.totalClips}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Shoot Dates</CardDescription>
              <CardTitle className="text-3xl">{summary.shootDates.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Cameras</CardDescription>
              <CardTitle className="text-3xl">{summary.cameras.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Scenes</CardDescription>
              <CardTitle className="text-3xl">{summary.scenes.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>With CDL</CardDescription>
              <CardTitle className="text-3xl">{summary.withCDL}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Records Table */}
      {allRecords.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Source Clips</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clips..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Clip Name</TableHead>
                    <TableHead>Scene/Take</TableHead>
                    <TableHead>Camera</TableHead>
                    <TableHead>TC In</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Lens</TableHead>
                    <TableHead>Shoot Date</TableHead>
                    <TableHead className="text-center">CDL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.slice(0, 100).map((record, i) => (
                    <TableRow 
                      key={`${record.clip_name}-${i}`}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedRecord(record)}
                    >
                      <TableCell className="font-mono text-xs">
                        {record.clip_name}
                      </TableCell>
                      <TableCell>
                        {record.scene && record.take 
                          ? `${record.scene} T${record.take}`
                          : record.scene || "—"
                        }
                        {record.circled && (
                          <Badge variant="secondary" className="ml-1 text-[10px] px-1">⊙</Badge>
                        )}
                      </TableCell>
                      <TableCell>{record.camera_id || record.camera || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{record.tc_in || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {record.duration_frames ? `${record.duration_frames}f` : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {record.lens}
                        {record.focal_length && ` ${record.focal_length}mm`}
                      </TableCell>
                      <TableCell className="text-xs">{record.shoot_date || "—"}</TableCell>
                      <TableCell className="text-center">
                        {record.cdl_slope_r !== null ? (
                          <Palette className="h-4 w-4 mx-auto text-purple-500" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filteredRecords.length > 100 && (
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Showing 100 of {filteredRecords.length} clips
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono">{selectedRecord?.clip_name}</DialogTitle>
            <DialogDescription>Source media metadata</DialogDescription>
          </DialogHeader>
          {selectedRecord && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <div>
                  <Label className="text-muted-foreground">Scene / Take</Label>
                  <p>{selectedRecord.scene} T{selectedRecord.take} {selectedRecord.circled && "⊙"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Timecode</Label>
                  <p className="font-mono">{selectedRecord.tc_in} → {selectedRecord.tc_out}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Duration</Label>
                  <p>{selectedRecord.duration_frames}f @ {selectedRecord.fps}fps</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Camera</Label>
                  <p>{selectedRecord.camera} ({selectedRecord.camera_id})</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Camera Roll</Label>
                  <p>{selectedRecord.camera_roll}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <Label className="text-muted-foreground">Lens</Label>
                  <p>{selectedRecord.lens} {selectedRecord.focal_length}mm</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Exposure</Label>
                  <p>ISO {selectedRecord.iso}, {selectedRecord.shutter}, {selectedRecord.f_stop || selectedRecord.t_stop}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Colorspace</Label>
                  <p>{selectedRecord.colorspace}</p>
                </div>
                {selectedRecord.cdl_slope_r !== null && (
                  <div>
                    <Label className="text-muted-foreground">CDL</Label>
                    <p className="font-mono text-xs">
                      S({selectedRecord.cdl_slope_r?.toFixed(3)} {selectedRecord.cdl_slope_g?.toFixed(3)} {selectedRecord.cdl_slope_b?.toFixed(3)})<br/>
                      O({selectedRecord.cdl_offset_r?.toFixed(3)} {selectedRecord.cdl_offset_g?.toFixed(3)} {selectedRecord.cdl_offset_b?.toFixed(3)})<br/>
                      P({selectedRecord.cdl_power_r?.toFixed(3)} {selectedRecord.cdl_power_g?.toFixed(3)} {selectedRecord.cdl_power_b?.toFixed(3)})<br/>
                      SAT {selectedRecord.cdl_saturation?.toFixed(3)}
                    </p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">File Path</Label>
                  <p className="font-mono text-xs truncate">{selectedRecord.file_path}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
