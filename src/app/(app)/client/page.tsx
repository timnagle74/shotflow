"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ShotStatusBadge, VersionStatusBadge } from "@/components/status-badge";
import { mockShots, mockSequences, mockVersions, mockNotes, mockUsers, getShotsForProject } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Monitor, Check, RotateCcw, MessageSquare, Film, Eye, ChevronRight } from "lucide-react";
import { useState } from "react";

export default function ClientPortalPage() {
  const [selectedShot, setSelectedShot] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  // Client can only see CLIENT_REVIEW and APPROVED shots
  const allShots = getShotsForProject("p1");
  const clientShots = allShots.filter(s => s.status === "CLIENT_REVIEW" || s.status === "APPROVED");

  const reviewCount = clientShots.filter(s => s.status === "CLIENT_REVIEW").length;
  const approvedCount = clientShots.filter(s => s.status === "APPROVED").length;

  const selected = selectedShot ? allShots.find(s => s.id === selectedShot) : null;
  const selectedVersions = selected ? mockVersions.filter(v => v.shotId === selected.id).sort((a, b) => b.versionNumber - a.versionNumber) : [];
  const [activeVersionId, setActiveVersionId] = useState<string>("");
  const latestVersion = selectedVersions[0];
  const viewingVersion = selectedVersions.find(v => v.id === activeVersionId) || latestVersion;
  const versionNotes = viewingVersion ? mockNotes.filter(n => n.versionId === viewingVersion.id) : [];

  return (
    <div className="space-y-6">
      {/* Client Portal Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Monitor className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Client Review</h1>
            <p className="text-muted-foreground mt-0.5">Nebula Rising — Review shots and provide feedback</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                <span className="text-sm">{reviewCount} for review</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-sm">{approvedCount} approved</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Shot List */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-3">
            {clientShots.length} Shot{clientShots.length !== 1 ? 's' : ''}
          </p>
          {clientShots.map(shot => {
            const isSelected = selectedShot === shot.id;
            const isReview = shot.status === "CLIENT_REVIEW";
            return (
              <Card
                key={shot.id}
                className={cn(
                  "cursor-pointer transition-all",
                  isSelected ? "border-primary bg-primary/5 shadow-sm shadow-primary/10" : "hover:border-primary/40"
                )}
                onClick={() => { setSelectedShot(shot.id); setActiveVersionId(""); setFeedback(""); }}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold">{shot.code}</span>
                    <ShotStatusBadge status={shot.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">{shot.description}</p>
                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="outline" className="text-[10px]">
                      {shot.versions.length} version{shot.versions.length !== 1 ? 's' : ''}
                    </Badge>
                    {isReview && (
                      <span className="flex items-center gap-1 text-[10px] text-purple-400">
                        <Eye className="h-3 w-3" />Needs Review
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {clientShots.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Film className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No shots pending your review</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Check back soon</p>
            </div>
          )}
        </div>

        {/* Shot Review Panel */}
        <div className="lg:col-span-2">
          {!selected ? (
            <Card>
              <CardContent className="flex items-center justify-center py-28">
                <div className="text-center text-muted-foreground">
                  <Monitor className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Select a shot to review</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Click on any shot from the list</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Shot Header + Actions */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="font-mono text-lg">{selected.code}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">{selected.description}</p>
                    </div>
                    <div className="flex gap-2">
                      {selected.status === "CLIENT_REVIEW" && (
                        <>
                          <Button variant="outline" size="sm" className="text-amber-400 border-amber-600/30 hover:bg-amber-600/10">
                            <RotateCcw className="h-4 w-4 mr-1.5" />Request Revision
                          </Button>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700">
                            <Check className="h-4 w-4 mr-1.5" />Approve
                          </Button>
                        </>
                      )}
                      {selected.status === "APPROVED" && (
                        <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-sm py-1 px-3">
                          <Check className="h-3.5 w-3.5 mr-1.5" />Approved
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Media Placeholder */}
                  <div className="aspect-video bg-black/40 rounded-lg flex items-center justify-center border border-border/50">
                    <div className="text-center text-muted-foreground">
                      <Film className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Review media</p>
                      {viewingVersion && (
                        <p className="text-xs mt-1 font-mono">
                          v{String(viewingVersion.versionNumber).padStart(3, "0")} — {viewingVersion.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Version Selector */}
                  {selectedVersions.length > 1 && (
                    <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
                      {selectedVersions.map(v => (
                        <Button
                          key={v.id}
                          size="sm"
                          variant={v.id === (viewingVersion?.id) ? "default" : "outline"}
                          className="shrink-0 font-mono text-xs"
                          onClick={() => setActiveVersionId(v.id)}
                        >
                          v{String(v.versionNumber).padStart(3, "0")}
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Notes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Notes
                    {viewingVersion && (
                      <span className="text-muted-foreground font-normal">
                        — v{String(viewingVersion.versionNumber).padStart(3, "0")}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {versionNotes.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No notes on this version yet</p>
                  )}
                  {versionNotes.map(note => {
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
                  <Separator />
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Leave feedback on this version..."
                      className="min-h-[60px]"
                      value={feedback}
                      onChange={e => setFeedback(e.target.value)}
                    />
                    <Button className="self-end" disabled={!feedback.trim()}>Send</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
