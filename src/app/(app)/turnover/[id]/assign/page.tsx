"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Check, AlertCircle, Loader2, ArrowLeft, Send, Building2, User, 
  CheckCircle2, Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { TurnoverStepper } from "@/components/turnover-stepper";

interface TurnoverShot {
  id: string;
  shot_id: string;
  vendor_id: string | null;
  artist_id: string | null;
  duration_frames: number | null;
  clip_name: string | null;
  sort_order: number;
  shot: {
    id: string;
    code: string;
  };
}

interface Vendor {
  id: string;
  name: string;
  code: string | null;
}

interface Artist {
  id: string;
  vendor_id: string;
  name: string;
  role: string | null;
}

interface Turnover {
  id: string;
  turnover_number: number;
  title: string | null;
  status: string;
  project: {
    id: string;
    name: string;
  };
}

export default function TurnoverAssignPage() {
  const params = useParams();
  const router = useRouter();
  const turnoverId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [turnover, setTurnover] = useState<Turnover | null>(null);
  const [shots, setShots] = useState<TurnoverShot[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);

  // Assignment state
  const [bulkVendorId, setBulkVendorId] = useState<string>("");
  const [shotAssignments, setShotAssignments] = useState<Record<string, { vendorId: string; artistId: string }>>({});
  
  // New vendor form
  const [showNewVendor, setShowNewVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState("");
  const [newVendorCode, setNewVendorCode] = useState("");
  const [addingVendor, setAddingVendor] = useState(false);

  // Load data
  useEffect(() => {
    async function loadData() {
      if (!supabase || !turnoverId) return;

      try {
        // Load turnover
        const { data: turnoverData, error: turnoverError } = await supabase
          .from("turnovers")
          .select(`
            id, turnover_number, title, status,
            project:projects(id, name)
          `)
          .eq("id", turnoverId)
          .single();

        if (turnoverError) throw turnoverError;
        setTurnover(turnoverData as any);

        // Load shots
        const { data: shotsData } = await supabase
          .from("turnover_shots")
          .select(`
            id, shot_id, vendor_id, artist_id, duration_frames, clip_name, sort_order,
            shot:shots(id, code)
          `)
          .eq("turnover_id", turnoverId)
          .order("sort_order");

        const typedShots = (shotsData || []) as TurnoverShot[];
        setShots(typedShots);

        // Initialize assignments from existing data
        const existing: Record<string, { vendorId: string; artistId: string }> = {};
        for (const shot of typedShots) {
          existing[shot.id] = {
            vendorId: shot.vendor_id || "",
            artistId: shot.artist_id || "",
          };
        }
        setShotAssignments(existing);

        // Load vendors for this project
        const projectId = (turnoverData as any).project?.id;
        if (projectId) {
          const { data: vendorsData } = await supabase
            .from("vendors")
            .select("id, name, code")
            .eq("project_id", projectId)
            .eq("active", true)
            .order("name");

          setVendors((vendorsData || []) as Vendor[]);

          // Load artists for all vendors
          const vendorIds = (vendorsData || []).map((v: any) => v.id);
          if (vendorIds.length > 0) {
            const { data: artistsData } = await supabase
              .from("artists")
              .select("id, vendor_id, name, role")
              .in("vendor_id", vendorIds)
              .eq("active", true)
              .order("name");

            setArtists((artistsData || []) as Artist[]);
          }
        }

      } catch (err) {
        console.error("Failed to load data:", err);
        setError("Failed to load turnover data");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [turnoverId]);

  // Update single shot assignment
  const updateShotAssignment = useCallback((shotId: string, field: 'vendorId' | 'artistId', value: string) => {
    setShotAssignments(prev => ({
      ...prev,
      [shotId]: {
        ...prev[shotId],
        [field]: value,
        // Clear artist if vendor changes
        ...(field === 'vendorId' ? { artistId: "" } : {}),
      },
    }));
  }, []);

  // Apply bulk vendor to all shots
  const applyBulkVendor = useCallback(() => {
    if (!bulkVendorId) return;
    setShotAssignments(prev => {
      const updated = { ...prev };
      for (const shot of shots) {
        updated[shot.id] = { vendorId: bulkVendorId, artistId: "" };
      }
      return updated;
    });
  }, [bulkVendorId, shots]);

  // Add new vendor
  const handleAddVendor = useCallback(async () => {
    if (!supabase || !turnover || !newVendorName.trim()) return;
    setAddingVendor(true);

    try {
      const { data: newVendor, error } = await (supabase as any)
        .from("vendors")
        .insert({
          project_id: turnover.project.id,
          name: newVendorName.trim(),
          code: newVendorCode.trim() || null,
          active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setVendors(prev => [...prev, newVendor as Vendor]);
      setNewVendorName("");
      setNewVendorCode("");
      setShowNewVendor(false);
    } catch (err) {
      console.error("Failed to add vendor:", err);
      setError("Failed to add vendor");
    } finally {
      setAddingVendor(false);
    }
  }, [supabase, turnover, newVendorName, newVendorCode]);

  // Save assignments
  const handleSave = useCallback(async () => {
    if (!supabase) return;
    setSaving(true);

    try {
      const db = supabase as any;

      for (const [shotId, assignment] of Object.entries(shotAssignments)) {
        await db
          .from("turnover_shots")
          .update({
            vendor_id: assignment.vendorId || null,
            artist_id: assignment.artistId || null,
            assigned_at: assignment.vendorId ? new Date().toISOString() : null,
          })
          .eq("id", shotId);
      }

      // Check if all shots have vendors
      const allAssigned = Object.values(shotAssignments).every(a => a.vendorId);
      if (allAssigned && turnover) {
        await db
          .from("turnovers")
          .update({ status: "assigned" })
          .eq("id", turnover.id);
      }

    } catch (err) {
      console.error("Save error:", err);
      setError("Failed to save assignments");
    } finally {
      setSaving(false);
    }
  }, [shotAssignments, turnover]);

  // Save and continue
  const handleComplete = useCallback(async () => {
    // Validate all shots have vendors
    const missingVendor = shots.some(s => !shotAssignments[s.id]?.vendorId);
    if (missingVendor) {
      setError("All shots must have a vendor assigned");
      return;
    }

    await handleSave();
    router.push("/turnovers");
  }, [shots, shotAssignments, handleSave, router]);

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

  const getArtistsForVendor = (vendorId: string) => artists.filter(a => a.vendor_id === vendorId);
  const assignedCount = Object.values(shotAssignments).filter(a => a.vendorId).length;
  const allAssigned = assignedCount === shots.length;

  return (
    <div className="space-y-6">
      {/* Pipeline Stepper */}
      <TurnoverStepper currentStep="assign" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">
              Assign Vendors — TO{turnover.turnover_number}
            </h1>
            <Badge variant={turnover.status === 'assigned' ? 'default' : 'secondary'}>
              {turnover.status}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {turnover.project?.name} • {turnover.title}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save Draft
          </Button>
          <Button onClick={handleComplete} disabled={saving || !allAssigned}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Complete Assignment
          </Button>
        </div>
      </div>

      {/* Status */}
      <Card className={cn(allAssigned ? "border-green-500/30" : "border-amber-500/30")}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                allAssigned ? "bg-green-500/20" : "bg-amber-500/20"
              )}>
                <Building2 className={cn("h-5 w-5", allAssigned ? "text-green-500" : "text-amber-500")} />
              </div>
              <div>
                <p className={cn("font-semibold", allAssigned ? "text-green-500" : "text-amber-500")}>
                  {assignedCount}/{shots.length} shots assigned
                </p>
                <p className="text-xs text-muted-foreground">
                  {allAssigned ? "Ready to complete" : "Vendor required for all shots"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Assignment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Bulk Assign</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Select value={bulkVendorId} onValueChange={setBulkVendorId}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select vendor for all shots" />
              </SelectTrigger>
              <SelectContent>
                {vendors.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name} {v.code && `(${v.code})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={applyBulkVendor} disabled={!bulkVendorId}>
              Apply to All
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setShowNewVendor(!showNewVendor)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Vendor
            </Button>
          </div>

          {showNewVendor && (
            <div className="flex gap-2 mt-3 p-3 bg-muted/50 rounded-lg">
              <Input
                placeholder="Vendor name"
                value={newVendorName}
                onChange={(e) => setNewVendorName(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Code (optional)"
                value={newVendorCode}
                onChange={(e) => setNewVendorCode(e.target.value)}
                className="w-32"
              />
              <Button onClick={handleAddVendor} disabled={addingVendor || !newVendorName.trim()}>
                {addingVendor ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-Shot Assignment */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Shot Assignments</h2>
        {shots.map(shot => {
          const assignment = shotAssignments[shot.id] || { vendorId: "", artistId: "" };
          const vendorArtists = getArtistsForVendor(assignment.vendorId);
          const hasVendor = !!assignment.vendorId;

          return (
            <Card key={shot.id} className={cn(!hasVendor && "border-amber-500/30")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Shot info */}
                  <div className="w-32">
                    <p className="font-mono font-bold">{shot.shot.code}</p>
                    {shot.duration_frames && (
                      <p className="text-xs text-muted-foreground">{shot.duration_frames}f</p>
                    )}
                  </div>

                  {/* Vendor select */}
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <Building2 className="h-3 w-3" />
                      Vendor <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={assignment.vendorId}
                      onValueChange={(v) => updateShotAssignment(shot.id, 'vendorId', v)}
                    >
                      <SelectTrigger className={cn(!hasVendor && "border-amber-500")}>
                        <SelectValue placeholder="Select vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors.map(v => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name} {v.code && `(${v.code})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Artist select (optional) */}
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <User className="h-3 w-3" />
                      Artist <span className="text-muted-foreground/50">(optional)</span>
                    </label>
                    <Select
                      value={assignment.artistId}
                      onValueChange={(v) => updateShotAssignment(shot.id, 'artistId', v)}
                      disabled={!assignment.vendorId || vendorArtists.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={vendorArtists.length === 0 ? "No artists" : "Select artist"} />
                      </SelectTrigger>
                      <SelectContent>
                        {vendorArtists.map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} {a.role && `(${a.role})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status indicator */}
                  <div className="w-8">
                    {hasVendor ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-amber-500" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Bottom Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Save Draft
        </Button>
        <Button onClick={handleComplete} disabled={saving || !allAssigned}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
          Complete Assignment
        </Button>
      </div>
    </div>
  );
}
