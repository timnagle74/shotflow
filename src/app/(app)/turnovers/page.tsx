"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { 
  FileText, Database, FileCode, Download, Loader2, Calendar, Film, 
  FolderOpen, ExternalLink, CheckCircle2, Clock, Building2, AlertCircle,
  ArrowRight, Eye
} from "lucide-react";
import Link from "next/link";
import { downloadEDL } from "@/lib/edl-export";
import { downloadALE } from "@/lib/ale-export";
import { downloadFCPXML } from "@/lib/xml-export";
import { cn } from "@/lib/utils";
import { TurnoverStepper } from "@/components/turnover-stepper";

interface Turnover {
  id: string;
  project_id: string;
  sequence_id: string | null;
  turnover_number: number;
  turnover_date: string;
  title: string | null;
  general_notes: string | null;
  status: string | null;
  ref_filename: string | null;
  ref_preview_url: string | null;
  source_edl_filename: string | null;
  created_at: string;
  reviewed_at: string | null;
  project?: { name: string; code: string };
  sequence?: { name: string; code: string };
  shot_count?: number;
  assigned_count?: number;
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
  vendor_id: string | null;
  sort_order: number;
  shot?: { code: string };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; step: "import" | "review" | "assign" | "production" }> = {
  draft: { label: "Imported — Needs Review", color: "bg-amber-500", icon: Clock, step: "import" },
  reviewed: { label: "Reviewed — Needs Assignment", color: "bg-blue-500", icon: AlertCircle, step: "review" },
  assigned: { label: "Assigned — In Production", color: "bg-green-500", icon: CheckCircle2, step: "production" },
  in_progress: { label: "In Production", color: "bg-green-500", icon: Building2, step: "production" },
  delivered: { label: "Delivered", color: "bg-purple-500", icon: CheckCircle2, step: "production" },
};

export default function TurnoversPage() {
  const [turnovers, setTurnovers] = useState<Turnover[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [turnoverShots, setTurnoverShots] = useState<Record<string, TurnoverShot[]>>({});
  const [statusFilter, setStatusFilter] = useState<string>("all");

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
        // Get shot counts and assignment counts for each turnover
        const turnoversWithCounts = await Promise.all(
          data.map(async (t: Turnover) => {
            const { count: shotCount } = await supabase!
              .from("turnover_shots")
              .select("*", { count: "exact", head: true })
              .eq("turnover_id", t.id);
            
            const { count: assignedCount } = await supabase!
              .from("turnover_shots")
              .select("*", { count: "exact", head: true })
              .eq("turnover_id", t.id)
              .not("vendor_id", "is", null);

            return { 
              ...t, 
              shot_count: shotCount || 0,
              assigned_count: assignedCount || 0,
            };
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

  const getStatusConfig = (status: string | null) => {
    return STATUS_CONFIG[status || 'draft'] || STATUS_CONFIG.draft;
  };

  const getActionButton = (turnover: Turnover) => {
    const status = turnover.status || 'draft';
    
    switch (status) {
      case 'draft':
        return (
          <Link href={`/turnover/${turnover.id}/review`}>
            <Button size="sm">
              Review <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        );
      case 'reviewed':
        return (
          <Link href={`/turnover/${turnover.id}/assign`}>
            <Button size="sm" variant="default">
              <Building2 className="h-3 w-3 mr-1" />
              Assign Vendors
            </Button>
          </Link>
        );
      case 'assigned':
      case 'in_progress':
      case 'delivered':
        return (
          <Link href={`/turnover/${turnover.id}/review`}>
            <Button size="sm" variant="outline">
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>
          </Link>
        );
      default:
        return null;
    }
  };

  // Filter turnovers
  const filteredTurnovers = turnovers.filter(t => {
    if (statusFilter === "all") return true;
    if (statusFilter === "needs_action") {
      return (t.status || 'draft') === 'draft' || (t.status || 'draft') === 'reviewed';
    }
    return (t.status || 'draft') === statusFilter;
  });

  // Count by status
  const statusCounts = {
    all: turnovers.length,
    needs_action: turnovers.filter(t => ['draft', 'reviewed'].includes(t.status || 'draft')).length,
    draft: turnovers.filter(t => (t.status || 'draft') === 'draft').length,
    reviewed: turnovers.filter(t => t.status === 'reviewed').length,
    assigned: turnovers.filter(t => t.status === 'assigned').length,
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

      {/* Status Filters */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all" className="gap-1">
            All
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">{statusCounts.all}</Badge>
          </TabsTrigger>
          <TabsTrigger value="needs_action" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Needs Action
            {statusCounts.needs_action > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5">{statusCounts.needs_action}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="draft" className="gap-1">
            Draft
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">{statusCounts.draft}</Badge>
          </TabsTrigger>
          <TabsTrigger value="reviewed" className="gap-1">
            Needs Assignment
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">{statusCounts.reviewed}</Badge>
          </TabsTrigger>
          <TabsTrigger value="assigned" className="gap-1">
            Assigned
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">{statusCounts.assigned}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredTurnovers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">
              {statusFilter === "all" ? "No turnovers yet" : `No turnovers with status "${statusFilter}"`}
            </p>
            {statusFilter === "all" && (
              <Link href="/turnover">
                <Button variant="link">Import your first turnover</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredTurnovers.map((turnover) => {
            const statusConfig = getStatusConfig(turnover.status);
            const StatusIcon = statusConfig.icon;
            
            return (
              <Card key={turnover.id} className={cn(
                (turnover.status || 'draft') === 'reviewed' && "border-amber-500/50"
              )}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-lg font-mono px-3 py-1">
                        TO{turnover.turnover_number}
                      </Badge>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {turnover.title || `Turnover ${turnover.turnover_number}`}
                          <Badge 
                            variant="secondary" 
                            className={cn("text-[10px] text-white", statusConfig.color)}
                          >
                            <StatusIcon className="h-2.5 w-2.5 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {turnover.project?.name} • {turnover.sequence?.code || "No sequence"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          <Film className="h-3 w-3 mr-1" />
                          {turnover.shot_count} shots
                        </Badge>
                        {turnover.status === 'assigned' && (
                          <Badge variant="outline" className="text-green-500 border-green-500/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {turnover.assigned_count}/{turnover.shot_count} assigned
                          </Badge>
                        )}
                        <Badge variant="secondary">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(turnover.turnover_date).toLocaleDateString()}
                        </Badge>
                      </div>
                      {getActionButton(turnover)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Pipeline stepper */}
                  <TurnoverStepper currentStep={statusConfig.step} className="pb-2" />

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
                            <TableHead className="w-[100px]">Vendor</TableHead>
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
                                {ts.vendor_id ? (
                                  <Badge variant="outline" className="text-green-500 text-[10px]">
                                    <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                    Assigned
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                    Unassigned
                                  </Badge>
                                )}
                              </TableCell>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
