"use client";

import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShotStatusBadge, VersionStatusBadge } from "@/components/status-badge";
import { mockShots, mockSequences, mockUsers, mockVersions, mockNotes, mockProjects, getDeliverySpecsForProject, getCDLForShot, getLutFilesForShot, getLutFilesForProject, getMetadataForShot } from "@/lib/mock-data";
import { complexityColors, shotStatusLabels, cn } from "@/lib/utils";
import { ArrowLeft, Clock, Film, User, MessageSquare, Layers, Calendar, Hash, Camera, Ruler, Gauge, FileVideo, Loader2, Monitor, Palette, Download, Play } from "lucide-react";
import Link from "next/link";
import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { ShotStatus } from "@/lib/database.types";
import { VideoPlayer } from "@/components/video-player";

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

export default function ShotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const shotId = params.id as string;

  const shot = mockShots.find(s => s.id === shotId);
  const [currentStatus, setCurrentStatus] = useState<string>(shot?.status || "NOT_STARTED");
  const [updating, setUpdating] = useState(false);

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

  const sequence = mockSequences.find(s => s.id === shot.sequenceId);
  const project = sequence ? mockProjects.find(p => p.id === sequence.projectId) : null;
  const deliverySpecs = project ? getDeliverySpecsForProject(project.id) : null;
  const shotMetadata = getMetadataForShot(shot.id);
  const shotCDL = getCDLForShot(shot.id);
  const shotLuts = getLutFilesForShot(shot.id);
  const projectLuts = project ? getLutFilesForProject(project.id).filter(l => !l.shotId) : [];
  const assignee = shot.assignedToId ? mockUsers.find(u => u.id === shot.assignedToId) : null;
  const versions = mockVersions.filter(v => v.shotId === shot.id).sort((a, b) => b.versionNumber - a.versionNumber);
  const [selectedVersion, setSelectedVersion] = useState(versions[0]?.id || "");
  const [noteText, setNoteText] = useState("");

  const currentVersionNotes = mockNotes.filter(n => n.versionId === selectedVersion);
  const frameCount = shot.frameStart && shot.frameEnd ? shot.frameEnd - shot.frameStart : null;

  const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];

  const handleStatusChange = useCallback(async (newStatus: string) => {
    setUpdating(true);
    try {
      if (supabase) {
        const { error } = await (supabase as any)
          .from("shots")
          .update({ status: newStatus })
          .eq("id", shotId);
        if (error) {
          console.error("Failed to update status:", error);
          setUpdating(false);
          return;
        }
      }
      // Update local state (works for both mock and Supabase modes)
      setCurrentStatus(newStatus);
      // Also update mock data in memory so navigation stays consistent
      const idx = mockShots.findIndex(s => s.id === shotId);
      if (idx !== -1) {
        (mockShots[idx] as { status: string }).status = newStatus;
      }
    } catch (err) {
      console.error("Status update error:", err);
    }
    setUpdating(false);
  }, [shotId]);

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
            <Badge variant="outline" className={cn("text-xs", complexityColors[shot.complexity])}>{shot.complexity}</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            {sequence?.name} • {sequence?.code}
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
              {shotStatusLabels[key] || key}
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
                  <span className="text-sm font-mono">{shot.frameStart}–{shot.frameEnd}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Ruler className="h-3 w-3" />Duration</span>
                  <span className="text-sm font-mono">{frameCount}f ({frameCount ? (frameCount / 24).toFixed(1) : 0}s)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Hash className="h-3 w-3" />Handles</span>
                  <span className="text-sm font-mono">H{shot.handleHead} / T{shot.handleTail}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Gauge className="h-3 w-3" />Complexity</span>
                  <span className={cn("text-sm font-semibold", complexityColors[shot.complexity])}>{shot.complexity}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3 w-3" />Due Date</span>
                  <span className="text-sm">{shot.dueDate?.toLocaleDateString() || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Camera className="h-3 w-3" />Plate Source</span>
                  <span className="text-sm text-muted-foreground">—</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5"><FileVideo className="h-3 w-3" />Camera</span>
                  <span className="text-sm text-muted-foreground">—</span>
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

          {/* Camera / Metadata Card */}
          {shotMetadata && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5" />Camera / Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Camera", value: shotMetadata.camera },
                  { label: "Lens", value: shotMetadata.lens },
                  { label: "Focal Length", value: shotMetadata.focalLength },
                  { label: "Focus Distance", value: shotMetadata.focusDistance },
                  { label: "T-Stop", value: shotMetadata.tStop },
                  { label: "F-Stop", value: shotMetadata.fStop },
                  { label: "ISO", value: shotMetadata.eiIso },
                  { label: "Shutter", value: shotMetadata.shutter },
                  { label: "Sensor FPS", value: shotMetadata.sensorFps },
                  { label: "White Balance", value: shotMetadata.whiteBalance },
                  { label: "Colorspace", value: shotMetadata.colorspace },
                  { label: "Codec", value: shotMetadata.codec },
                  { label: "Src Resolution", value: shotMetadata.srcResolution },
                  { label: "Look / LUT", value: shotMetadata.lookInfo },
                  { label: "DOP", value: shotMetadata.dop },
                  { label: "Director", value: shotMetadata.director },
                  { label: "Shoot Date", value: shotMetadata.shootDate },
                  { label: "Tape / Reel", value: shotMetadata.tape },
                  { label: "Scene", value: shotMetadata.scene },
                  { label: "Take", value: shotMetadata.take },
                  { label: "Circled", value: shotMetadata.circled ? "Yes" : null },
                  { label: "Sound Roll", value: shotMetadata.soundRoll },
                  { label: "Sound TC", value: shotMetadata.soundTc },
                  { label: "Duration", value: shotMetadata.duration },
                ].filter(({ value }) => value != null && String(value).trim() !== '').map(({ label, value }) => (
                  <div key={label} className="flex items-start justify-between gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">{label}</span>
                    <span className="text-sm text-right font-mono">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Color / CDL Card */}
          {(shotCDL || shotLuts.length > 0 || projectLuts.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5" />Color
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {shotCDL && (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground">Slope (R/G/B)</label>
                      <p className="text-sm font-mono">{shotCDL.slopeR.toFixed(4)} / {shotCDL.slopeG.toFixed(4)} / {shotCDL.slopeB.toFixed(4)}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Offset (R/G/B)</label>
                      <p className="text-sm font-mono">{shotCDL.offsetR.toFixed(4)} / {shotCDL.offsetG.toFixed(4)} / {shotCDL.offsetB.toFixed(4)}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Power (R/G/B)</label>
                      <p className="text-sm font-mono">{shotCDL.powerR.toFixed(4)} / {shotCDL.powerG.toFixed(4)} / {shotCDL.powerB.toFixed(4)}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Saturation</span>
                      <span className="text-sm font-mono">{shotCDL.saturation.toFixed(4)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Source</span>
                      <Badge variant="outline" className="text-xs">{shotCDL.source}</Badge>
                    </div>
                    {shotCDL.sourceFile && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Source File</span>
                        <span className="text-xs font-mono">{shotCDL.sourceFile}</span>
                      </div>
                    )}
                    <Separator />
                  </>
                )}
                {(shotLuts.length > 0 || projectLuts.length > 0) && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block">LUT Files</label>
                    <div className="space-y-2">
                      {[...shotLuts, ...projectLuts].map(lut => (
                        <div key={lut.id} className="flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <p className="font-mono truncate">{lut.name}</p>
                            <p className="text-muted-foreground">{lut.lutType} • {lut.format}{lut.isDefault ? ' • Default' : ''}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
                  {mockUsers.filter(u => u.role === "ARTIST" || u.role === "SUPERVISOR").map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Delivery Specs Card */}
          {deliverySpecs && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Monitor className="h-3.5 w-3.5" />Delivery Specs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Resolution", value: deliverySpecs.resolution },
                  { label: "Format", value: deliverySpecs.format },
                  { label: "Frame Rate", value: deliverySpecs.frameRate ? `${deliverySpecs.frameRate} fps` : null },
                  { label: "Color Space", value: deliverySpecs.colorSpace },
                  { label: "Bit Depth", value: deliverySpecs.bitDepth },
                  { label: "Handles", value: `H${deliverySpecs.handlesHead} / T${deliverySpecs.handlesTail}` },
                  { label: "Naming", value: deliverySpecs.namingConvention },
                  { label: "Audio", value: deliverySpecs.audioRequirements },
                ].map(({ label, value }) => value ? (
                  <div key={label} className="flex items-start justify-between gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">{label}</span>
                    <span className="text-sm text-right font-mono">{value}</span>
                  </div>
                ) : null)}
                {deliverySpecs.additionalNotes && (
                  <>
                    <Separator />
                    <div>
                      <label className="text-xs text-muted-foreground">Notes</label>
                      <p className="text-sm mt-1 text-blue-300 bg-blue-600/10 rounded-md p-2">{deliverySpecs.additionalNotes}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
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
                  {versions.length > 0 && (
                    <span className="text-muted-foreground font-normal">
                      — v{String(versions.find(v => v.id === selectedVersion)?.versionNumber || versions[0]?.versionNumber || 0).padStart(3, "0")}
                    </span>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <VideoPlayer
                shotCode={shot.code}
                projectName={project?.name || "Project"}
                frameRate={24}
                frameStart={shot.frameStart || 1001}
                showBurnInControls={true}
                showAspectRatioControls={true}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4" />Version History
                </CardTitle>
                <Button size="sm">Submit New Version</Button>
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
                      const creator = mockUsers.find(u => u.id === version.createdById);
                      const noteCount = mockNotes.filter(n => n.versionId === version.id).length;
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
                              <span className="text-sm font-mono font-bold">v{String(version.versionNumber).padStart(3, "0")}</span>
                              <VersionStatusBadge status={version.status} />
                              {isLatest && <Badge variant="outline" className="text-[10px]">Latest</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">{version.description || "No description"}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-muted-foreground">{creator?.name}</span>
                              <span className="text-xs text-muted-foreground">{version.createdAt.toLocaleDateString()}</span>
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
                  Notes — v{String(versions.find(v => v.id === selectedVersion)?.versionNumber || 0).padStart(3, "0")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentVersionNotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No notes on this version</p>
                ) : (
                  <div className="space-y-4">
                    {currentVersionNotes.map(note => {
                      const author = mockUsers.find(u => u.id === note.authorId);
                      return (
                        <div key={note.id} className="flex gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-primary">{author?.name.split(" ").map(n => n[0]).join("")}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{author?.name}</span>
                              <Badge variant="outline" className="text-[10px]">{author?.role}</Badge>
                              <span className="text-xs text-muted-foreground">{note.createdAt.toLocaleDateString()}</span>
                              {note.frameReference && (
                                <Badge variant="secondary" className="text-[10px] font-mono">f{note.frameReference}</Badge>
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
