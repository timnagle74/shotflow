"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ShotStatusBadge, VersionStatusBadge } from "@/components/status-badge";
import { complexityColors, shotStatusLabels, cn } from "@/lib/utils";
import { ArrowLeft, Clock, Film, User, MessageSquare, Layers, Calendar, Hash, Camera, Ruler, Gauge, FileVideo, Loader2, Monitor, Palette, Download, Play, Video, FolderOpen, CheckCircle, RotateCcw, AlertCircle, History, Send, Trash2, MoreHorizontal, ArrowRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { ShotStatus } from "@/lib/database.types";
import { VideoPlayer } from "@/components/video-player";
import { AnnotatedPlayer } from "@/components/annotated-player";
import { VersionUpload } from "@/components/version-upload";
import { DownloadButton, VideoStatusBadge } from "@/components/bunny-player";
import { PlateUpload } from "@/components/plate-upload";
import { RefUpload } from "@/components/ref-upload";
import { ShotCountSheet } from "@/components/shot-count-sheet";
import { downloadEDL } from "@/lib/edl-export";
import { downloadALE } from "@/lib/ale-export";
import { downloadFCPXML } from "@/lib/xml-export";
import { FileText, Database, FileCode } from "lucide-react";

// Allowed status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  NOT_STARTED: ["IN_PROGRESS"],
  IN_PROGRESS: ["INTERNAL_REVIEW"],
  INTERNAL_REVIEW: ["CLIENT_REVIEW"],
  CLIENT_REVIEW: ["APPROVED", "REVISIONS"],
  REVISIONS: ["IN_PROGRESS"],
  APPROVED: ["FINAL"],
  FINAL: [],
};

interface Shot {
  id: string;
  code: string;
  description: string | null;
  status: string;
  complexity: string;
  assigned_to_id: string | null;
  due_date: string | null;
  frame_start: number | null;
  frame_end: number | null;
  record_frame_in: number | null;
  record_frame_out: number | null;
  record_tc_in: string | null;
  record_tc_out: string | null;
  source_tc_in: string | null;
  source_tc_out: string | null;
  handle_head: number | null;
  handle_tail: number | null;
  plate_source: string | null;
  source_clip_name: string | null;
  camera_data: any;
  edit_ref: string | null;
  notes: string | null;
  sequence_id: string;
  // New ref fields
  ref_filename: string | null;
  ref_storage_path: string | null;
  ref_cdn_url: string | null;
  ref_video_id: string | null;
  ref_preview_url: string | null;
}

interface ShotPlate {
  id: string;
  shot_id: string;
  filename: string;
  description: string | null;
  storage_path: string;
  cdn_url: string | null;
  file_size: number | null;
  sort_order: number;
  created_at: string;
  video_id: string | null;
  preview_url: string | null;
}

interface Sequence {
  id: string;
  name: string;
  code: string;
  project_id: string;
}

interface Project {
  id: string;
  name: string;
  code: string;
}

interface TurnoverShot {
  id: string;
  turnover_id: string;
  vendor_id: string | null;
  artist_id: string | null;
  reel_name: string | null;
  turnover: {
    id: string;
    turnover_number: number;
    turnover_date: string | null;
  } | null;
  vendor: {
    id: string;
    name: string;
  } | null;
}

interface Version {
  id: string;
  shot_id: string;
  version_number: number;
  version_code?: string | null;
  status: string;
  description: string | null;
  file_path?: string | null;
  thumbnail_path?: string | null;
  preview_url: string | null;
  download_url?: string | null;
  bunny_video_id?: string | null;
  video_id?: string | null;
  cdn_url?: string | null;
  filename?: string | null;
  created_by_id: string | null;
  submitted_by_id?: string | null;
  created_at: string;
}

interface Note {
  id: string;
  version_id: string;
  author_id: string;
  content: string;
  frame_reference: number | null;
  created_at: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function ShotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { currentUser, isAdmin } = useCurrentUser();
  const shotId = params.id as string;
  
  // Roles that can approve/reject versions
  const canApprove = currentUser && ['ADMIN', 'VFX_SUPERVISOR', 'POST_SUPERVISOR', 'SUPERVISOR', 'PRODUCER'].includes(currentUser.role);

  const [loading, setLoading] = useState(true);
  const [shot, setShot] = useState<Shot | null>(null);
  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [plates, setPlates] = useState<ShotPlate[]>([]);
  const [turnoverShot, setTurnoverShot] = useState<TurnoverShot | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>("NOT_STARTED");
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [updating, setUpdating] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [revisionNotes, setRevisionNotes] = useState("");
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [updatingVersionStatus, setUpdatingVersionStatus] = useState(false);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [playerSource, setPlayerSource] = useState<'version' | 'ref' | 'plate'>('version');
  const [selectedPlateId, setSelectedPlateId] = useState<string | null>(null);
  const [showLut, setShowLut] = useState<{ name: string; url: string } | null>(null);
  const [siblingShots, setSiblingShots] = useState<{ id: string; code: string }[]>([]);

  // Fetch all data
  useEffect(() => {
    async function fetchData() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        // Fetch shot
        const { data: shotData, error: shotError } = await supabase
          .from("shots")
          .select("*")
          .eq("id", shotId)
          .single() as { data: Shot | null; error: any };

        if (shotError || !shotData) {
          console.error("Shot fetch error:", shotError);
          setLoading(false);
          return;
        }

        setShot(shotData);
        setCurrentStatus(shotData.status);

        // Fetch sequence
        const { data: seqData } = await supabase
          .from("sequences")
          .select("*")
          .eq("id", shotData.sequence_id)
          .single() as { data: Sequence | null; error: any };

        if (seqData) {
          setSequence(seqData);

          // Fetch sibling shots for plate reassignment
          const { data: siblingsData } = await supabase
            .from("shots")
            .select("id, code")
            .eq("sequence_id", seqData.id)
            .neq("id", shotId)
            .order("code", { ascending: true });
          
          if (siblingsData) {
            setSiblingShots(siblingsData);
          }

          // Fetch project
          const { data: projData } = await supabase
            .from("projects")
            .select("*")
            .eq("id", seqData.project_id)
            .single() as { data: Project | null; error: any };

          if (projData) {
            setProject(projData);
            
            // Fetch default show LUT
            const { data: lutData } = await supabase
              .from("lut_files")
              .select("name, file_path")
              .eq("project_id", projData.id)
              .eq("is_default", true)
              .single();
            
            if (lutData && lutData.file_path) {
              setShowLut({ name: lutData.name, url: lutData.file_path });
            }
          }
        }

        // Fetch turnover_shot data (for vendor, reel, TO# info)
        const { data: tsData } = await supabase
          .from("turnover_shots")
          .select(`
            id, turnover_id, vendor_id, artist_id, reel_name,
            turnover:turnovers(id, turnover_number, turnover_date),
            vendor:vendors(id, name)
          `)
          .eq("shot_id", shotId)
          .limit(1)
          .single();

        if (tsData) {
          setTurnoverShot(tsData as unknown as TurnoverShot);
        }

        // Fetch versions — prefer shot_versions (richer schema), fall back to legacy versions table
        const { data: shotVersionsData, error: svError } = await supabase
          .from("shot_versions")
          .select("*")
          .eq("shot_id", shotId)
          .order("version_number", { ascending: false });

        let allVersionIds: string[] = [];

        if (!svError && shotVersionsData && shotVersionsData.length > 0) {
          const mapped: Version[] = shotVersionsData.map((sv) => ({
            id: sv.id,
            shot_id: sv.shot_id,
            version_number: sv.version_number,
            version_code: sv.version_code,
            status: sv.status,
            description: null,
            preview_url: sv.preview_url,
            video_id: sv.video_id,
            cdn_url: sv.cdn_url,
            filename: sv.filename,
            created_by_id: sv.submitted_by_id,
            created_at: sv.created_at,
          }));
          setVersions(mapped);
          setSelectedVersion(mapped[0].id);
          allVersionIds = mapped.map(v => v.id);
        } else {
          // Fallback to legacy versions table
          const { data: versionsData } = await supabase
            .from("versions")
            .select("*")
            .eq("shot_id", shotId)
            .order("version_number", { ascending: false });

          if (versionsData && versionsData.length > 0) {
            setVersions(versionsData as unknown as Version[]);
            setSelectedVersion(versionsData[0].id);
            allVersionIds = versionsData.map((v: any) => v.id);
          }
        }

        if (allVersionIds.length > 0) {
          const { data: notesData } = await supabase
            .from("notes")
            .select("*")
            .in("version_id", allVersionIds)
            .order("created_at", { ascending: true }) as { data: Note[] | null; error: any };

          if (notesData) {
            setNotes(notesData);
          }
        }

        // Fetch users with limited columns
        const { data: usersData } = await supabase
          .from("users")
          .select("id, name, email, role")
          .limit(500) as { data: UserProfile[] | null; error: any };

        if (usersData) {
          setUsers(usersData);
        }

        // Fetch plates
        const { data: platesData } = await supabase
          .from("shot_plates")
          .select("*")
          .eq("shot_id", shotId)
          .order("sort_order", { ascending: true }) as { data: ShotPlate[] | null; error: any };

        if (platesData) {
          setPlates(platesData);
        }

      } catch (err) {
        console.error("Data fetch error:", err);
      }

      setLoading(false);
    }

    fetchData();
  }, [shotId]);

  const refreshPlates = useCallback(async () => {
    if (!supabase) return;
    
    const { data: platesData } = await supabase
      .from("shot_plates")
      .select("*")
      .eq("shot_id", shotId)
      .order("sort_order", { ascending: true }) as { data: ShotPlate[] | null; error: any };

    if (platesData) {
      setPlates(platesData);
    }
  }, [shotId]);

  const handleUnassignPlate = useCallback(async (plateId: string) => {
    if (!supabase) return;
    
    const { error } = await (supabase
      .from("shot_plates") as any)
      .delete()
      .eq("id", plateId);
    
    if (!error) {
      setPlates(prev => prev.filter(p => p.id !== plateId));
    }
  }, []);

  const handleReassignPlate = useCallback(async (plateId: string, newShotId: string) => {
    if (!supabase) return;
    
    const { error } = await (supabase
      .from("shot_plates") as any)
      .update({ shot_id: newShotId })
      .eq("id", plateId);
    
    if (!error) {
      setPlates(prev => prev.filter(p => p.id !== plateId));
    }
  }, []);

  const refreshShot = useCallback(async () => {
    if (!supabase) return;
    
    const { data: shotData } = await supabase
      .from("shots")
      .select("*")
      .eq("id", shotId)
      .single() as { data: Shot | null; error: any };

    if (shotData) {
      setShot(shotData);
    }
  }, [shotId]);

  const refreshVersions = useCallback(async () => {
    if (!supabase) return;
    
    // Prefer shot_versions, fall back to legacy versions
    const { data: svData, error: svError } = await supabase
      .from("shot_versions")
      .select("*")
      .eq("shot_id", shotId)
      .order("version_number", { ascending: false });

    if (!svError && svData && svData.length > 0) {
      const mapped: Version[] = svData.map((sv) => ({
        id: sv.id,
        shot_id: sv.shot_id,
        version_number: sv.version_number,
        version_code: sv.version_code,
        status: sv.status,
        description: null,
        preview_url: sv.preview_url,
        video_id: sv.video_id,
        cdn_url: sv.cdn_url,
        filename: sv.filename,
        created_by_id: sv.submitted_by_id,
        created_at: sv.created_at,
      }));
      setVersions(mapped);
      if (mapped.length > 0 && !selectedVersion) {
        setSelectedVersion(mapped[0].id);
      }
    } else {
      const { data: versionsData } = await supabase
        .from("versions")
        .select("*")
        .eq("shot_id", shotId)
        .order("version_number", { ascending: false });

      if (versionsData) {
        setVersions(versionsData as unknown as Version[]);
        if (versionsData.length > 0 && !selectedVersion) {
          setSelectedVersion(versionsData[0].id);
        }
      }
    }
  }, [shotId, selectedVersion]);

  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!supabase) return;
    
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("shots")
        .update({ status: newStatus as any })
        .eq("id", shotId);

      if (error) {
        console.error("Failed to update status:", error);
        setUpdating(false);
        return;
      }

      setCurrentStatus(newStatus);
    } catch (err) {
      console.error("Status update error:", err);
    }
    setUpdating(false);
  }, [shotId]);

  const [postingNote, setPostingNote] = useState(false);

  const handlePostNote = useCallback(async () => {
    if (!supabase || !noteText.trim() || !selectedVersion || !authUser) return;
    setPostingNote(true);
    try {
      // Look up the public user id from auth id
      const { data: pubUser } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", authUser.id)
        .single();

      const authorId = pubUser?.id || authUser.id;

      const { data: newNote, error } = await supabase
        .from("notes")
        .insert({
          version_id: selectedVersion,
          author_id: authorId,
          content: noteText.trim(),
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to post note:", error);
      } else if (newNote) {
        setNotes(prev => [...prev, newNote as Note]);
        setNoteText("");
      }
    } catch (err) {
      console.error("Post note error:", err);
    }
    setPostingNote(false);
  }, [noteText, selectedVersion, authUser]);

  // Version status handlers
  const handleVersionStatusChange = async (newStatus: string, notes?: string) => {
    if (!selectedVersion) return;
    setUpdatingVersionStatus(true);
    try {
      const res = await fetch(`/api/versions/${selectedVersion}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, notes }),
      });
      
      if (res.ok) {
        // Update local state
        setVersions(prev => prev.map(v => 
          v.id === selectedVersion ? { ...v, status: newStatus } : v
        ));
        setShowRevisionDialog(false);
        setRevisionNotes("");
        // Refresh history
        fetchStatusHistory(selectedVersion);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update status");
      }
    } catch (err) {
      console.error("Failed to update version status:", err);
      alert("Failed to update status");
    }
    setUpdatingVersionStatus(false);
  };

  const fetchStatusHistory = async (versionId: string) => {
    try {
      const res = await fetch(`/api/versions/${versionId}/status`);
      if (res.ok) {
        const data = await res.json();
        setStatusHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch status history:", err);
    }
  };

  // Fetch status history when version changes
  useEffect(() => {
    if (selectedVersion) {
      fetchStatusHistory(selectedVersion);
    } else {
      setStatusHistory([]);
    }
  }, [selectedVersion]);

  const handleAssignmentChange = useCallback(async (userId: string) => {
    if (!supabase) return;
    const assignedId = userId === "unassigned" ? null : userId;
    try {
      const { error } = await supabase
        .from("shots")
        .update({ assigned_to_id: assignedId })
        .eq("id", shotId);

      if (error) {
        console.error("Failed to update assignment:", error);
      } else {
        setShot(prev => prev ? { ...prev, assigned_to_id: assignedId } : prev);
      }
    } catch (err) {
      console.error("Assignment update error:", err);
    }
  }, [shotId]);

  const handleComplexityChange = useCallback(async (newComplexity: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from("shots")
        .update({ complexity: newComplexity as any })
        .eq("id", shotId);

      if (error) {
        console.error("Failed to update complexity:", error);
      } else {
        setShot(prev => prev ? { ...prev, complexity: newComplexity } : prev);
      }
    } catch (err) {
      console.error("Complexity update error:", err);
    }
  }, [shotId]);

  const handleDueDateChange = useCallback(async (newDate: string) => {
    if (!supabase) return;
    const dateValue = newDate || null;
    try {
      const { error } = await supabase
        .from("shots")
        .update({ due_date: dateValue })
        .eq("id", shotId);

      if (error) {
        console.error("Failed to update due date:", error);
      } else {
        setShot(prev => prev ? { ...prev, due_date: dateValue } : prev);
      }
    } catch (err) {
      console.error("Due date update error:", err);
    }
  }, [shotId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!shot) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Shot not found</h2>
          <Link href="/shots"><Button variant="link" className="mt-2">Back to shots</Button></Link>
        </div>
      </div>
    );
  }

  const assignee = shot.assigned_to_id ? users.find(u => u.id === shot.assigned_to_id) : null;
  const currentVersionNotes = notes.filter(n => n.version_id === selectedVersion);
  // Calculate frame counts - prefer record TC range, fall back to frame_start/frame_end
  const handleHead = shot.handle_head || 8;
  const handleTail = shot.handle_tail || 8;
  
  let cutLength: number | null = null;
  let frameStart: number | null = null;
  let frameEnd: number | null = null;
  
  if (shot.record_frame_in != null && shot.record_frame_out != null && shot.record_frame_out > shot.record_frame_in) {
    cutLength = shot.record_frame_out - shot.record_frame_in;
    frameStart = shot.record_frame_in;
    frameEnd = shot.record_frame_out;
  } else if (shot.frame_start != null && shot.frame_end != null && shot.frame_end > shot.frame_start) {
    cutLength = shot.frame_end - shot.frame_start;
    frameStart = shot.frame_start;
    frameEnd = shot.frame_end;
  }
  
  const compLength = cutLength != null ? cutLength + handleHead + handleTail : null;
  const frameCount = cutLength;
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];
  const selectedVersionData = versions.find(v => v.id === selectedVersion);

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Title */}
      <div className="flex items-center gap-4">
        <Link href="/shots">
          <Button variant="ghost" size="icon" className="shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold font-mono">{shot.code}</h1>
            <ShotStatusBadge status={currentStatus} />
            <Badge variant="outline" className={cn("text-xs", complexityColors[shot.complexity as keyof typeof complexityColors])}>{shot.complexity}</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            {sequence?.name} • {sequence?.code} • {project?.name}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {updating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {allowedTransitions.map(key => (
            <Button
              key={key}
              size="sm"
              variant={key === "REVISIONS" ? "destructive" : "outline"}
              disabled={updating}
              onClick={() => handleStatusChange(key)}
            >
              {shotStatusLabels[key as keyof typeof shotStatusLabels] || key}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Metadata */}
        <div className="space-y-4">
          {/* Shot Info Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shot Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {shot.description && (
                <div>
                  <label className="text-xs text-muted-foreground">Description</label>
                  <p className="text-sm mt-0.5">{shot.description}</p>
                </div>
              )}
              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Film className="h-3 w-3" />Frame Range</span>
                  <span className="text-sm font-mono">{frameStart ?? '—'}–{frameEnd ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Ruler className="h-3 w-3" />Cut / Comp</span>
                  <span className="text-sm font-mono">
                    {cutLength != null ? `${cutLength}f` : '—'} / {compLength != null ? `${compLength}f` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Hash className="h-3 w-3" />Handles</span>
                  <span className="text-sm font-mono">H{shot.handle_head || 8} / T{shot.handle_tail || 8}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Gauge className="h-3 w-3" />Complexity</span>
                  <Select defaultValue={shot.complexity} onValueChange={handleComplexityChange}>
                    <SelectTrigger className="w-28 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SIMPLE">Simple</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="COMPLEX">Complex</SelectItem>
                      <SelectItem value="HERO">Hero</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3 w-3" />Due Date</span>
                  <Input
                    type="date"
                    className="w-32 h-7 text-xs"
                    value={shot.due_date || ""}
                    onChange={(e) => handleDueDateChange(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Camera className="h-3 w-3" />Plate Source</span>
                  <span className="text-sm text-muted-foreground truncate max-w-[150px]" title={shot.source_clip_name || shot.plate_source || undefined}>
                    {shot.source_clip_name || shot.plate_source || "—"}
                  </span>
                </div>
              </div>

              {shot.notes && (
                <>
                  <Separator />
                  <div>
                    <label className="text-xs text-muted-foreground">Shot Notes</label>
                    <p className="text-sm mt-1 text-amber-300 bg-amber-600/10 rounded-md p-2">{shot.notes}</p>
                  </div>
                </>
              )}

              {showLut && (
                <>
                  <Separator />
                  <div>
                    <label className="text-xs text-muted-foreground">Show LUT</label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-1.5 gap-2"
                      asChild
                    >
                      <a href={showLut.url} download>
                        <Palette className="h-4 w-4" />
                        {showLut.name}
                        <Download className="h-3 w-3 ml-auto" />
                      </a>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Count Sheet */}
          <ShotCountSheet
            shot={shot}
            sequenceName={sequence?.name || ""}
            sequenceCode={sequence?.code || ""}
            projectName={project?.name || ""}
            projectCode={project?.code || ""}
            shotAction={shot.description || undefined}
            vfxSummary={shot.notes || undefined}
            sceneNumber={shot.code.split("_")[0] || undefined}
            sourceClip={shot.source_clip_name || undefined}
            turnoverNumber={turnoverShot?.turnover?.turnover_number?.toString() || undefined}
            turnoverDate={turnoverShot?.turnover?.turnover_date || undefined}
            vendor={turnoverShot?.vendor?.name || undefined}
            reelNumber={turnoverShot?.reel_name || undefined}
          />

          {/* Assignment Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {assignee && (
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{assignee.name.split(" ").map(n => n[0]).join("")}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{assignee.name}</p>
                    <p className="text-xs text-muted-foreground">{assignee.role}</p>
                  </div>
                </div>
              )}
              <Select defaultValue={assignee?.id || "unassigned"} onValueChange={handleAssignmentChange}>
                <SelectTrigger><SelectValue placeholder="Assign artist" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.filter(u => u.role === "ARTIST" || u.role === "VFX_EDITOR" || u.role === "SUPERVISOR" || u.role === "PRODUCER").map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Source Materials Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5" />Source Materials
                </CardTitle>
                <div className="flex items-center gap-1">
                  <RefUpload
                    shotId={shot.id}
                    projectCode={project?.code || "PROJ"}
                    shotCode={shot.code}
                    currentRef={shot.ref_filename}
                    onUploadComplete={() => refreshShot()}
                    trigger={<Button size="sm" variant="ghost" className="h-7 px-2"><Video className="h-3.5 w-3.5" /></Button>}
                  />
                  <PlateUpload
                    shotId={shot.id}
                    projectCode={project?.code || "PROJ"}
                    shotCode={shot.code}
                    onUploadComplete={() => refreshPlates()}
                    trigger={<Button size="sm" variant="ghost" className="h-7 px-2"><Film className="h-3.5 w-3.5" /></Button>}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Reference Clip */}
              <div>
                <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Video className="h-3 w-3" /> Reference Clip
                </label>
                {shot.ref_filename ? (
                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                    <Film className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="text-sm truncate flex-1">{shot.ref_filename}</span>
                    {shot.ref_cdn_url && (
                      <a href={shot.ref_cdn_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="h-7 px-2">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No reference uploaded</p>
                )}
              </div>

              <Separator />

              {/* Plates */}
              <div>
                <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Film className="h-3 w-3" /> Source Plates ({plates.length})
                </label>
                {plates.length > 0 ? (
                  <div className="space-y-1.5">
                    {plates.map((plate) => (
                      <div key={plate.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                        <Film className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{plate.filename}</p>
                          {plate.description && (
                            <p className="text-xs text-muted-foreground truncate">{plate.description}</p>
                          )}
                        </div>
                        {plate.cdn_url && (
                          <a href={plate.cdn_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost" className="h-7 px-2">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 px-2">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {siblingShots.length > 0 && (
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <ArrowRight className="h-3.5 w-3.5 mr-2" />
                                  Move to shot
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                                  {siblingShots.map((s) => (
                                    <DropdownMenuItem
                                      key={s.id}
                                      onClick={() => handleReassignPlate(plate.id, s.id)}
                                    >
                                      {s.code}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleUnassignPlate(plate.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Remove plate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No plates uploaded</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Export Turnover Files Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5" />Export Turnover Files
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">Download shot data in industry-standard formats for VFX vendors.</p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto py-2 flex-col gap-1"
                  onClick={() => downloadEDL(
                    [{
                      code: shot.code,
                      clipName: shot.code,
                      sourceIn: shot.frame_start ? `01:00:00:${String(shot.frame_start % 24).padStart(2, '0')}` : undefined,
                      sourceOut: shot.frame_end ? `01:00:00:${String(shot.frame_end % 24).padStart(2, '0')}` : undefined,
                    }],
                    { title: `${project?.code || 'PROJ'}_${shot.code}` }
                  )}
                >
                  <FileText className="h-4 w-4" />
                  <span className="text-xs">EDL</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto py-2 flex-col gap-1"
                  onClick={() => downloadALE(
                    [{
                      code: shot.code,
                      clipName: shot.code,
                      sourceIn: shot.frame_start ? `01:00:00:${String(shot.frame_start % 24).padStart(2, '0')}` : '00:00:00:00',
                      sourceOut: shot.frame_end ? `01:00:00:${String(shot.frame_end % 24).padStart(2, '0')}` : '00:00:04:00',
                      notes: shot.notes || shot.description || undefined,
                    }],
                    { title: `${project?.code || 'PROJ'}_${shot.code}` }
                  )}
                >
                  <Database className="h-4 w-4" />
                  <span className="text-xs">ALE</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto py-2 flex-col gap-1"
                  onClick={() => downloadFCPXML(
                    [{
                      id: shot.id,
                      code: shot.code,
                      clipName: shot.code,
                      durationFrames: shot.frame_start && shot.frame_end ? shot.frame_end - shot.frame_start : 100,
                    }],
                    { title: `${project?.code || 'PROJ'}_${shot.code}` }
                  )}
                >
                  <FileCode className="h-4 w-4" />
                  <span className="text-xs">XML</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Video Player, Versions + Notes */}
        <div className="lg:col-span-2 space-y-4">
          {/* Video Player */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  Review Player
                  {versions.length > 0 && selectedVersionData && (
                    <span className="text-muted-foreground font-normal">
                      — v{String(selectedVersionData.version_number).padStart(3, "0")}
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {/* Source toggle */}
                  <ToggleGroup 
                    type="single" 
                    value={playerSource} 
                    onValueChange={(v) => v && setPlayerSource(v as 'version' | 'ref' | 'plate')}
                    className="h-8"
                  >
                    <ToggleGroupItem value="version" className="text-xs px-2 h-7">Version</ToggleGroupItem>
                    <ToggleGroupItem value="ref" className="text-xs px-2 h-7" disabled={!shot.ref_preview_url}>Ref</ToggleGroupItem>
                    <ToggleGroupItem value="plate" className="text-xs px-2 h-7" disabled={plates.length === 0}>Plates</ToggleGroupItem>
                  </ToggleGroup>
                  {/* Plate selector when in plate mode */}
                  {playerSource === 'plate' && plates.length > 0 && (
                    <Select value={selectedPlateId || plates[0]?.id} onValueChange={setSelectedPlateId}>
                      <SelectTrigger className="h-7 w-[140px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {plates.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">{p.filename}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {/* Video transcoding status */}
                  {selectedVersion && selectedVersionData?.bunny_video_id && playerSource === 'version' && (
                    <VideoStatusBadge versionId={selectedVersion} />
                  )}
                  {/* ProRes download button */}
                  {selectedVersion && selectedVersionData?.download_url && playerSource === 'version' && (
                    <DownloadButton 
                      versionId={selectedVersion} 
                      filename={`${shot.code}_v${String(selectedVersionData.version_number).padStart(3, '0')}.mov`}
                    />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {(() => {
                // Determine which URL to play based on source toggle
                let hlsUrl: string | undefined;
                let sourceLabel = "";
                
                if (playerSource === 'version') {
                  hlsUrl = selectedVersionData?.preview_url || undefined;
                  sourceLabel = selectedVersionData ? `v${String(selectedVersionData.version_number).padStart(3, "0")}` : "";
                } else if (playerSource === 'ref') {
                  hlsUrl = shot.ref_preview_url || undefined;
                  sourceLabel = "Reference";
                } else if (playerSource === 'plate') {
                  const selectedPlate = plates.find(p => p.id === (selectedPlateId || plates[0]?.id));
                  hlsUrl = selectedPlate?.preview_url || undefined;
                  sourceLabel = selectedPlate?.filename || "Plate";
                }
                
                if (!hlsUrl) {
                  return (
                    <div className="aspect-video bg-muted/30 rounded-lg flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <Film className="h-12 w-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">
                          {playerSource === 'version' && "No version preview available"}
                          {playerSource === 'ref' && "No reference uploaded"}
                          {playerSource === 'plate' && "No plate preview available"}
                        </p>
                        <p className="text-xs mt-1">
                          {playerSource === 'version' && versions.length === 0 && "Upload a version to see it here"}
                          {playerSource === 'ref' && "Upload a reference from turnover"}
                          {playerSource === 'plate' && "Plates are transcoding or not uploaded"}
                        </p>
                      </div>
                    </div>
                  );
                }
                
                // Use AnnotatedPlayer for all sources (version, ref, plate)
                if (playerSource === 'version' && selectedVersion && selectedVersionData) {
                  return (
                    <AnnotatedPlayer
                      source={{ type: 'version', id: selectedVersion }}
                      hlsUrl={hlsUrl}
                      poster={selectedVersionData?.thumbnail_path || undefined}
                      fps={24}
                    />
                  );
                }
                
                if (playerSource === 'ref' && shot.id && shot.ref_preview_url) {
                  // Shot refs are stored directly on the shot record (not in turnover_refs)
                  // Use shotRef type with shot.id as the identifier
                  return (
                    <AnnotatedPlayer
                      source={{ type: 'shotRef', id: shot.id }}
                      hlsUrl={hlsUrl}
                      fps={24}
                    />
                  );
                }
                
                if (playerSource === 'plate') {
                  const selectedPlate = plates.find(p => p.id === (selectedPlateId || plates[0]?.id));
                  if (selectedPlate) {
                    return (
                      <AnnotatedPlayer
                        source={{ type: 'plate', id: selectedPlate.id }}
                        hlsUrl={hlsUrl}
                        fps={24}
                      />
                    );
                  }
                }
                
                // Fallback to VideoPlayer if no valid source
                return (
                  <VideoPlayer
                    shotCode={shot.code}
                    projectName={project?.name || "Project"}
                    frameRate={24}
                    frameStart={shot.frame_start || 1001}
                    showBurnInControls={true}
                    showAspectRatioControls={true}
                    hlsUrl={hlsUrl}
                    poster={selectedVersionData?.thumbnail_path || undefined}
                  />
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4" />Version History
                </CardTitle>
                <VersionUpload
                  shotId={shot.id}
                  nextVersionNumber={(versions[0]?.version_number || 0) + 1}
                  createdById={assignee?.id || users[0]?.id || ''}
                  onUploadComplete={() => {
                    refreshVersions();
                  }}
                />
              </div>
            </CardHeader>
            <CardContent>
              {versions.length === 0 ? (
                <div className="text-center py-10">
                  <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No versions yet</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-[27px] top-3 bottom-3 w-px bg-border" />
                  <div className="space-y-1">
                    {versions.map((version, idx) => {
                      const creator = users.find(u => u.id === version.created_by_id);
                      const noteCount = notes.filter(n => n.version_id === version.id).length;
                      const isSelected = version.id === selectedVersion;
                      const isLatest = idx === 0;

                      return (
                        <div
                          key={version.id}
                          onClick={() => setSelectedVersion(version.id)}
                          className={cn(
                            "relative flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-all",
                            isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/40"
                          )}
                        >
                          <div className={cn(
                            "relative z-10 h-[14px] w-[14px] rounded-full border-2 shrink-0",
                            isSelected ? "border-primary bg-primary" :
                            version.status === "APPROVED" ? "border-green-500 bg-green-500" :
                            version.status === "REVISE" ? "border-red-500 bg-red-500" :
                            "border-border bg-background"
                          )} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-mono font-bold">v{String(version.version_number).padStart(3, "0")}</span>
                              <VersionStatusBadge status={version.status} />
                              {isLatest && <Badge variant="outline" className="text-[10px]">Latest</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">{version.description || "No description"}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-muted-foreground">{creator?.name || 'Unknown'}</span>
                              <span className="text-xs text-muted-foreground">{new Date(version.created_at).toLocaleDateString()}</span>
                              {noteCount > 0 && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />{noteCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Version Approval Card */}
          {selectedVersion && selectedVersionData && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Approval — v{String(selectedVersionData.version_number).padStart(3, "0")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Current Status</span>
                  <VersionStatusBadge status={selectedVersionData.status} />
                </div>

                {/* Action Buttons */}
                {canApprove && selectedVersionData.status !== 'WIP' && (
                  <div className="flex gap-2">
                    {selectedVersionData.status === 'PENDING_REVIEW' && (
                      <>
                        <Button
                          size="sm"
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          disabled={updatingVersionStatus}
                          onClick={() => handleVersionStatusChange('APPROVED')}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          disabled={updatingVersionStatus}
                          onClick={() => setShowRevisionDialog(true)}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Revisions
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingVersionStatus}
                          onClick={() => handleVersionStatusChange('CBB')}
                          title="Could Be Better"
                        >
                          CBB
                        </Button>
                      </>
                    )}
                    {selectedVersionData.status === 'APPROVED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={updatingVersionStatus}
                        onClick={() => setShowRevisionDialog(true)}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Request Revisions
                      </Button>
                    )}
                  </div>
                )}

                {/* Submit for Review (for artists) */}
                {selectedVersionData.status === 'WIP' && (
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={updatingVersionStatus}
                    onClick={() => handleVersionStatusChange('PENDING_REVIEW')}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Submit for Review
                  </Button>
                )}

                {/* Retract from Review */}
                {selectedVersionData.status === 'PENDING_REVIEW' && !canApprove && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={updatingVersionStatus}
                    onClick={() => handleVersionStatusChange('WIP')}
                  >
                    Retract Submission
                  </Button>
                )}

                {/* Status History */}
                {statusHistory.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <History className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">History</span>
                      </div>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {statusHistory.slice(0, 5).map((entry: any) => (
                          <div key={entry.id} className="text-xs flex items-start gap-2">
                            <span className="text-muted-foreground whitespace-nowrap">
                              {new Date(entry.created_at).toLocaleDateString()}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-medium">{entry.to_status}</span>
                            <span className="text-muted-foreground">by {entry.changed_by?.name || 'Unknown'}</span>
                            {entry.notes && (
                              <span className="text-amber-400 truncate" title={entry.notes}>
                                "{entry.notes}"
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Revision Notes Dialog */}
          <Dialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Revisions</DialogTitle>
                <DialogDescription>
                  Please provide notes explaining what needs to be revised.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Textarea
                  placeholder="Describe the revisions needed..."
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  rows={4}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowRevisionDialog(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={!revisionNotes.trim() || updatingVersionStatus}
                  onClick={() => handleVersionStatusChange('REVISE', revisionNotes)}
                >
                  {updatingVersionStatus ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                  Request Revisions
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {selectedVersion && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Notes — v{String(selectedVersionData?.version_number || 0).padStart(3, "0")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentVersionNotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No notes on this version</p>
                ) : (
                  <div className="space-y-4">
                    {currentVersionNotes.map(note => {
                      const author = users.find(u => u.id === note.author_id);
                      return (
                        <div key={note.id} className="flex gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-primary">{author?.name?.split(" ").map(n => n[0]).join("") || '?'}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{author?.name || 'Unknown'}</span>
                              <Badge variant="outline" className="text-[10px]">{author?.role || 'USER'}</Badge>
                              <span className="text-xs text-muted-foreground">{new Date(note.created_at).toLocaleDateString()}</span>
                              {note.frame_reference && (
                                <Badge variant="secondary" className="text-[10px] font-mono">f{note.frame_reference}</Badge>
                              )}
                            </div>
                            <p className="text-sm mt-1.5 leading-relaxed">{note.content}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <Separator />
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Add a note..."
                    className="min-h-[60px]"
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                  />
                  <Button className="self-end" disabled={!noteText.trim() || postingNote} onClick={handlePostNote}>
                    {postingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
