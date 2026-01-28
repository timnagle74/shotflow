"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { mockUsers, mockShots } from "@/lib/mock-data";
import { Plus, Shield, Paintbrush, Eye, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const roleConfig: Record<string, { icon: typeof Shield; color: string; bg: string }> = {
  ADMIN: { icon: Crown, color: "text-amber-400", bg: "bg-amber-400/10" },
  SUPERVISOR: { icon: Shield, color: "text-blue-400", bg: "bg-blue-400/10" },
  ARTIST: { icon: Paintbrush, color: "text-purple-400", bg: "bg-purple-400/10" },
  CLIENT: { icon: Eye, color: "text-green-400", bg: "bg-green-400/10" },
};

export default function UsersPage() {
  const [showInvite, setShowInvite] = useState(false);

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
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                    <SelectItem value="ARTIST">Artist</SelectItem>
                    <SelectItem value="CLIENT">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => setShowInvite(false)}>Send Invite</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(roleConfig).map(([role, cfg]) => {
          const count = mockUsers.filter(u => u.role === role).length;
          return (
            <Card key={role}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", cfg.bg)}>
                  <cfg.icon className={cn("h-5 w-5", cfg.color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{role}S</p>
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
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockUsers.map(user => {
                const cfg = roleConfig[user.role];
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
                      <Badge className={cn("border-0", cfg.bg, cfg.color)}>{user.role}</Badge>
                    </td>
                    <td className="p-3 text-sm">{assignedCount > 0 ? assignedCount : "—"}</td>
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
