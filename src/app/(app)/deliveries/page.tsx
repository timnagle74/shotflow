"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShotStatusBadge } from "@/components/status-badge";
import { mockShots, mockVersions, mockUsers, mockProjects, mockDeliverySpecs } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Truck, Clock, CheckCircle, AlertTriangle, Package, Monitor, Edit2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

type DeliveryStatus = "PENDING" | "DELIVERED" | "ACCEPTED";

interface Delivery {
  id: string;
  shotId: string;
  versionId: string;
  status: DeliveryStatus;
  deliveredAt: Date | null;
  dueDate: Date | null;
  specPreset: string;
}

const SPEC_PRESETS: Record<string, { label: string; detail: string }> = {
  EXR_16: { label: "EXR (16-bit Half)", detail: "OpenEXR, 16-bit half float, ACES AP0" },
  DPX_10: { label: "DPX (10-bit Log)", detail: "DPX, 10-bit log, Film Log encoding" },
  PRORES_4444: { label: "ProRes 4444", detail: "Apple ProRes 4444, 12-bit, Rec.709" },
  PRORES_HQ: { label: "ProRes HQ", detail: "Apple ProRes 422 HQ, 10-bit, Rec.709" },
};

const deliveriesData: Delivery[] = [
  { id: "d1", shotId: "sh1", versionId: "v3", status: "DELIVERED", deliveredAt: new Date("2024-05-22"), dueDate: new Date("2024-06-15"), specPreset: "EXR_16" },
  { id: "d2", shotId: "sh7", versionId: "v8", status: "ACCEPTED", deliveredAt: new Date("2024-05-27"), dueDate: new Date("2024-05-30"), specPreset: "DPX_10" },
  { id: "d3", shotId: "sh5", versionId: "v7", status: "PENDING", deliveredAt: null, dueDate: new Date("2024-06-10"), specPreset: "PRORES_4444" },
  { id: "d4", shotId: "sh3", versionId: "v5", status: "PENDING", deliveredAt: null, dueDate: new Date("2024-06-18"), specPreset: "EXR_16" },
];

const statusConfig: Record<DeliveryStatus, { color: string; icon: typeof Clock; label: string; badgeClass: string }> = {
  PENDING: { color: "text-amber-400", icon: Clock, label: "Pending", badgeClass: "bg-amber-600" },
  DELIVERED: { color: "text-blue-400", icon: Truck, label: "Delivered", badgeClass: "bg-blue-600" },
  ACCEPTED: { color: "text-green-400", icon: CheckCircle, label: "Accepted", badgeClass: "bg-green-600" },
};

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState(deliveriesData);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>("all");

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

  const bulkUpdate = (newStatus: DeliveryStatus) => {
    setDeliveries(prev => prev.map(d =>
      selectedIds.has(d.id) ? { ...d, status: newStatus, deliveredAt: newStatus !== "PENDING" ? (d.deliveredAt || new Date()) : null } : d
    ));
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Delivery Tracker</h1>
        <p className="text-muted-foreground mt-1">Track shot deliveries and client acceptance</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {(["pending", "delivered", "accepted"] as const).map((key) => {
          const cfg = statusConfig[key.toUpperCase() as DeliveryStatus];
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
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Delivery Spec</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Due Date</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Delivery Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Delivered</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeliveries.map(delivery => {
                const shot = mockShots.find(s => s.id === delivery.shotId);
                const version = mockVersions.find(v => v.id === delivery.versionId);
                const artist = shot?.assignedToId ? mockUsers.find(u => u.id === shot.assignedToId) : null;
                const cfg = statusConfig[delivery.status];
                const isOverdue = delivery.dueDate && delivery.dueDate < new Date() && delivery.status === "PENDING";
                const spec = SPEC_PRESETS[delivery.specPreset];

                return (
                  <tr key={delivery.id} className={cn(
                    "border-b border-border/50 transition-colors",
                    isOverdue ? "bg-red-950/20 hover:bg-red-950/30" : "hover:bg-muted/30",
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
                    <td className="p-3 font-mono text-sm font-bold">{shot?.code}</td>
                    <td className="p-3"><ShotStatusBadge status={shot?.status || "NOT_STARTED"} /></td>
                    <td className="p-3 text-sm font-mono">v{String(version?.versionNumber || 0).padStart(3, "0")}</td>
                    <td className="p-3 text-sm">{artist?.name || "—"}</td>
                    <td className="p-3">
                      {spec ? (
                        <div>
                          <span className="text-sm font-medium">{spec.label}</span>
                          <p className="text-[10px] text-muted-foreground">{spec.detail}</p>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-sm">
                      <span className={cn(isOverdue && "text-red-400 font-medium")}>
                        {delivery.dueDate?.toLocaleDateString() || "—"}
                        {isOverdue && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                      </span>
                    </td>
                    <td className="p-3">
                      <Badge className={cn("text-white border-0", cfg.badgeClass)}>{cfg.label}</Badge>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">{delivery.deliveredAt?.toLocaleDateString() || "—"}</td>
                    <td className="p-3">
                      {delivery.status === "PENDING" && (
                        <Button size="sm" variant="outline" onClick={() => {
                          setDeliveries(prev => prev.map(d => d.id === delivery.id ? { ...d, status: "DELIVERED" as DeliveryStatus, deliveredAt: new Date() } : d));
                        }}>Mark Delivered</Button>
                      )}
                      {delivery.status === "DELIVERED" && (
                        <Button size="sm" variant="outline" onClick={() => {
                          setDeliveries(prev => prev.map(d => d.id === delivery.id ? { ...d, status: "ACCEPTED" as DeliveryStatus } : d));
                        }}>Mark Accepted</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

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
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Monitor className="h-4 w-4" />Project Delivery Specs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mockProjects.map(project => {
              const specs = mockDeliverySpecs.find(ds => ds.projectId === project.id);
              return (
                <div key={project.id} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{project.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{project.code}</p>
                    </div>
                    <DeliverySpecsDialog project={project} specs={specs || null} />
                  </div>
                  {specs ? (
                    <div className="space-y-1.5 text-xs">
                      {[
                        { label: "Resolution", value: specs.resolution },
                        { label: "Format", value: specs.format },
                        { label: "FPS", value: specs.frameRate },
                        { label: "Color Space", value: specs.colorSpace },
                        { label: "Bit Depth", value: specs.bitDepth },
                        { label: "Handles", value: `H${specs.handlesHead} / T${specs.handlesTail}` },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-mono">{value}</span>
                        </div>
                      ))}
                      {specs.namingConvention && (
                        <>
                          <Separator />
                          <div>
                            <span className="text-muted-foreground">Naming:</span>
                            <p className="font-mono mt-0.5 break-all">{specs.namingConvention}</p>
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
    </div>
  );
}

// Role check — in a real app this comes from auth context
const CURRENT_USER_ROLE = "ADMIN"; // Simulated

function DeliverySpecsDialog({ project, specs }: { project: { id: string; name: string }; specs: (typeof mockDeliverySpecs)[0] | null }) {
  const canEdit = CURRENT_USER_ROLE === "ADMIN" || CURRENT_USER_ROLE === "SUPERVISOR";
  const [open, setOpen] = useState(false);

  const fields = [
    { key: "resolution", label: "Resolution", value: specs?.resolution || "" },
    { key: "format", label: "Format", value: specs?.format || "" },
    { key: "frameRate", label: "Frame Rate", value: specs?.frameRate || "" },
    { key: "colorSpace", label: "Color Space", value: specs?.colorSpace || "" },
    { key: "bitDepth", label: "Bit Depth", value: specs?.bitDepth || "" },
    { key: "handlesHead", label: "Handles (Head)", value: String(specs?.handlesHead ?? 8) },
    { key: "handlesTail", label: "Handles (Tail)", value: String(specs?.handlesTail ?? 8) },
    { key: "namingConvention", label: "Naming Convention", value: specs?.namingConvention || "" },
    { key: "audioRequirements", label: "Audio Requirements", value: specs?.audioRequirements || "" },
    { key: "additionalNotes", label: "Additional Notes", value: specs?.additionalNotes || "" },
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
              {f.key === "additionalNotes" ? (
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
