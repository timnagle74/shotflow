"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShotStatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Truck, Clock, CheckCircle, AlertTriangle, Package, Monitor, Edit2, Eye, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

type DeliveryStatusType = "PENDING" | "DELIVERED" | "ACCEPTED";

interface Delivery {
  id: string;
  shot_id: string;
  version_id: string;
  status: DeliveryStatusType;
  delivered_at: string | null;
  specs: Record<string, unknown> | null;
}

interface Shot {
  id: string;
  code: string;
  status: string;
  assigned_to_id: string | null;
  due_date: string | null;
}

interface Version {
  id: string;
  shot_id: string;
  version_number: number;
}

interface UserInfo {
  id: string;
  name: string | null;
}

interface Project {
  id: string;
  name: string;
  code: string;
}

interface DeliverySpec {
  id: string;
  project_id: string;
  resolution: string | null;
  format: string | null;
  frame_rate: string | null;
  color_space: string | null;
  bit_depth: string | null;
  handles_head: number;
  handles_tail: number;
  naming_convention: string | null;
  audio_requirements: string | null;
  additional_notes: string | null;
}

const SPEC_PRESETS: Record<string, { label: string; detail: string }> = {
  EXR_16: { label: "EXR (16-bit Half)", detail: "OpenEXR, 16-bit half float, ACES AP0" },
  DPX_10: { label: "DPX (10-bit Log)", detail: "DPX, 10-bit log, Film Log encoding" },
  PRORES_4444: { label: "ProRes 4444", detail: "Apple ProRes 4444, 12-bit, Rec.709" },
  PRORES_HQ: { label: "ProRes HQ", detail: "Apple ProRes 422 HQ, 10-bit, Rec.709" },
};

const statusConfig: Record<DeliveryStatusType, { color: string; icon: typeof Clock; label: string; badgeClass: string }> = {
  PENDING: { color: "text-amber-400", icon: Clock, label: "Pending", badgeClass: "bg-amber-600" },
  DELIVERED: { color: "text-blue-400", icon: Truck, label: "Delivered", badgeClass: "bg-blue-600" },
  ACCEPTED: { color: "text-green-400", icon: CheckCircle, label: "Accepted", badgeClass: "bg-green-600" },
};

export default function DeliveriesPage() {
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [deliverySpecs, setDeliverySpecs] = useState<DeliverySpec[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const [deliveriesRes, shotsRes, versionsRes, usersRes, projectsRes, specsRes] = await Promise.all([
        supabase.from("deliveries").select("*"),
        supabase.from("shots").select("id, code, status, assigned_to_id, due_date"),
        supabase.from("versions").select("id, shot_id, version_number"),
        supabase.from("users").select("id, name"),
        supabase.from("projects").select("id, name, code").order("name"),
        supabase.from("delivery_specs").select("*"),
      ]);
      setDeliveries(deliveriesRes.data || []);
      setShots(shotsRes.data || []);
      setVersions(versionsRes.data || []);
      setUsers(usersRes.data || []);
      setProjects(projectsRes.data || []);
      setDeliverySpecs(specsRes.data || []);
    } catch (err) {
      console.error("Failed to fetch deliveries:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = {
    pending: deliveries.filter(d => d.status === "PENDING").length,
    delivered: deliveries.filter(d => d.status === "DELIVERED").length,
    accepted: deliveries.filter(d => d.status === "ACCEPTED").length,
  };

  const filteredDeliveries = filterStatus === "all" ? deliveries : deliveries.filter(d => d.status === filterStatus);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredDeliveries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDeliveries.map(d => d.id)));
    }
  };

  const bulkUpdate = async (newStatus: DeliveryStatusType) => {
    if (!supabase) return;
    for (const id of selectedIds) {
      await supabase.from("deliveries").update({
        status: newStatus,
        delivered_at: newStatus !== "PENDING" ? new Date().toISOString() : null,
      } as any).eq("id", id);
    }
    setSelectedIds(new Set());
    fetchData();
  };

  const updateDeliveryStatus = async (id: string, newStatus: DeliveryStatusType) => {
    if (!supabase) return;
    await supabase.from("deliveries").update({
      status: newStatus,
      delivered_at: newStatus !== "PENDING" ? new Date().toISOString() : null,
    } as any).eq("id", id);
    fetchData();
  };

  const isEmpty = deliveries.length === 0 && projects.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Delivery Tracker</h1>
        <p className="text-muted-foreground mt-1">Track shot deliveries and client acceptance</p>
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Truck className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No deliveries yet</h3>
            <p className="text-sm text-muted-foreground">Deliveries will appear here once shots are marked for delivery.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            {(["pending", "delivered", "accepted"] as const).map((key) => {
              const cfg = statusConfig[key.toUpperCase() as DeliveryStatusType];
              return (
                <Card key={key}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", `${cfg.badgeClass}/20`)}>
                      <cfg.icon className={cn("h-5 w-5", cfg.color)} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats[key]}</p>
                      <p className="text-xs text-muted-foreground">{cfg.label}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Filters & Bulk Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Filter status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
                <SelectItem value="ACCEPTED">Accepted</SelectItem>
              </SelectContent>
            </Select>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
                <Button size="sm" variant="outline" onClick={() => bulkUpdate("DELIVERED")}>
                  <Truck className="h-3 w-3 mr-1.5" />Mark Delivered
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkUpdate("ACCEPTED")}>
                  <CheckCircle className="h-3 w-3 mr-1.5" />Mark Accepted
                </Button>
              </div>
            )}
          </div>

          {/* Deliveries Table */}
          {filteredDeliveries.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="p-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === filteredDeliveries.length && filteredDeliveries.length > 0}
                          onChange={toggleAll}
                          className="rounded border-border"
                        />
                      </th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-3">Shot</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-3">Shot Status</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-3">Version</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-3">Artist</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-3">Delivery Status</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-3">Delivered</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeliveries.map(delivery => {
                      const shot = shots.find(s => s.id === delivery.shot_id);
                      const version = versions.find(v => v.id === delivery.version_id);
                      const artist = shot?.assigned_to_id ? users.find(u => u.id === shot.assigned_to_id) : null;
                      const cfg = statusConfig[delivery.status];

                      return (
                        <tr key={delivery.id} className={cn(
                          "border-b border-border/50 transition-colors hover:bg-muted/30",
                          selectedIds.has(delivery.id) && "bg-primary/5"
                        )}>
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(delivery.id)}
                              onChange={() => toggleSelect(delivery.id)}
                              className="rounded border-border"
                            />
                          </td>
                          <td className="p-3 font-mono text-sm font-bold">{shot?.code || "—"}</td>
                          <td className="p-3"><ShotStatusBadge status={shot?.status || "NOT_STARTED"} /></td>
                          <td className="p-3 text-sm font-mono">v{String(version?.version_number || 0).padStart(3, "0")}</td>
                          <td className="p-3 text-sm">{artist?.name || "—"}</td>
                          <td className="p-3">
                            <Badge className={cn("text-white border-0", cfg.badgeClass)}>{cfg.label}</Badge>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {delivery.delivered_at ? new Date(delivery.delivered_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="p-3">
                            {delivery.status === "PENDING" && (
                              <Button size="sm" variant="outline" onClick={() => updateDeliveryStatus(delivery.id, "DELIVERED")}>
                                Mark Delivered
                              </Button>
                            )}
                            {delivery.status === "DELIVERED" && (
                              <Button size="sm" variant="outline" onClick={() => updateDeliveryStatus(delivery.id, "ACCEPTED")}>
                                Mark Accepted
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Truck className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No deliveries match the current filter.</p>
              </CardContent>
            </Card>
          )}

          {/* Delivery Spec Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4" />Delivery Spec Presets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {Object.entries(SPEC_PRESETS).map(([key, spec]) => (
                  <div key={key} className="rounded-lg border border-border p-3 bg-muted/20">
                    <p className="text-sm font-medium">{spec.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{spec.detail}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Per-Project Delivery Specs */}
          {projects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Monitor className="h-4 w-4" />Project Delivery Specs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {projects.map(project => {
                    const specs = deliverySpecs.find(ds => ds.project_id === project.id);
                    return (
                      <div key={project.id} className="rounded-lg border border-border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">{project.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{project.code}</p>
                          </div>
                          <DeliverySpecsDialog project={project} specs={specs || null} onSave={fetchData} />
                        </div>
                        {specs ? (
                          <div className="space-y-1.5 text-xs">
                            {[
                              { label: "Resolution", value: specs.resolution },
                              { label: "Format", value: specs.format },
                              { label: "FPS", value: specs.frame_rate },
                              { label: "Color Space", value: specs.color_space },
                              { label: "Bit Depth", value: specs.bit_depth },
                              { label: "Handles", value: `H${specs.handles_head} / T${specs.handles_tail}` },
                            ].map(({ label, value }) => (
                              <div key={label} className="flex justify-between">
                                <span className="text-muted-foreground">{label}</span>
                                <span className="font-mono">{value || '—'}</span>
                              </div>
                            ))}
                            {specs.naming_convention && (
                              <>
                                <Separator />
                                <div>
                                  <span className="text-muted-foreground">Naming:</span>
                                  <p className="font-mono mt-0.5 break-all">{specs.naming_convention}</p>
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">No specs configured</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// Role check — in a real app this comes from auth context
const CURRENT_USER_ROLE = "ADMIN"; // Simulated

function DeliverySpecsDialog({ project, specs, onSave }: { project: { id: string; name: string }; specs: DeliverySpec | null; onSave: () => void }) {
  const canEdit = CURRENT_USER_ROLE === "ADMIN" || CURRENT_USER_ROLE === "SUPERVISOR";
  const [open, setOpen] = useState(false);

  const fields = [
    { key: "resolution", label: "Resolution", value: specs?.resolution || "" },
    { key: "format", label: "Format", value: specs?.format || "" },
    { key: "frame_rate", label: "Frame Rate", value: specs?.frame_rate || "" },
    { key: "color_space", label: "Color Space", value: specs?.color_space || "" },
    { key: "bit_depth", label: "Bit Depth", value: specs?.bit_depth || "" },
    { key: "handles_head", label: "Handles (Head)", value: String(specs?.handles_head ?? 8) },
    { key: "handles_tail", label: "Handles (Tail)", value: String(specs?.handles_tail ?? 8) },
    { key: "naming_convention", label: "Naming Convention", value: specs?.naming_convention || "" },
    { key: "audio_requirements", label: "Audio Requirements", value: specs?.audio_requirements || "" },
    { key: "additional_notes", label: "Additional Notes", value: specs?.additional_notes || "" },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          {canEdit ? <Edit2 className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{canEdit ? "Edit" : "View"} Delivery Specs — {project.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {fields.map(f => (
            <div key={f.key}>
              <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
              {f.key === "additional_notes" ? (
                <Textarea
                  defaultValue={f.value}
                  disabled={!canEdit}
                  className="mt-1 text-sm"
                  rows={3}
                />
              ) : (
                <Input
                  defaultValue={f.value}
                  disabled={!canEdit}
                  className="mt-1 text-sm"
                />
              )}
            </div>
          ))}
          {canEdit && (
            <Button className="w-full" onClick={() => setOpen(false)}>
              Save Specs
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
