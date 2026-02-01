"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { FileText, Database, FileCode, Download, Loader2, Calendar, Film, FolderOpen, ExternalLink } from "lucide-react";
import Link from "next/link";
import { downloadEDL } from "@/lib/edl-export";
import { downloadALE } from "@/lib/ale-export";
import { downloadFCPXML } from "@/lib/xml-export";

interface Turnover {
  id: string;
  project_id: string;
  sequence_id: string | null;
  turnover_number: number;
  turnover_date: string;
  title: string | null;
  general_notes: string | null;
  ref_filename: string | null;
  ref_preview_url: string | null;
  source_edl_filename: string | null;
  created_at: string;
  project?: { name: string; code: string };
  sequence?: { name: string; code: string };
  shot_count?: number;
}

interface TurnoverShot {
  id: string;
  turnover_id: string;
  shot_id: string;
  vfx_notes: string | null;
  source_in: string | null;
  source_out: string | null;
  record_in: string | null;
  record_out: string | null;
  duration_frames: number | null;
  clip_name: string | null;
  sort_order: number;
  shot?: { code: string };
}

export default function TurnoversPage() {
  const [turnovers, setTurnovers] = useState<Turnover[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [turnoverShots, setTurnoverShots] = useState<Record<string, TurnoverShot[]>>({});

  useEffect(() => {
    async function loadTurnovers() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("turnovers")
        .select(`
          *,
          project:projects(name, code),
          sequence:sequences(name, code)
        `)
        .order("created_at", { ascending: false }) as { data: Turnover[] | null; error: any };

      if (error) {
        console.error("Error loading turnovers:", error);
      } else if (data) {
        // Get shot counts for each turnover
        const turnoversWithCounts = await Promise.all(
          data.map(async (t: Turnover) => {
            const { count } = await supabase!
              .from("turnover_shots")
              .select("*", { count: "exact", head: true })
              .eq("turnover_id", t.id);
            return { ...t, shot_count: count || 0 };
          })
        );
        setTurnovers(turnoversWithCounts);
      }

      setLoading(false);
    }

    loadTurnovers();
  }, []);

  const loadTurnoverShots = async (turnoverId: string) => {
    if (!supabase || turnoverShots[turnoverId]) return;

    const { data } = await supabase!
      .from("turnover_shots")
      .select(`
        *,
        shot:shots(code)
      `)
      .eq("turnover_id", turnoverId)
      .order("sort_order", { ascending: true }) as { data: TurnoverShot[] | null };

    if (data) {
      setTurnoverShots((prev) => ({ ...prev, [turnoverId]: data }));
    }
  };

  const toggleExpand = (turnoverId: string) => {
    if (expandedId === turnoverId) {
      setExpandedId(null);
    } else {
      setExpandedId(turnoverId);
      loadTurnoverShots(turnoverId);
    }
  };

  const handleExport = (turnover: Turnover, format: 'edl' | 'ale' | 'xml') => {
    const shots = turnoverShots[turnover.id] || [];
    const title = `TO${turnover.turnover_number}_${turnover.title || turnover.project?.code || 'TURNOVER'}`;
    
    const exportShots = shots.map((ts) => ({
      id: ts.shot_id,
      code: ts.shot?.code || 'SHOT',
      clipName: ts.clip_name,
      sourceIn: ts.source_in,
      sourceOut: ts.source_out,
      recordIn: ts.record_in,
      recordOut: ts.record_out,
      durationFrames: ts.duration_frames,
      notes: ts.vfx_notes,
    }));

    if (format === 'edl') {
      downloadEDL(exportShots, { title });
    } else if (format === 'ale') {
      downloadALE(exportShots, { title });
    } else {
      downloadFCPXML(exportShots, { title });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Turnovers</h1>
          <p className="text-muted-foreground mt-1">Editorial turnovers with shots, references, and VFX notes</p>
        </div>
        <Link href="/turnover">
          <Button>
            <FolderOpen className="h-4 w-4 mr-2" />
            New Turnover
          </Button>
        </Link>
      </div>

      {turnovers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No turnovers yet</p>
            <Link href="/turnover">
              <Button variant="link">Import your first turnover</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {turnovers.map((turnover) => (
            <Card key={turnover.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-lg font-mono px-3 py-1">
                      TO{turnover.turnover_number}
                    </Badge>
                    <div>
                      <CardTitle className="text-base">
                        {turnover.title || `Turnover ${turnover.turnover_number}`}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {turnover.project?.name} • {turnover.sequence?.code || "No sequence"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      <Film className="h-3 w-3 mr-1" />
                      {turnover.shot_count} shots
                    </Badge>
                    <Badge variant="secondary">
                      <Calendar className="h-3 w-3 mr-1" />
                      {new Date(turnover.turnover_date).toLocaleDateString()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {turnover.general_notes && (
                  <p className="text-sm text-muted-foreground bg-muted/30 rounded-md p-2">
                    {turnover.general_notes}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {turnover.ref_filename && (
                      <span className="flex items-center gap-1">
                        <Film className="h-3.5 w-3.5" />
                        {turnover.ref_filename}
                      </span>
                    )}
                    {turnover.source_edl_filename && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {turnover.source_edl_filename}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpand(turnover.id)}
                    >
                      {expandedId === turnover.id ? "Hide Shots" : "View Shots"}
                    </Button>
                  </div>
                </div>

                {expandedId === turnover.id && (
                  <div className="border-t pt-3 mt-3 space-y-3">
                    {/* Export buttons */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Download className="h-3 w-3" /> Export:
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => handleExport(turnover, 'edl')}
                      >
                        <FileText className="h-3 w-3 mr-1" />EDL
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => handleExport(turnover, 'ale')}
                      >
                        <Database className="h-3 w-3 mr-1" />ALE
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => handleExport(turnover, 'xml')}
                      >
                        <FileCode className="h-3 w-3 mr-1" />XML
                      </Button>
                    </div>

                    {/* Shots table */}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">Shot</TableHead>
                          <TableHead>VFX Notes</TableHead>
                          <TableHead className="w-[100px]">Source In</TableHead>
                          <TableHead className="w-[100px]">Source Out</TableHead>
                          <TableHead className="w-[80px]">Frames</TableHead>
                          <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(turnoverShots[turnover.id] || []).map((ts) => (
                          <TableRow key={ts.id}>
                            <TableCell className="font-mono font-medium">
                              {ts.shot?.code || "—"}
                            </TableCell>
                            <TableCell className="text-sm max-w-[300px] truncate">
                              {ts.vfx_notes || <span className="text-muted-foreground italic">No notes</span>}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{ts.source_in || "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{ts.source_out || "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{ts.duration_frames || "—"}</TableCell>
                            <TableCell>
                              <Link href={`/shots/${ts.shot_id}`}>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
