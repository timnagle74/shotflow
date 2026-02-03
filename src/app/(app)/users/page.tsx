"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { roleLabels, roleColors, cn } from "@/lib/utils";
import {
  Plus,
  Shield,
  Paintbrush,
  Eye,
  Crown,
  Users,
  Briefcase,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Mail,
  Clock,
  AlertCircle,
  CheckCircle2,
  Pencil,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/lib/database.types";

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  avatar: string | null;
  can_view_all_shots: boolean;
  created_at: string;
  updated_at: string;
  shot_count?: number;
  is_pending?: boolean;
}

const roleIcons: Record<string, typeof Shield> = {
  ADMIN: Crown,
  SUPERVISOR: Shield,
  COORDINATOR: Users,
  ARTIST: Paintbrush,
  CLIENT: Eye,
  VFX_VENDOR: Briefcase,
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("ARTIST");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Vendor invite form
  const [showVendorInvite, setShowVendorInvite] = useState(false);
  const [vendorCompanyName, setVendorCompanyName] = useState("");
  const [vendorContactName, setVendorContactName] = useState("");
  const [vendorContactEmail, setVendorContactEmail] = useState("");
  const [isFreelancer, setIsFreelancer] = useState(false);
  const [vendorInviting, setVendorInviting] = useState(false);
  const [vendorInviteError, setVendorInviteError] = useState<string | null>(null);
  const [vendorInviteSuccess, setVendorInviteSuccess] = useState<string | null>(null);

  // Edit form
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editRole, setEditRole] = useState<UserRole>("ARTIST");
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      // Load users from Supabase
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (usersError) throw usersError;

      // Get assigned shot counts for each user
      const typedUsers = (usersData || []) as UserRow[];
      const usersWithCounts: UserRow[] = await Promise.all(
        typedUsers.map(async (user) => {
          // Count shots directly assigned
          const { count: directCount } = await supabase!
            .from("shots")
            .select("*", { count: "exact", head: true })
            .eq("assigned_to_id", user.id);

          return {
            ...user,
            shot_count: directCount || 0,
          } as UserRow;
        })
      );

      setUsers(usersWithCounts);
    } catch (err) {
      console.error("Failed to load users:", err);
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Send invite
  const handleInvite = useCallback(async () => {
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName,
          role: inviteRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setInviteError(data.error || "Failed to send invite");
        return;
      }

      setInviteSuccess(data.message || "Invite sent!");
      setInviteEmail("");
      setInviteName("");
      setInviteRole("ARTIST");

      // Reload users
      await loadUsers();

      // Close dialog after brief delay
      setTimeout(() => {
        setShowInvite(false);
        setInviteSuccess(null);
      }, 1500);
    } catch (err) {
      setInviteError("Failed to send invite");
    } finally {
      setInviting(false);
    }
  }, [inviteEmail, inviteName, inviteRole, loadUsers]);

  // Send vendor invite
  const handleVendorInvite = useCallback(async () => {
    setVendorInviting(true);
    setVendorInviteError(null);
    setVendorInviteSuccess(null);

    try {
      const res = await fetch("/api/vendors/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: isFreelancer ? undefined : vendorCompanyName,
          contactName: vendorContactName,
          contactEmail: vendorContactEmail,
          isFreelancer,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setVendorInviteError(data.error || "Failed to create vendor invite");
        return;
      }

      setVendorInviteSuccess(data.message || "Vendor invited!");
      setVendorCompanyName("");
      setVendorContactName("");
      setVendorContactEmail("");
      setIsFreelancer(false);

      // Reload users
      await loadUsers();

      // Close dialog after brief delay
      setTimeout(() => {
        setShowVendorInvite(false);
        setVendorInviteSuccess(null);
      }, 1500);
    } catch (err) {
      setVendorInviteError("Failed to create vendor invite");
    } finally {
      setVendorInviting(false);
    }
  }, [vendorCompanyName, vendorContactName, vendorContactEmail, isFreelancer, loadUsers]);

  // Edit user
  const handleEdit = useCallback(async () => {
    if (!editingUser) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: editRole, name: editName }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update user");
        return;
      }

      setEditingUser(null);
      await loadUsers();
    } catch (err) {
      setError("Failed to update user");
    } finally {
      setSaving(false);
    }
  }, [editingUser, editRole, editName, loadUsers]);

  // Remove user
  const handleRemove = useCallback(async () => {
    if (!deletingUser) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/users/${deletingUser.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to remove user");
        return;
      }

      setDeletingUser(null);
      await loadUsers();
    } catch (err) {
      setError("Failed to remove user");
    } finally {
      setDeleting(false);
    }
  }, [deletingUser, loadUsers]);

  // Toggle view all shots
  const toggleViewAll = useCallback(
    async (userId: string, currentValue: boolean) => {
      try {
        const res = await fetch(`/api/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ can_view_all_shots: !currentValue }),
        });

        if (res.ok) {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === userId
                ? { ...u, can_view_all_shots: !currentValue }
                : u
            )
          );
        }
      } catch (err) {
        console.error("Toggle error:", err);
      }
    },
    []
  );

  // Open edit dialog
  const openEdit = (user: UserRow) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditName(user.name || "");
  };

  // Separate pending (no name and very recent) vs active users
  const pendingUsers = users.filter(
    (u) =>
      !u.name &&
      new Date(u.created_at).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
  );
  const activeUsers = users.filter(
    (u) =>
      u.name ||
      new Date(u.created_at).getTime() <=
        Date.now() - 30 * 24 * 60 * 60 * 1000
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Team & Users
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage team members, roles, and permissions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showVendorInvite} onOpenChange={setShowVendorInvite}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Briefcase className="h-4 w-4 mr-2" />
                Invite Vendor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Vendor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {/* Freelancer toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => setIsFreelancer(!isFreelancer)}
                    className="flex items-center"
                  >
                    {isFreelancer ? (
                      <ToggleRight className="h-6 w-6 text-green-400" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                    )}
                  </button>
                  <div>
                    <span className="text-sm font-medium">Freelancer</span>
                    <p className="text-xs text-muted-foreground">
                      {isFreelancer
                        ? "Auto-creates a vendor named after the person"
                        : "Invite a vendor company with a primary contact"}
                    </p>
                  </div>
                </label>

                {/* Company Name — hidden for freelancers */}
                {!isFreelancer && (
                  <div>
                    <label className="text-sm font-medium">Company Name</label>
                    <Input
                      placeholder="Acme VFX"
                      className="mt-1.5"
                      value={vendorCompanyName}
                      onChange={(e) => setVendorCompanyName(e.target.value)}
                    />
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium">Primary Contact Name</label>
                  <Input
                    placeholder="Full name"
                    className="mt-1.5"
                    value={vendorContactName}
                    onChange={(e) => setVendorContactName(e.target.value)}
                  />
                  {isFreelancer && vendorContactName && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Vendor will be named: &quot;{vendorContactName} VFX&quot;
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium">Primary Contact Email</label>
                  <Input
                    placeholder="vendor@studio.com"
                    className="mt-1.5"
                    value={vendorContactEmail}
                    onChange={(e) => setVendorContactEmail(e.target.value)}
                  />
                </div>

                <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                  {isFreelancer
                    ? "User will be invited as an Artist and auto-linked to their personal vendor."
                    : "User will be invited as a VFX Vendor and linked to the new vendor company."}
                </div>

                {vendorInviteError && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {vendorInviteError}
                  </div>
                )}
                {vendorInviteSuccess && (
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    {vendorInviteSuccess}
                  </div>
                )}
                <Button
                  className="w-full"
                  onClick={handleVendorInvite}
                  disabled={
                    vendorInviting ||
                    !vendorContactEmail ||
                    !vendorContactName ||
                    (!isFreelancer && !vendorCompanyName)
                  }
                >
                  {vendorInviting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Briefcase className="h-4 w-4 mr-2" />
                  )}
                  {isFreelancer ? "Invite Freelancer" : "Create Vendor & Invite"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

        <Dialog open={showInvite} onOpenChange={setShowInvite}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium">Email Address</label>
                <Input
                  placeholder="user@studio.com"
                  className="mt-1.5"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  placeholder="Full name"
                  className="mt-1.5"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as UserRole)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {inviteError && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {inviteError}
                </div>
              )}
              {inviteSuccess && (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  {inviteSuccess}
                </div>
              )}
              <Button
                className="w-full"
                onClick={handleInvite}
                disabled={inviting || !inviteEmail}
              >
                {inviting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Send Invite
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 rounded-md p-3">
          <AlertCircle className="h-4 w-4" />
          {error}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Role summary cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Object.entries(roleColors).map(([role, cfg]) => {
          const Icon = roleIcons[role] || Shield;
          const count = users.filter((u) => u.role === role).length;
          return (
            <Card key={role}>
              <CardContent className="p-4 flex items-center gap-3">
                <div
                  className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center",
                    cfg.bg
                  )}
                >
                  <Icon className={cn("h-5 w-5", cfg.color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">
                    {roleLabels[role] || role}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pending Invites */}
      {pendingUsers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              Pending Invites ({pendingUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">
                    Email
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">
                    Role
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">
                    Invited
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((user) => {
                  const cfg = roleColors[user.role] || {
                    color: "text-zinc-400",
                    bg: "bg-zinc-400/10",
                  };
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-border/50 hover:bg-muted/30"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <Mail className="h-4 w-4 text-amber-400" />
                          <span className="text-sm">{user.email}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge
                          className={cn("border-0", cfg.bg, cfg.color)}
                        >
                          {roleLabels[user.role] || user.role}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setDeletingUser(user)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Revoke
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Active Users */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            Active Users ({activeUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground p-3">
                  User
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">
                  Email
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">
                  Role
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">
                  Assigned Shots
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">
                  View All Shots
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {activeUsers.map((user) => {
                const cfg = roleColors[user.role] || {
                  color: "text-zinc-400",
                  bg: "bg-zinc-400/10",
                };
                return (
                  <tr
                    key={user.id}
                    className="border-b border-border/50 hover:bg-muted/30"
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/20 text-primary text-xs">
                            {user.name
                              ? user.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                              : user.email.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">
                          {user.name || user.email.split("@")[0]}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {user.email}
                    </td>
                    <td className="p-3">
                      <Badge
                        className={cn("border-0", cfg.bg, cfg.color)}
                      >
                        {roleLabels[user.role] || user.role}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm">
                      {user.shot_count && user.shot_count > 0
                        ? user.shot_count
                        : "—"}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() =>
                          toggleViewAll(user.id, user.can_view_all_shots)
                        }
                        className="flex items-center gap-1.5 text-sm"
                      >
                        {user.can_view_all_shots ? (
                          <ToggleRight className="h-5 w-5 text-green-400" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                        )}
                        <span
                          className={
                            user.can_view_all_shots
                              ? "text-green-400"
                              : "text-muted-foreground"
                          }
                        >
                          {user.can_view_all_shots ? "Yes" : "No"}
                        </span>
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(user)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        {user.role !== "ADMIN" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setDeletingUser(user)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {activeUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <Users className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No users yet. Invite your first team member!
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                className="mt-1.5"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Role</label>
              <Select
                value={editRole}
                onValueChange={(v) => setEditRole(v as UserRole)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setEditingUser(null)}
              >
                Cancel
              </Button>
              <Button onClick={handleEdit} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deletingUser}
        onOpenChange={(open) => !open && setDeletingUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to remove{" "}
              <strong>
                {deletingUser?.name || deletingUser?.email}
              </strong>
              ? This will deactivate their account and revoke access.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setDeletingUser(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleRemove}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Remove User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
