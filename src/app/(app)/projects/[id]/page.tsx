"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  ArrowLeft, Users, FileImage, Settings, Plus, Trash2, Loader2, 
  Download, Upload, Crown, Clapperboard, Video, Shield, Briefcase,
  Paintbrush, Film, Eye
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/use-current-user";
import { roleLabels, roleColors, cn } from "@/lib/utils";
import type { UserRole } from "@/lib/database.types";

interface ProjectMember {
  id: string;
  role: UserRole;
  created_at: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
}

interface LutFile {
  id: string;
  name: string;
  description: string | null;
  file_path: string;
  format: string | null;
  lut_type: string | null;
  is_default: boolean;
  file_size: number | null;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  code: string;
  status: string;
}

const roleIcons: Record<string, any> = {
  ADMIN: Crown,
  VFX_SUPERVISOR: Clapperboard,
  POST_SUPERVISOR: Video,
  SUPERVISOR: Shield,
  PRODUCER: Shield,
  COORDINATOR: Users,
  ARTIST: Paintbrush,
  VFX_EDITOR: Film,
  CLIENT: Eye,
  VFX_VENDOR: Briefcase,
};

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const { currentUser, isAdmin } = useCurrentUser();
  
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [luts, setLuts] = useState<LutFile[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Add member dialog
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("ARTIST");
  
  // Add LUT dialog
  const [showAddLut, setShowAddLut] = useState(false);
  const [lutName, setLutName] = useState("");
  const [lutFile, setLutFile] = useState<File | null>(null);
  const [lutDescription, setLutDescription] = useState("");
  const [isDefaultLut, setIsDefaultLut] = useState(false);

  useEffect(() => {
    fetchProject();
    fetchMembers();
    fetchLuts();
    fetchUsers();
  }, [projectId]);

  async function fetchProject() {
    if (!supabase) return;
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();
    if (data) setProject(data);
    setLoading(false);
  }

  async function fetchMembers() {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error("Failed to fetch members:", err);
    }
  }

  async function fetchLuts() {
    if (!supabase) return;
    const { data } = await supabase
      .from("lut_files")
      .select("*")
      .eq("project_id", projectId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (data) setLuts(data);
  }

  async function fetchUsers() {
    if (!supabase) return;
    const { data } = await supabase
      .from("users")
      .select("id, name, email")
      .order("name");
    if (data) setUsers(data);
  }

  async function handleAddMember() {
    if (!selectedUserId || !selectedRole) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selectedUserId, role: selectedRole }),
      });
      if (res.ok) {
        await fetchMembers();
        setShowAddMember(false);
        setSelectedUserId("");
        setSelectedRole("ARTIST");
      }
    } catch (err) {
      console.error("Failed to add member:", err);
    }
    setSaving(false);
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm("Remove this team member from the project?")) return;
    try {
      await fetch(`/api/projects/${projectId}/members?user_id=${userId}`, {
        method: "DELETE",
      });
      await fetchMembers();
    } catch (err) {
      console.error("Failed to remove member:", err);
    }
  }

  async function handleUploadLut() {
    if (!lutFile || !lutName || !supabase) return;
    setSaving(true);
    try {
      // Upload file to Supabase Storage
      const filePath = `luts/${projectId}/${Date.now()}_${lutFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("assets")
        .upload(filePath, lutFile);
      
      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage.from("assets").getPublicUrl(filePath);

      // If setting as default, unset other defaults first
      if (isDefaultLut) {
        await supabase
          .from("lut_files")
          .update({ is_default: false })
          .eq("project_id", projectId);
      }

      // Create LUT record
      const { error: dbError } = await supabase.from("lut_files").insert({
        project_id: projectId,
        name: lutName,
        description: lutDescription || null,
        file_path: urlData.publicUrl,
        format: lutFile.name.split(".").pop()?.toUpperCase() || null,
        lut_type: "SHOW",
        is_default: isDefaultLut,
        file_size: lutFile.size,
        uploaded_by_id: currentUser?.id,
      });

      if (dbError) throw dbError;

      await fetchLuts();
      setShowAddLut(false);
      setLutName("");
      setLutFile(null);
      setLutDescription("");
      setIsDefaultLut(false);
    } catch (err) {
      console.error("Failed to upload LUT:", err);
      alert("Failed to upload LUT. Check console for details.");
    }
    setSaving(false);
  }

  async function handleDeleteLut(lutId: string) {
    if (!confirm("Delete this LUT?") || !supabase) return;
    try {
      await supabase.from("lut_files").delete().eq("id", lutId);
      await fetchLuts();
    } catch (err) {
      console.error("Failed to delete LUT:", err);
    }
  }

  async function handleSetDefaultLut(lutId: string) {
    if (!supabase) return;
    try {
      // Unset all defaults for this project
      await supabase
        .from("lut_files")
        .update({ is_default: false })
        .eq("project_id", projectId);
      // Set the new default
      await supabase
        .from("lut_files")
        .update({ is_default: true })
        .eq("id", lutId);
      await fetchLuts();
    } catch (err) {
      console.error("Failed to set default LUT:", err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  // Users not already on the team
  const availableUsers = users.filter(u => !members.some(m => m.user.id === u.id));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/projects")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground">{project.code}</p>
        </div>
        <Badge variant="outline" className="ml-auto">{project.status}</Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="team" className="space-y-4">
        <TabsList>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="luts" className="gap-2">
            <FileImage className="h-4 w-4" />
            LUTs
          </TabsTrigger>
        </TabsList>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Project Team</h2>
            {isAdmin && (
              <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Team Member</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <label className="text-sm font-medium">User</label>
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="Select user..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableUsers.map(u => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name || u.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Role on this Project</label>
                      <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as UserRole)}>
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(roleLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={handleAddMember}
                      disabled={saving || !selectedUserId}
                    >
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                      Add to Team
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {members.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No team members assigned yet</p>
                <p className="text-sm">Add team members to define who works on this project</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {members.map((member) => {
                const Icon = roleIcons[member.role] || Users;
                const colors = roleColors[member.role] || { color: "text-gray-400", bg: "bg-gray-400/10" };
                return (
                  <Card key={member.id}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <Avatar>
                        <AvatarFallback>
                          {(member.user.name || member.user.email).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{member.user.name || member.user.email}</p>
                        <p className="text-sm text-muted-foreground truncate">{member.user.email}</p>
                      </div>
                      <Badge variant="outline" className={cn("gap-1", colors.color, colors.bg)}>
                        <Icon className="h-3 w-3" />
                        {roleLabels[member.role] || member.role}
                      </Badge>
                      {isAdmin && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => handleRemoveMember(member.user.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* LUTs Tab */}
        <TabsContent value="luts" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Show LUTs</h2>
            {isAdmin && (
              <Dialog open={showAddLut} onOpenChange={setShowAddLut}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload LUT
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload LUT</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <label className="text-sm font-medium">Name</label>
                      <Input 
                        className="mt-1.5"
                        value={lutName}
                        onChange={(e) => setLutName(e.target.value)}
                        placeholder="e.g., Show LUT v1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description (optional)</label>
                      <Input 
                        className="mt-1.5"
                        value={lutDescription}
                        onChange={(e) => setLutDescription(e.target.value)}
                        placeholder="e.g., Primary color grade"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">LUT File</label>
                      <Input 
                        className="mt-1.5"
                        type="file"
                        accept=".cube,.3dl,.look,.mga,.csp"
                        onChange={(e) => setLutFile(e.target.files?.[0] || null)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Supported: .cube, .3dl, .look, .mga, .csp
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isDefault"
                        checked={isDefaultLut}
                        onChange={(e) => setIsDefaultLut(e.target.checked)}
                        className="rounded border-gray-600"
                      />
                      <label htmlFor="isDefault" className="text-sm">
                        Set as default show LUT
                      </label>
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={handleUploadLut}
                      disabled={saving || !lutName || !lutFile}
                    >
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      Upload
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {luts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileImage className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No LUTs uploaded yet</p>
                <p className="text-sm">Upload a show LUT for artists to use</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {luts.map((lut) => (
                <Card key={lut.id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center",
                      lut.is_default ? "bg-amber-500/20" : "bg-zinc-800"
                    )}>
                      <FileImage className={cn(
                        "h-5 w-5",
                        lut.is_default ? "text-amber-500" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{lut.name}</p>
                        {lut.is_default && (
                          <Badge variant="outline" className="text-amber-500 border-amber-500/50">
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {lut.format} • {lut.file_size ? `${(lut.file_size / 1024).toFixed(1)} KB` : 'Unknown size'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!lut.is_default && isAdmin && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleSetDefaultLut(lut.id)}
                        >
                          Set Default
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="icon"
                        asChild
                      >
                        <a href={lut.file_path} download>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      {isAdmin && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => handleDeleteLut(lut.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
