"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShotStatusBadge, VersionStatusBadge } from "@/components/status-badge";
import { mockShots, mockSequences, mockUsers, mockVersions, mockNotes } from "@/lib/mock-data";
import { complexityColors, cn } from "@/lib/utils";
import { ArrowLeft, Clock, Film, User, MessageSquare, Layers, Calendar, Hash, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function ShotDetailPage() {
  const params = useParams();
  const shotId = params.id as string;

  const shot = mockShots.find(s => s.id === shotId);
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
  const assignee = shot.assignedToId ? mockUsers.find(u => u.id === shot.assignedToId) : null;
  const versions = mockVersions.filter(v => v.shotId === shot.id).sort((a, b) => b.versionNumber - a.versionNumber);
  const [selectedVersion, setSelectedVersion] = useState(versions[0]?.id || "");

  const currentVersionNotes = mockNotes.filter(n => n.versionId === selectedVersion);

  const frameCount = shot.frameStart && shot.frameEnd ? shot.frameEnd - shot.frameStart : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/shots">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-mono">{shot.code}</h1>
            <ShotStatusBadge status={shot.status} />
            <span className={cn("text-sm font-semibold", complexityColors[shot.complexity])}>{shot.complexity}</span>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            {sequence?.name} • {sequence?.code}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Select defaultValue={shot.status}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Change status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NOT_STARTED">Not Started</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="INTERNAL_REVIEW">Internal Review</SelectItem>
              <SelectItem value="CLIENT_REVIEW">Client Review</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="FINAL">Final</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Shot Info */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Shot Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {shot.description && (
                <div>
                  <label className="text-xs text-muted-foreground">Description</label>
                  <p className="text-sm mt-0.5">{shot.description}</p>
                </div>
              )}
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" />Assignee</label>
                  <p className="text-sm font-medium mt-0.5">{assignee?.name || "Unassigned"}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Due Date</label>
                  <p className="text-sm font-medium mt-0.5">{shot.dueDate?.toLocaleDateString() || "—"}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground flex items-center gap-1"><Film className="h-3 w-3" />Frames</label>
                  <p className="text-sm font-mono mt-0.5">{shot.frameStart}–{shot.frameEnd} ({frameCount}f)</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground flex items-center gap-1"><Hash className="h-3 w-3" />Handles</label>
                  <p className="text-sm font-mono mt-0.5">H{shot.handleHead} / T{shot.handleTail}</p>
                </div>
              </div>
              {shot.notes && (
                <>
                  <Separator />
                  <div>
                    <label className="text-xs text-muted-foreground">Shot Notes</label>
                    <p className="text-sm mt-0.5 text-amber-300">{shot.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              <Select defaultValue={assignee?.id || ""}>
                <SelectTrigger><SelectValue placeholder="Assign artist" /></SelectTrigger>
                <SelectContent>
                  {mockUsers.filter(u => u.role === "ARTIST" || u.role === "SUPERVISOR").map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {/* Versions & Notes */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4" />Version History
                </CardTitle>
                <Button size="sm">Submit New Version</Button>
              </div>
            </CardHeader>
            <CardContent>
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No versions yet</p>
              ) : (
                <div className="space-y-2">
                  {versions.map(version => {
                    const creator = mockUsers.find(u => u.id === version.createdById);
                    const noteCount = mockNotes.filter(n => n.versionId === version.id).length;
                    const isSelected = version.id === selectedVersion;
                    return (
                      <div
                        key={version.id}
                        onClick={() => setSelectedVersion(version.id)}
                        className={cn(
                          "flex items-center gap-4 p-3 rounded-md cursor-pointer transition-colors",
                          isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"
                        )}
                      >
                        <div className="h-10 w-14 rounded bg-muted/50 flex items-center justify-center">
                          <span className="text-sm font-mono font-bold">v{String(version.versionNumber).padStart(3, "0")}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{version.description || "No description"}</span>
                            <VersionStatusBadge status={version.status} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {creator?.name} • {version.createdAt.toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span className="text-xs">{noteCount}</span>
                        </div>
                        <ChevronRight className={cn("h-4 w-4 transition-transform", isSelected && "rotate-90")} />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes for selected version */}
          {selectedVersion && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Notes — v{String(versions.find(v => v.id === selectedVersion)?.versionNumber || 0).padStart(3, "0")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentVersionNotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No notes on this version</p>
                ) : (
                  <div className="space-y-3">
                    {currentVersionNotes.map(note => {
                      const author = mockUsers.find(u => u.id === note.authorId);
                      return (
                        <div key={note.id} className="flex gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">{author?.name.split(" ").map(n => n[0]).join("")}</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{author?.name}</span>
                              <Badge variant="outline" className="text-[10px]">{author?.role}</Badge>
                              <span className="text-xs text-muted-foreground">{note.createdAt.toLocaleDateString()}</span>
                              {note.frameReference && (
                                <Badge variant="secondary" className="text-[10px]">Frame {note.frameReference}</Badge>
                              )}
                            </div>
                            <p className="text-sm mt-1">{note.content}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <Separator />
                <div className="flex gap-2">
                  <Textarea placeholder="Add a note..." className="min-h-[60px]" />
                  <Button className="self-end">Post</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
