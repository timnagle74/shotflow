"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ShotStatusBadge, VersionStatusBadge } from "@/components/status-badge";
import { mockShots, mockSequences, mockVersions, mockNotes, mockUsers, getShotsForProject } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Monitor, Check, X, MessageSquare, Film } from "lucide-react";
import { useState } from "react";

export default function ClientPortalPage() {
  const [selectedShot, setSelectedShot] = useState<string | null>(null);

  // Client can only see CLIENT_REVIEW and APPROVED shots
  const allShots = getShotsForProject("p1");
  const clientShots = allShots.filter(s => s.status === "CLIENT_REVIEW" || s.status === "APPROVED");

  const selected = selectedShot ? allShots.find(s => s.id === selectedShot) : null;
  const selectedVersions = selected ? mockVersions.filter(v => v.shotId === selected.id).sort((a, b) => b.versionNumber - a.versionNumber) : [];
  const latestVersion = selectedVersions[0];
  const latestNotes = latestVersion ? mockNotes.filter(n => n.versionId === latestVersion.id) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Monitor className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Client Portal</h1>
          <p className="text-muted-foreground mt-1">Review shots and provide feedback — Nebula Rising</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground mb-3">{clientShots.length} shots for review</p>
          {clientShots.map(shot => (
            <Card
              key={shot.id}
              className={cn("cursor-pointer transition-colors", selectedShot === shot.id ? "border-primary" : "hover:border-primary/50")}
              onClick={() => setSelectedShot(shot.id)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold">{shot.code}</span>
                  <ShotStatusBadge status={shot.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{shot.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-[10px]">
                    {shot.versions.length} version{shot.versions.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          {clientShots.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Film className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No shots pending your review</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {!selected ? (
            <Card>
              <CardContent className="flex items-center justify-center py-24">
                <div className="text-center text-muted-foreground">
                  <Monitor className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Select a shot to review</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-mono">{selected.code}</CardTitle>
                    <div className="flex gap-2">
                      {selected.status === "CLIENT_REVIEW" && (
                        <>
                          <Button variant="destructive" size="sm"><X className="h-4 w-4 mr-1" />Request Revision</Button>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700"><Check className="h-4 w-4 mr-1" />Approve</Button>
                        </>
                      )}
                      {selected.status === "APPROVED" && (
                        <Badge className="bg-green-600 text-white border-0"><Check className="h-3 w-3 mr-1" />Approved</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{selected.description}</p>
                  {/* Placeholder for video/image review */}
                  <div className="mt-4 aspect-video bg-muted/30 rounded-lg flex items-center justify-center border border-border">
                    <div className="text-center text-muted-foreground">
                      <Film className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Review media would display here</p>
                      {latestVersion && (
                        <p className="text-xs mt-1">v{String(latestVersion.versionNumber).padStart(3, "0")} • {latestVersion.status}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {latestNotes.map(note => {
                    const author = mockUsers.find(u => u.id === note.authorId);
                    return (
                      <div key={note.id} className="flex gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">{author?.name.split(" ").map(n => n[0]).join("")}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{author?.name}</span>
                            <span className="text-xs text-muted-foreground">{note.createdAt.toLocaleDateString()}</span>
                          </div>
                          <p className="text-sm mt-0.5">{note.content}</p>
                        </div>
                      </div>
                    );
                  })}
                  <Separator />
                  <div className="flex gap-2">
                    <Textarea placeholder="Leave feedback on this shot..." className="min-h-[60px]" />
                    <Button className="self-end">Send</Button>
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
