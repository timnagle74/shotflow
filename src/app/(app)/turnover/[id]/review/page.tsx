"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Check, AlertCircle, Film, Video, FolderOpen, Loader2, 
  MessageSquare, ArrowLeft, Send, Link2, Unlink, Upload, Plus, Image as ImageIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface TurnoverShot {
  id: string;
  shot_id: string;
  vfx_notes: string | null;
  source_in: string | null;
  source_out: string | null;
  record_in: string | null;
  record_out: string | null;
  duration_frames: number | null;
  clip_name: string | null;
  reel_name: string | null;
  sort_order: number;
  plates_assigned: boolean;
  refs_assigned: boolean;
  notes_complete: boolean;
  shot: {
    id: string;
    code: string;
    description: string | null;
  };
}

interface TurnoverRef {
  id: string;
  filename: string;
  cdn_url: string | null;
  preview_url: string | null;
  auto_matched: boolean;
  // Assigned shots via junction
  assigned_shots: string[]; // turnover_shot_ids
}

interface ShotPlate {
  id: string;
  shot_id: string;
  filename: string;
  cdn_url: string | null;
  preview_url: string | null;
}

interface Turnover {
  id: string;
  turnover_number: number;
  title: string | null;
  general_notes: string | null;
  status: string;
  project: {
    id: string;
    name: string;
  };
  sequence: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export default function TurnoverReviewPage() {
  const params = useParams();
  const router = useRouter();
  const turnoverId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [turnover, setTurnover] = useState<Turnover | null>(null);
  const [shots, setShots] = useState<TurnoverShot[]>([]);
  const [refs, setRefs] = useState<TurnoverRef[]>([]);
  const [plates, setPlates] = useState<ShotPlate[]>([]);
  
  // Local edits
  const [shotNotes, setShotNotes] = useState<Record<string, string>>({});
  const [refAssignments, setRefAssignments] = useState<Record<string, string[]>>({}); // refId -> turnoverShotIds

  // Upload state
  const [uploadingRef, setUploadingRef] = useState(false);
  const [uploadingPlate, setUploadingPlate] = useState<string | null>(null); // shot_id being uploaded to
  const refInputRef = useRef<HTMLInputElement>(null);
  const plateInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Load turnover data
  useEffect(() => {
    async function loadTurnover() {
      if (!supabase || !turnoverId) return;

      try {
        // Load turnover with project and sequence
        const { data: turnoverData, error: turnoverError } = await supabase
          .from("turnovers")
          .select(`
            id, turnover_number, title, general_notes, status,
            project:projects(id, name),
            sequence:sequences(id, name, code)
          `)
          .eq("id", turnoverId)
          .single();

        if (turnoverError) throw turnoverError;
        setTurnover(turnoverData as any);

        // Load turnover shots with shot details
        const { data: shotsData, error: shotsError } = await supabase
          .from("turnover_shots")
          .select(`
            id, shot_id, vfx_notes, source_in, source_out, record_in, record_out,
            duration_frames, clip_name, reel_name, sort_order,
            plates_assigned, refs_assigned, notes_complete,
            shot:shots(id, code, description)
          `)
          .eq("turnover_id", turnoverId)
          .order("sort_order");

        if (shotsError) throw shotsError;
        const typedShots = (shotsData || []) as TurnoverShot[];
        setShots(typedShots);

        // Initialize notes from existing data
        const existingNotes: Record<string, string> = {};
        for (const shot of typedShots) {
          if (shot.vfx_notes) {
            existingNotes[shot.id] = shot.vfx_notes;
          }
        }
        setShotNotes(existingNotes);

        // Load refs with assignments
        const { data: refsData, error: refsError } = await supabase
          .from("turnover_refs")
          .select("id, filename, cdn_url, preview_url, auto_matched")
          .eq("turnover_id", turnoverId)
          .order("sort_order");

        if (refsError) throw refsError;
        const typedRefs = (refsData || []) as Array<{id: string; filename: string; cdn_url: string | null; preview_url: string | null; auto_matched: boolean}>;

        // Load ref assignments
        const { data: refAssignData } = await supabase
          .from("turnover_shot_refs")
          .select("turnover_shot_id, turnover_ref_id")
          .in("turnover_ref_id", typedRefs.map(r => r.id));
        
        const typedRefAssigns = (refAssignData || []) as Array<{turnover_shot_id: string; turnover_ref_id: string}>;

        // Build assignment map
        const assignments: Record<string, string[]> = {};
        for (const ref of typedRefs) {
          assignments[ref.id] = typedRefAssigns
            .filter(a => a.turnover_ref_id === ref.id)
            .map(a => a.turnover_shot_id);
        }
        setRefAssignments(assignments);

        const refsWithAssignments = typedRefs.map(ref => ({
          ...ref,
          assigned_shots: assignments[ref.id] || [],
        }));
        setRefs(refsWithAssignments);

        // Load plates for all shots
        const shotIds = typedShots.map(s => s.shot_id);
        if (shotIds.length > 0) {
          const { data: platesData } = await supabase
            .from("shot_plates")
            .select("id, shot_id, filename, cdn_url, preview_url")
            .in("shot_id", shotIds)
            .order("sort_order");

          setPlates(platesData || []);
        }

      } catch (err) {
        console.error("Failed to load turnover:", err);
        setError("Failed to load turnover data");
      } finally {
        setLoading(false);
      }
    }

    loadTurnover();
  }, [turnoverId]);

  // Update shot note locally
  const updateNote = useCallback((turnoverShotId: string, note: string) => {
    setShotNotes(prev => ({ ...prev, [turnoverShotId]: note }));
  }, []);

  // Toggle ref assignment for a shot
  const toggleRefAssignment = useCallback((refId: string, turnoverShotId: string) => {
    setRefAssignments(prev => {
      const current = prev[refId] || [];
      const isAssigned = current.includes(turnoverShotId);
      return {
        ...prev,
        [refId]: isAssigned 
          ? current.filter(id => id !== turnoverShotId)
          : [...current, turnoverShotId],
      };
    });
  }, []);

  // Upload ref file
  const handleRefUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !turnover) return;
    
    setUploadingRef(true);
    try {
      const res = await fetch("/api/turnover/upload-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turnoverId: turnover.id,
          projectId: turnover.project.id,
          type: "ref",
          filename: file.name,
          fileSize: file.size,
        }),
      });
      
      if (!res.ok) throw new Error("Failed to prepare upload");
      const { uploadUrl, accessKey, ref } = await res.json();
      
      // Upload to Bunny
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "AccessKey": accessKey, "Content-Type": "application/octet-stream" },
        body: file,
      });
      
      if (uploadRes.ok || uploadRes.status === 201) {
        // Add to local refs list
        setRefs(prev => [...prev, { ...ref, assigned_shots: [] }]);
      }
    } catch (err) {
      console.error("Ref upload error:", err);
      setError("Failed to upload reference");
    } finally {
      setUploadingRef(false);
      if (refInputRef.current) refInputRef.current.value = "";
    }
  }, [turnover]);

  // Upload plate file for a specific shot
  const handlePlateUpload = useCallback(async (shotId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !turnover) return;
    
    setUploadingPlate(shotId);
    try {
      const res = await fetch("/api/turnover/upload-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turnoverId: turnover.id,
          projectId: turnover.project.id,
          type: "plate",
          shotId,
          filename: file.name,
          fileSize: file.size,
        }),
      });
      
      if (!res.ok) throw new Error("Failed to prepare upload");
      const { uploadUrl, accessKey, plate } = await res.json();
      
      // Upload to Bunny
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "AccessKey": accessKey, "Content-Type": "application/octet-stream" },
        body: file,
      });
      
      if (uploadRes.ok || uploadRes.status === 201) {
        // Add to local plates list
        setPlates(prev => [...prev, plate]);
      }
    } catch (err) {
      console.error("Plate upload error:", err);
      setError("Failed to upload plate");
    } finally {
      setUploadingPlate(null);
      const input = plateInputRefs.current[shotId];
      if (input) input.value = "";
    }
  }, [turnover]);

  // Save all changes
  const handleSave = useCallback(async () => {
    if (!supabase) return;
    setSaving(true);

    try {
      // Cast to any for new columns not yet in types
      const db = supabase as any;
      
      // Update shot notes
      for (const [turnoverShotId, notes] of Object.entries(shotNotes)) {
        await db
          .from("turnover_shots")
          .update({ 
            vfx_notes: notes || null,
            notes_complete: !!notes?.trim(),
          })
          .eq("id", turnoverShotId);
      }

      // Update ref assignments
      for (const [refId, shotIds] of Object.entries(refAssignments)) {
        // Delete existing assignments for this ref
        await db
          .from("turnover_shot_refs")
          .delete()
          .eq("turnover_ref_id", refId);

        // Insert new assignments
        if (shotIds.length > 0) {
          await db
            .from("turnover_shot_refs")
            .insert(shotIds.map((tsId: string) => ({
              turnover_ref_id: refId,
              turnover_shot_id: tsId,
              auto_matched: false, // Manual assignment
            })));

          // Update refs_assigned status
          await db
            .from("turnover_shots")
            .update({ refs_assigned: true })
            .in("id", shotIds);
        }
      }

      // Mark shots without refs as not assigned
      const allAssignedShotIds = Object.values(refAssignments).flat();
      const unassignedShots = shots.filter(s => !allAssignedShotIds.includes(s.id));
      if (unassignedShots.length > 0) {
        await db
          .from("turnover_shots")
          .update({ refs_assigned: false })
          .in("id", unassignedShots.map(s => s.id));
      }

    } catch (err) {
      console.error("Save error:", err);
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }, [shotNotes, refAssignments, shots]);

  // Publish turnover (mark as reviewed)
  const handlePublish = useCallback(async () => {
    if (!supabase || !turnoverId) return;
    setPublishing(true);

    try {
      // Save first
      await handleSave();

      // Update turnover status (cast to any for new columns)
      await (supabase as any)
        .from("turnovers")
        .update({ 
          status: 'reviewed',
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", turnoverId);

      // Redirect to shots page
      router.push("/shots");
    } catch (err) {
      console.error("Publish error:", err);
      setError("Failed to publish turnover");
    } finally {
      setPublishing(false);
    }
  }, [turnoverId, handleSave, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !turnover) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-red-400">{error || "Turnover not found"}</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />Go Back
        </Button>
      </div>
    );
  }

  const getPlatesForShot = (shotId: string) => plates.filter(p => p.shot_id === shotId);
  const getRefsForShot = (turnoverShotId: string) => 
    refs.filter(r => refAssignments[r.id]?.includes(turnoverShotId));

  const allNotesComplete = shots.every(s => shotNotes[s.id]?.trim());
  const allRefsAssigned = shots.every(s => getRefsForShot(s.id).length > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">
              TO{turnover.turnover_number}: {turnover.title || "Review"}
            </h1>
            <Badge variant={turnover.status === 'draft' ? 'secondary' : 'default'}>
              {turnover.status}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {turnover.project?.name} • {turnover.sequence?.code || "No sequence"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save Draft
          </Button>
          <Button onClick={handlePublish} disabled={publishing}>
            {publishing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Publish to Shot Board
          </Button>
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{shots.length}</p>
            <p className="text-xs text-muted-foreground">Shots</p>
          </CardContent>
        </Card>
        <Card className={cn(allNotesComplete ? "border-green-500/30" : "border-amber-500/30")}>
          <CardContent className="p-4 text-center">
            <p className={cn("text-3xl font-bold", allNotesComplete ? "text-green-400" : "text-amber-400")}>
              {Object.values(shotNotes).filter(n => n?.trim()).length}/{shots.length}
            </p>
            <p className="text-xs text-muted-foreground">VFX Notes</p>
          </CardContent>
        </Card>
        <Card className={cn(allRefsAssigned ? "border-green-500/30" : "border-amber-500/30")}>
          <CardContent className="p-4 text-center">
            <p className={cn("text-3xl font-bold", allRefsAssigned ? "text-green-400" : "text-amber-400")}>
              {shots.filter(s => getRefsForShot(s.id).length > 0).length}/{shots.length}
            </p>
            <p className="text-xs text-muted-foreground">Refs Assigned</p>
          </CardContent>
        </Card>
      </div>

      {/* General Notes */}
      {turnover.general_notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">General VFX Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{turnover.general_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Refs Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Video className="h-4 w-4" />
            Reference Clips ({refs.length})
            <div className="ml-auto">
              <input
                ref={refInputRef}
                type="file"
                accept=".mov,.mp4,.mxf,.m4v"
                className="hidden"
                onChange={handleRefUpload}
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-xs"
                onClick={() => refInputRef.current?.click()}
                disabled={uploadingRef}
              >
                {uploadingRef ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3 mr-1" />
                )}
                Add Ref
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {refs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No reference clips uploaded</p>
              <p className="text-xs">Click "Add Ref" to upload</p>
            </div>
          ) : (
            refs.map(ref => (
              <div key={ref.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  {/* Thumbnail or placeholder */}
                  <div className="w-24 h-16 bg-muted rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {ref.preview_url ? (
                      <video 
                        src={ref.preview_url} 
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      <Film className="h-6 w-6 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{ref.filename}</span>
                      {ref.auto_matched && (
                        <Badge variant="outline" className="text-[10px]">Auto-matched</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-xs text-muted-foreground">Assign:</span>
                      {shots.map(shot => {
                        const isAssigned = refAssignments[ref.id]?.includes(shot.id);
                        return (
                          <Button
                            key={shot.id}
                            variant={isAssigned ? "default" : "outline"}
                            size="sm"
                            className="h-6 text-[10px] px-2"
                            onClick={() => toggleRefAssignment(ref.id, shot.id)}
                          >
                            {isAssigned ? <Link2 className="h-2.5 w-2.5 mr-0.5" /> : null}
                            {shot.shot.code}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Shots with Notes and Plates */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Shot Details</h2>
        {shots.map((shot, i) => {
          const shotPlates = getPlatesForShot(shot.shot_id);
          const shotRefs = getRefsForShot(shot.id);
          const hasNotes = !!shotNotes[shot.id]?.trim();

          return (
            <Card key={shot.id} className={cn(!hasNotes && "border-amber-500/30")}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-mono flex items-center gap-2">
                    {shot.shot.code}
                    {shot.duration_frames && (
                      <span className="text-xs text-muted-foreground font-normal">
                        {shot.duration_frames}f
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex gap-2">
                    {shotRefs.length > 0 ? (
                      <Badge variant="outline" className="text-green-500 border-green-500/30">
                        <Video className="h-3 w-3 mr-1" />{shotRefs.length} ref{shotRefs.length > 1 ? 's' : ''}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                        <Video className="h-3 w-3 mr-1" />No ref
                      </Badge>
                    )}
                    {shotPlates.length > 0 && (
                      <Badge variant="outline" className="text-blue-500 border-blue-500/30">
                        <FolderOpen className="h-3 w-3 mr-1" />{shotPlates.length} plate{shotPlates.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
                {shot.reel_name && (
                  <p className="text-xs text-muted-foreground">Camera Roll: {shot.reel_name}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Timecodes */}
                {(shot.record_in || shot.record_out) && (
                  <div className="flex gap-4 text-xs font-mono text-muted-foreground">
                    <span>Rec: {shot.record_in} → {shot.record_out}</span>
                    {shot.source_in && <span>Src: {shot.source_in} → {shot.source_out}</span>}
                  </div>
                )}

                {/* Plates section with thumbnails and upload */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium flex items-center gap-1">
                      <FolderOpen className="h-3 w-3" />
                      Plates
                    </label>
                    <div>
                      <input
                        ref={(el) => { plateInputRefs.current[shot.shot_id] = el; }}
                        type="file"
                        accept=".mov,.mp4,.mxf,.exr,.dpx,.tif,.tiff"
                        className="hidden"
                        onChange={(e) => handlePlateUpload(shot.shot_id, e)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => plateInputRefs.current[shot.shot_id]?.click()}
                        disabled={uploadingPlate === shot.shot_id}
                      >
                        {uploadingPlate === shot.shot_id ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Upload className="h-3 w-3 mr-1" />
                        )}
                        Add Plate
                      </Button>
                    </div>
                  </div>
                  {shotPlates.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {shotPlates.map(plate => (
                        <div key={plate.id} className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1">
                          {plate.preview_url ? (
                            <div className="w-10 h-7 bg-muted rounded overflow-hidden">
                              <video 
                                src={plate.preview_url}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                              />
                            </div>
                          ) : (
                            <ImageIcon className="h-4 w-4 text-muted-foreground/60" />
                          )}
                          <span className="text-xs truncate max-w-[120px]">{plate.filename}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No plates uploaded</p>
                  )}
                </div>

                {/* VFX Notes */}
                <div>
                  <label className="text-xs font-medium flex items-center gap-1 mb-1.5">
                    <MessageSquare className="h-3 w-3" />
                    VFX Notes
                    {!hasNotes && <span className="text-amber-500">(required)</span>}
                  </label>
                  <Textarea
                    placeholder="Describe the VFX work needed for this shot..."
                    className={cn(
                      "min-h-[80px] text-sm",
                      !hasNotes && "border-amber-500/50"
                    )}
                    value={shotNotes[shot.id] || ""}
                    onChange={(e) => updateNote(shot.id, e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Save Draft
        </Button>
        <Button onClick={handlePublish} disabled={publishing}>
          {publishing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Publish to Shot Board
        </Button>
      </div>
    </div>
  );
}
