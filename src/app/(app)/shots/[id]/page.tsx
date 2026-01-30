"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ShotStatusBadge, VersionStatusBadge } from "@/components/status-badge";
import { complexityColors, shotStatusLabels, cn } from "@/lib/utils";
import { ArrowLeft, Clock, Film, User, MessageSquare, Layers, Calendar, Hash, Camera, Ruler, Gauge, FileVideo, Loader2, Monitor, Palette, Download, Play, Video, FolderOpen } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { ShotStatus } from "@/lib/database.types";
import { VideoPlayer } from "@/components/video-player";
import { VersionUpload } from "@/components/version-upload";
import { DownloadButton, VideoStatusBadge } from "@/components/bunny-player";
import { PlateUpload } from "@/components/plate-upload";
import { RefUpload } from "@/components/ref-upload";
import { ShotCountSheet } from "@/components/shot-count-sheet";

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
  handle_head: number | null;
  handle_tail: number | null;
  plate_source: string | null;
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

interface Version {
  id: string;
  shot_id: string;
  version_number: number;
  status: string;
  description: string | null;
  file_path: string | null;
  thumbnail_path: string | null;
  preview_url: string | null;
  download_url: string | null;
  bunny_video_id: string | null;
  created_by_id: string | null;
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
  const shotId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [shot, setShot] = useState<Shot | null>(null);
  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [plates, setPlates] = useState<ShotPlate[]>([]);
  const [currentStatus, setCurrentStatus] = useState<string>("NOT_STARTED");
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [updating, setUpdating] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [playerSource, setPlayerSource] = useState<'version' | 'ref' | 'plate'>('version');
  const [selectedPlateId, setSelectedPlateId] = useState<string | null>(null);

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

          // Fetch project
          const { data: projData } = await supabase
            .from("projects")
            .select("*")
            .eq("id", seqData.project_id)
            .single() as { data: Project | null; error: any };

          if (projData) {
            setProject(projData);
          }
        }

        // Fetch versions
        const { data: versionsData } = await supabase
          .from("versions")
          .select("*")
          .eq("shot_id", shotId)
          .order("version_number", { ascending: false }) as { data: Version[] | null; error: any };

        if (versionsData) {
          setVersions(versionsData);
          if (versionsData.length > 0) {
            setSelectedVersion(versionsData[0].id);
          }
        }

        // Fetch notes
        const { data: notesData } = await supabase
          .from("notes")
          .select("*")
          .order("created_at", { ascending: true }) as { data: Note[] | null; error: any };

        if (notesData) {
          setNotes(notesData);
        }

        // Fetch users
        const { data: usersData } = await supabase
          .from("users")
          .select("*") as { data: UserProfile[] | null; error: any };

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
    
    const { data: versionsData } = await supabase
      .from("versions")
      .select("*")
      .eq("shot_id", shotId)
      .order("version_number", { ascending: false }) as { data: Version[] | null; error: any };

    if (versionsData) {
      setVersions(versionsData as Version[]);
      if (versionsData.length > 0 && !selectedVersion) {
        setSelectedVersion(versionsData[0].id);
      }
    }
  }, [shotId, selectedVersion]);

  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!supabase) return;
    
    setUpdating(true);
    try {
      const { error } = await (supabase as any)
        .from("shots")
        .update({ status: newStatus })
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
  const frameCount = shot.frame_start && shot.frame_end ? shot.frame_end - shot.frame_start : null;
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
                  <span className="text-sm font-mono">{shot.frame_start || '—'}–{shot.frame_end || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Ruler className="h-3 w-3" />Duration</span>
                  <span className="text-sm font-mono">{frameCount ? `${frameCount}f (${(frameCount / 24).toFixed(1)}s)` : '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Hash className="h-3 w-3" />Handles</span>
                  <span className="text-sm font-mono">H{shot.handle_head || 8} / T{shot.handle_tail || 8}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Gauge className="h-3 w-3" />Complexity</span>
                  <span className={cn("text-sm font-semibold", complexityColors[shot.complexity as keyof typeof complexityColors])}>{shot.complexity}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3 w-3" />Due Date</span>
                  <span className="text-sm">{shot.due_date ? new Date(shot.due_date).toLocaleDateString() : "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Camera className="h-3 w-3" />Plate Source</span>
                  <span className="text-sm text-muted-foreground">{shot.plate_source || "—"}</span>
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
            </CardContent>
          </Card>

          {/* Count Sheet */}
          <ShotCountSheet
            shot={shot}
            sequenceName={sequence?.name || ""}
            projectName={project?.name || ""}
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
              <Select defaultValue={assignee?.id || ""}>
                <SelectTrigger><SelectValue placeholder="Assign artist" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.filter(u => u.role === "ARTIST" || u.role === "SUPERVISOR").map(u => (
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
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No plates uploaded</p>
                )}
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
                  <Button className="self-end" disabled={!noteText.trim()}>Post</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
