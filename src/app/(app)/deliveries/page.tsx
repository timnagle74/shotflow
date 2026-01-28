"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShotStatusBadge } from "@/components/status-badge";
import { mockShots, mockSequences, mockVersions, mockUsers } from "@/lib/mock-data";
import { Truck, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const deliveries = [
  { id: "d1", shotId: "sh1", versionId: "v3", status: "DELIVERED" as const, deliveredAt: new Date("2024-05-22") },
  { id: "d2", shotId: "sh7", versionId: "v8", status: "ACCEPTED" as const, deliveredAt: new Date("2024-05-27") },
  { id: "d3", shotId: "sh5", versionId: "v7", status: "PENDING" as const, deliveredAt: null },
  { id: "d4", shotId: "sh3", versionId: "v5", status: "PENDING" as const, deliveredAt: null },
];

const statusConfig = {
  PENDING: { color: "bg-amber-600", icon: Clock, label: "Pending" },
  DELIVERED: { color: "bg-blue-600", icon: Truck, label: "Delivered" },
  ACCEPTED: { color: "bg-green-600", icon: CheckCircle, label: "Accepted" },
};

export default function DeliveriesPage() {
  const stats = {
    pending: deliveries.filter(d => d.status === "PENDING").length,
    delivered: deliveries.filter(d => d.status === "DELIVERED").length,
    accepted: deliveries.filter(d => d.status === "ACCEPTED").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Delivery Tracker</h1>
        <p className="text-muted-foreground mt-1">Track shot deliveries and client acceptance</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-600/20 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending Delivery</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <Truck className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.delivered}</p>
              <p className="text-xs text-muted-foreground">Delivered</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-600/20 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.accepted}</p>
              <p className="text-xs text-muted-foreground">Accepted</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Shot</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Shot Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Version</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Artist</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Due Date</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Delivery Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Delivered</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map(delivery => {
                const shot = mockShots.find(s => s.id === delivery.shotId);
                const version = mockVersions.find(v => v.id === delivery.versionId);
                const artist = shot?.assignedToId ? mockUsers.find(u => u.id === shot.assignedToId) : null;
                const cfg = statusConfig[delivery.status];
                const isOverdue = shot?.dueDate && shot.dueDate < new Date() && delivery.status === "PENDING";

                return (
                  <tr key={delivery.id} className={cn("border-b border-border/50", isOverdue && "bg-red-950/20")}>
                    <td className="p-3 font-mono text-sm font-bold">{shot?.code}</td>
                    <td className="p-3"><ShotStatusBadge status={shot?.status || "NOT_STARTED"} /></td>
                    <td className="p-3 text-sm font-mono">v{String(version?.versionNumber || 0).padStart(3, "0")}</td>
                    <td className="p-3 text-sm">{artist?.name || "—"}</td>
                    <td className="p-3 text-sm">
                      <span className={cn(isOverdue && "text-red-400 font-medium")}>
                        {shot?.dueDate?.toLocaleDateString() || "—"}
                        {isOverdue && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                      </span>
                    </td>
                    <td className="p-3">
                      <Badge className={cn("text-white border-0", cfg.color)}>{cfg.label}</Badge>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">{delivery.deliveredAt?.toLocaleDateString() || "—"}</td>
                    <td className="p-3">
                      {delivery.status === "PENDING" && <Button size="sm" variant="outline">Mark Delivered</Button>}
                      {delivery.status === "DELIVERED" && <Button size="sm" variant="outline">Mark Accepted</Button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
