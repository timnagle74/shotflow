"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Settings, FolderKanban, Monitor, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";

export default function ProjectsPage() {
  const router = useRouter();
  const { currentUser, loading: userLoading, isArtist, isAdmin } = useCurrentUser();
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [projectStats, setProjectStats] = useState<Record<string, { total: number; active: number; done: number }>>({});
  const [projectSpecs, setProjectSpecs] = useState<Record<string, any>>({});
  const [newProject, setNewProject] = useState({ name: "", code: "", status: "ACTIVE" });

  useEffect(() => {
    if (!userLoading && currentUser) {
      fetchProjects();
    }
  }, [userLoading, currentUser, isAdmin]);

  async function fetchProjects() {
    if (!supabase) {
      setInitialLoading(false);
      return;
    }
    try {
      let data: any[] | null = null;
      
      // Admins see all projects, others only see projects they're assigned to
      if (isAdmin) {
        const result = await supabase.from("projects").select("id, name, code, status, created_at").order("created_at", { ascending: false }).limit(100);
        if (result.error) throw result.error;
        data = result.data;
      } else if (currentUser) {
        // Get projects user is a member of
        const { data: memberProjects, error: memberError } = await supabase
          .from("project_members")
          .select("project:projects(id, name, code, status, created_at)")
          .eq("user_id", currentUser.id);
        if (memberError) throw memberError;
        data = (memberProjects || []).map(m => m.project).filter(Boolean);
      }
      
      if (!data) data = [];

      // Fetch shot counts per project
      if (data && data.length > 0) {
        const stats: Record<string, { total: number; active: number; done: number }> = {};
        // For artists, only fetch their assigned shots
        let shotsQuery = supabase.from("shots").select("id, status, sequence_id, assigned_to_id").limit(5000);
        if (isArtist && currentUser) {
          shotsQuery = shotsQuery.eq("assigned_to_id", currentUser.id);
        }
        const { data: allShots } = await shotsQuery;
        const { data: allSeqs } = await supabase.from("sequences").select("id, project_id").limit(1000);
        const seqMap = new Map<string, string>();
        (allSeqs || []).forEach((s) => seqMap.set(s.id, s.project_id));

        for (const project of data) {
          const projectShots = (allShots || []).filter((sh) => {
            const projId = seqMap.get(sh.sequence_id);
            return projId === project.id;
          });
          const total = projectShots.length;
          const active = projectShots.filter((s) => ["IN_PROGRESS", "INTERNAL_REVIEW", "CLIENT_REVIEW"].includes(s.status)).length;
          const done = projectShots.filter((s) => ["APPROVED", "FINAL"].includes(s.status)).length;
          stats[project.id] = { total, active, done };
        }
        setProjectStats(stats);

        // For artists, only show projects that have their assigned shots
        if (isArtist && currentUser) {
          const projectsWithShots = data.filter((p) => stats[p.id] && stats[p.id].total > 0);
          setProjects(projectsWithShots);
        } else {
          setProjects(data || []);
        }

        // Fetch delivery specs per project
        const { data: specs } = await supabase.from("delivery_specs").select("*");
        if (specs) {
          const specsMap: Record<string, any> = {};
          for (const spec of specs) {
            specsMap[spec.project_id] = spec;
          }
          setProjectSpecs(specsMap);
        }
      } else {
        setProjects(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setInitialLoading(false);
    }
  }

  const handleCreateProject = async () => {
    if (!newProject.name || !newProject.code || !supabase) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("projects")
        .insert([{ 
          name: newProject.name, 
          code: newProject.code.toUpperCase(), 
          status: newProject.status as any
        }]);
      
      if (error) throw error;
      await fetchProjects();
      setShowCreate(false);
      setNewProject({ name: "", code: "", status: "ACTIVE" });
    } catch (err) {
      console.error("Failed to create project:", err);
      alert("Failed to create project. Check if project code already exists.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSettings = (project: any) => {
    setEditingProject({ ...project });
    setShowSettings(true);
  };

  const handleSaveSettings = async () => {
    if (!editingProject || !supabase) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({ 
          name: editingProject.name, 
          code: editingProject.code.toUpperCase(), 
          status: editingProject.status
        })
        .eq("id", editingProject.id);
      
      if (error) throw error;
      await fetchProjects();
      setShowSettings(false);
      setEditingProject(null);
    } catch (err) {
      console.error("Failed to update project:", err);
      alert("Failed to update project settings.");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading || userLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">
            {isArtist ? "Projects with shots assigned to you" : "Manage VFX projects and their settings"}
          </p>
        </div>
        {!isArtist && (
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium">Project Name</label>
                <Input 
                  placeholder="e.g. Nebula Rising" 
                  className="mt-1.5" 
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Project Code</label>
                <Input 
                  placeholder="e.g. NEB01" 
                  className="mt-1.5" 
                  value={newProject.code}
                  onChange={(e) => setNewProject({ ...newProject, code: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={newProject.status} onValueChange={(v) => setNewProject({ ...newProject, status: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="ON_HOLD">On Hold</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleCreateProject} disabled={loading || !newProject.name || !newProject.code}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : "Create Project"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderKanban className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-1">
              {isArtist ? "No projects with your shots" : "No projects yet"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {isArtist ? "Projects will appear here once shots are assigned to you." : "Create your first project to get started."}
            </p>
            {!isArtist && (
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-2" />New Project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const stats = projectStats[project.id] || { total: 0, active: 0, done: 0 };
            const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
            const specs = projectSpecs[project.id];

            return (
              <Card key={project.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Link href={`/projects/${project.id}`} className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors">
                        <FolderKanban className="h-5 w-5 text-primary" />
                      </Link>
                      <div>
                        <Link href={`/projects/${project.id}`}>
                          <CardTitle className="text-base hover:text-primary transition-colors">{project.name}</CardTitle>
                        </Link>
                        <p className="text-xs text-muted-foreground font-mono">{project.code}</p>
                      </div>
                    </div>
                    <Badge variant={project.status === "ACTIVE" ? "default" : "secondary"}>
                      {project.status.replace("_", " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className="text-lg font-bold">{stats.total}</p>
                        <p className="text-[10px] text-muted-foreground">SHOTS</p>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className="text-lg font-bold text-amber-400">{stats.active}</p>
                        <p className="text-[10px] text-muted-foreground">ACTIVE</p>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className="text-lg font-bold text-green-400">{stats.done}</p>
                        <p className="text-[10px] text-muted-foreground">DONE</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-green-600" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    {specs && (
                      <>
                        <Separator />
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Monitor className="h-3 w-3" />
                          <span>{specs.resolution} • {specs.format} • {specs.frame_rate}fps • {specs.color_space}</span>
                        </div>
                      </>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Link href={`/shots?project=${project.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">View Shots</Button>
                      </Link>
                      {!isArtist && (
                        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => handleOpenSettings(project)}>
                          <Settings className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Project Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Project Settings</DialogTitle>
          </DialogHeader>
          {editingProject && (
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium">Project Name</label>
                <Input 
                  className="mt-1.5" 
                  value={editingProject.name}
                  onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Project Code</label>
                <Input 
                  className="mt-1.5" 
                  value={editingProject.code}
                  onChange={(e) => setEditingProject({ ...editingProject, code: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={editingProject.status} onValueChange={(v) => setEditingProject({ ...editingProject, status: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="ON_HOLD">On Hold</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleSaveSettings} disabled={loading || !editingProject.name || !editingProject.code}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Settings"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
