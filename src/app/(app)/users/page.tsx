"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { mockUsers, mockShots } from "@/lib/mock-data";
import { roleLabels, roleColors, cn } from "@/lib/utils";
import { Plus, Shield, Paintbrush, Eye, Crown, Users, Briefcase, ToggleLeft, ToggleRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

const roleIcons: Record<string, typeof Shield> = {
  ADMIN: Crown,
  SUPERVISOR: Shield,
  COORDINATOR: Users,
  ARTIST: Paintbrush,
  CLIENT: Eye,
  VFX_VENDOR: Briefcase,
};

// Simulated current user role — in production derive from auth
const CURRENT_USER_ROLE = "ADMIN";

export default function UsersPage() {
  const [showInvite, setShowInvite] = useState(false);
  const [viewPerms, setViewPerms] = useState<Record<string, boolean>>(() => {
    const perms: Record<string, boolean> = {};
    mockUsers.forEach(u => {
      perms[u.id] = u.role === "ADMIN" || u.role === "SUPERVISOR";
    });
    return perms;
  });

  const canTogglePerms = CURRENT_USER_ROLE === "ADMIN" || CURRENT_USER_ROLE === "SUPERVISOR";

  const toggleViewAll = useCallback(async (userId: string) => {
    const newVal = !viewPerms[userId];
    setViewPerms(prev => ({ ...prev, [userId]: newVal }));
    if (supabase) {
      await (supabase as any).from("users").update({ can_view_all_shots: newVal }).eq("id", userId);
    }
  }, [viewPerms]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage team members and permissions</p>
        </div>
        <Dialog open={showInvite} onOpenChange={setShowInvite}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Invite User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium">Email Address</label>
                <Input placeholder="user@studio.com" className="mt-1.5" />
              </div>
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input placeholder="Full name" className="mt-1.5" />
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <Select defaultValue="ARTIST">
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => setShowInvite(false)}>Send Invite</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Object.entries(roleColors).map(([role, cfg]) => {
          const Icon = roleIcons[role] || Shield;
          const count = mockUsers.filter(u => u.role === role).length;
          return (
            <Card key={role}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", cfg.bg)}>
                  <Icon className={cn("h-5 w-5", cfg.color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{roleLabels[role] || role}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground p-3">User</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Email</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Role</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Assigned Shots</th>
                {canTogglePerms && (
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">View All Shots</th>
                )}
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockUsers.map(user => {
                const cfg = roleColors[user.role] || { color: "text-zinc-400", bg: "bg-zinc-400/10" };
                const assignedCount = mockShots.filter(s => s.assignedToId === user.id).length;
                return (
                  <tr key={user.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/20 text-primary text-xs">
                            {user.name.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{user.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">{user.email}</td>
                    <td className="p-3">
                      <Badge className={cn("border-0", cfg.bg, cfg.color)}>{roleLabels[user.role] || user.role}</Badge>
                    </td>
                    <td className="p-3 text-sm">{assignedCount > 0 ? assignedCount : "—"}</td>
                    {canTogglePerms && (
                      <td className="p-3">
                        <button
                          onClick={() => toggleViewAll(user.id)}
                          className="flex items-center gap-1.5 text-sm"
                        >
                          {viewPerms[user.id] ? (
                            <ToggleRight className="h-5 w-5 text-green-400" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                          )}
                          <span className={viewPerms[user.id] ? "text-green-400" : "text-muted-foreground"}>
                            {viewPerms[user.id] ? "Yes" : "No"}
                          </span>
                        </button>
                      </td>
                    )}
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost">Edit</Button>
                        {user.role !== "ADMIN" && <Button size="sm" variant="ghost" className="text-destructive">Remove</Button>}
                      </div>
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
