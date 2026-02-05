"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, Users, FileImage, Settings, Plus, Trash2, Loader2, 
  Download, Upload, Crown, Clapperboard, Video, Shield, Briefcase,
  Paintbrush, Film, Eye, Monitor, Save
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/use-current-user";
import { roleLabels, roleColors, cn } from "@/lib/utils";
import type { UserRole, DeliverySpecType } from "@/lib/database.types";

interface DeliverySpec {
  id: string;
  project_id: string;
  spec_type: DeliverySpecType;
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

const SPEC_PRESETS: Record<string, { label: string; resolution: string; format: string; color_space: string; bit_depth: string }> = {
  EXR_16: { label: "EXR 16-bit (VFX)", resolution: "Match Source", format: "OpenEXR", color_space: "ACES AP0", bit_depth: "16-bit Half" },
  DPX_10: { label: "DPX 10-bit (Film)", resolution: "Match Source", format: "DPX", color_space: "Film Log", bit_depth: "10-bit" },
  PRORES_4444: { label: "ProRes 4444", resolution: "Match Source", format: "ProRes 4444", color_space: "Rec.709", bit_depth: "12-bit" },
  PRORES_HQ: { label: "ProRes HQ", resolution: "1920x1080", format: "ProRes 422 HQ", color_space: "Rec.709", bit_depth: "10-bit" },
  DNX_36: { label: "DNxHD 36", resolution: "1920x1080", format: "DNxHD 36", color_space: "Rec.709", bit_depth: "8-bit" },
};

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
  file_path: string | null;
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

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
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
  
  // Delivery specs
  const [editorialSpec, setEditorialSpec] = useState<DeliverySpec | null>(null);
  const [finalSpec, setFinalSpec] = useState<DeliverySpec | null>(null);
  const [savingSpecs, setSavingSpecs] = useState(false);

  useEffect(() => {
    fetchProject();
    fetchMembers();
    fetchLuts();
    fetchUsers();
    fetchDeliverySpecs();
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

  async function fetchDeliverySpecs() {
    if (!supabase) return;
    const { data } = await supabase
      .from("delivery_specs")
      .select("*")
      .eq("project_id", projectId);
    
    if (data) {
      const editorial = data.find(s => s.spec_type === "EDITORIAL");
      const final = data.find(s => s.spec_type === "FINAL");
      setEditorialSpec(editorial || createEmptySpec("EDITORIAL"));
      setFinalSpec(final || createEmptySpec("FINAL"));
    } else {
      setEditorialSpec(createEmptySpec("EDITORIAL"));
      setFinalSpec(createEmptySpec("FINAL"));
    }
  }

  function createEmptySpec(specType: DeliverySpecType): DeliverySpec {
    return {
      id: "",
      project_id: projectId,
      spec_type: specType,
      resolution: null,
      format: null,
      frame_rate: null,
      color_space: null,
      bit_depth: null,
      handles_head: 8,
      handles_tail: 8,
      naming_convention: null,
      audio_requirements: null,
      additional_notes: null,
    };
  }

  async function handleSaveSpec(spec: DeliverySpec) {
    if (!supabase) return;
    setSavingSpecs(true);
    try {
      if (spec.id) {
        // Update existing
        const { error } = await supabase
          .from("delivery_specs")
          .update({
            resolution: spec.resolution,
            format: spec.format,
            frame_rate: spec.frame_rate,
            color_space: spec.color_space,
            bit_depth: spec.bit_depth,
            handles_head: spec.handles_head,
            handles_tail: spec.handles_tail,
            naming_convention: spec.naming_convention,
            audio_requirements: spec.audio_requirements,
            additional_notes: spec.additional_notes,
          })
          .eq("id", spec.id);
        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from("delivery_specs")
          .insert({
            project_id: projectId,
            spec_type: spec.spec_type,
            resolution: spec.resolution,
            format: spec.format,
            frame_rate: spec.frame_rate,
            color_space: spec.color_space,
            bit_depth: spec.bit_depth,
            handles_head: spec.handles_head,
            handles_tail: spec.handles_tail,
            naming_convention: spec.naming_convention,
            audio_requirements: spec.audio_requirements,
            additional_notes: spec.additional_notes,
          })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          if (spec.spec_type === "EDITORIAL") {
            setEditorialSpec(data);
          } else {
            setFinalSpec(data);
          }
        }
      }
      await fetchDeliverySpecs();
    } catch (err) {
      console.error("Failed to save spec:", err);
      alert("Failed to save delivery specs");
    }
    setSavingSpecs(false);
  }

  function applyPreset(specType: DeliverySpecType, presetKey: string) {
    const preset = SPEC_PRESETS[presetKey];
    if (!preset) return;
    
    const updatedSpec = {
      ...(specType === "EDITORIAL" ? editorialSpec : finalSpec)!,
      resolution: preset.resolution,
      format: preset.format,
      color_space: preset.color_space,
      bit_depth: preset.bit_depth,
    };
    
    if (specType === "EDITORIAL") {
      setEditorialSpec(updatedSpec);
    } else {
      setFinalSpec(updatedSpec);
    }
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
  const availableUsers = users.filter(u => !members.some(m => m.user?.id === u.id));

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
          <TabsTrigger value="specs" className="gap-2">
            <Monitor className="h-4 w-4" />
            Delivery Specs
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
              {members.filter(m => m.user).map((member) => {
                const Icon = roleIcons[member.role] || Users;
                const colors = roleColors[member.role] || { color: "text-gray-400", bg: "bg-gray-400/10" };
                const userName = member.user?.name || member.user?.email || "Unknown";
                const userEmail = member.user?.email || "";
                return (
                  <Card key={member.id}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <Avatar>
                        <AvatarFallback>
                          {userName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{userName}</p>
                        <p className="text-sm text-muted-foreground truncate">{userEmail}</p>
                      </div>
                      <Badge variant="outline" className={cn("gap-1", colors.color, colors.bg)}>
                        <Icon className="h-3 w-3" />
                        {roleLabels[member.role] || member.role}
                      </Badge>
                      {isAdmin && member.user && (
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

        {/* Delivery Specs Tab */}
        <TabsContent value="specs" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Editorial Specs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Editorial Delivery</CardTitle>
                <CardDescription>Specs for editorial/offline deliveries</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {editorialSpec && (
                  <DeliverySpecForm
                    spec={editorialSpec}
                    onChange={setEditorialSpec}
                    onSave={() => handleSaveSpec(editorialSpec)}
                    onApplyPreset={(key) => applyPreset("EDITORIAL", key)}
                    saving={savingSpecs}
                    isAdmin={isAdmin}
                  />
                )}
              </CardContent>
            </Card>

            {/* Final Specs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Final Delivery</CardTitle>
                <CardDescription>Specs for final/online deliveries</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {finalSpec && (
                  <DeliverySpecForm
                    spec={finalSpec}
                    onChange={setFinalSpec}
                    onSave={() => handleSaveSpec(finalSpec)}
                    onApplyPreset={(key) => applyPreset("FINAL", key)}
                    saving={savingSpecs}
                    isAdmin={isAdmin}
                  />
                )}
              </CardContent>
            </Card>
          </div>
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
                        <a href={lut.file_path || "#"} download={!!lut.file_path}>
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

// Delivery Spec Form Component
function DeliverySpecForm({
  spec,
  onChange,
  onSave,
  onApplyPreset,
  saving,
  isAdmin,
}: {
  spec: DeliverySpec;
  onChange: (spec: DeliverySpec) => void;
  onSave: () => void;
  onApplyPreset: (key: string) => void;
  saving: boolean;
  isAdmin: boolean;
}) {
  const updateField = (field: keyof DeliverySpec, value: any) => {
    onChange({ ...spec, [field]: value });
  };

  return (
    <div className="space-y-4">
      {/* Presets */}
      {isAdmin && (
        <div>
          <label className="text-xs text-muted-foreground">Quick Preset</label>
          <Select onValueChange={onApplyPreset}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Apply preset..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SPEC_PRESETS).map(([key, preset]) => (
                <SelectItem key={key} value={key}>{preset.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Resolution</label>
          <Input
            className="mt-1"
            value={spec.resolution || ""}
            onChange={(e) => updateField("resolution", e.target.value)}
            placeholder="e.g., 1920x1080"
            disabled={!isAdmin}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Frame Rate</label>
          <Input
            className="mt-1"
            value={spec.frame_rate || ""}
            onChange={(e) => updateField("frame_rate", e.target.value)}
            placeholder="e.g., 23.976"
            disabled={!isAdmin}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Format</label>
          <Input
            className="mt-1"
            value={spec.format || ""}
            onChange={(e) => updateField("format", e.target.value)}
            placeholder="e.g., ProRes 4444"
            disabled={!isAdmin}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Bit Depth</label>
          <Input
            className="mt-1"
            value={spec.bit_depth || ""}
            onChange={(e) => updateField("bit_depth", e.target.value)}
            placeholder="e.g., 10-bit"
            disabled={!isAdmin}
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Color Space</label>
        <Input
          className="mt-1"
          value={spec.color_space || ""}
          onChange={(e) => updateField("color_space", e.target.value)}
          placeholder="e.g., Rec.709, ACES"
          disabled={!isAdmin}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Handle Head</label>
          <Input
            className="mt-1"
            type="number"
            value={spec.handles_head}
            onChange={(e) => updateField("handles_head", parseInt(e.target.value) || 0)}
            disabled={!isAdmin}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Handle Tail</label>
          <Input
            className="mt-1"
            type="number"
            value={spec.handles_tail}
            onChange={(e) => updateField("handles_tail", parseInt(e.target.value) || 0)}
            disabled={!isAdmin}
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Naming Convention</label>
        <Input
          className="mt-1"
          value={spec.naming_convention || ""}
          onChange={(e) => updateField("naming_convention", e.target.value)}
          placeholder="e.g., [PROJECT]_[SHOT]_[VERSION].[####].exr"
          disabled={!isAdmin}
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Audio Requirements</label>
        <Input
          className="mt-1"
          value={spec.audio_requirements || ""}
          onChange={(e) => updateField("audio_requirements", e.target.value)}
          placeholder="e.g., 48kHz, 24-bit, Stereo"
          disabled={!isAdmin}
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Additional Notes</label>
        <Textarea
          className="mt-1"
          value={spec.additional_notes || ""}
          onChange={(e) => updateField("additional_notes", e.target.value)}
          placeholder="Any other delivery requirements..."
          rows={2}
          disabled={!isAdmin}
        />
      </div>

      {isAdmin && (
        <Button onClick={onSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save {spec.spec_type === "EDITORIAL" ? "Editorial" : "Final"} Specs
        </Button>
      )}
    </div>
  );
}
