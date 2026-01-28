"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockProjects, getStatusCounts, getDeliverySpecsForProject } from "@/lib/mock-data";
import { Plus, Settings, FolderKanban, Monitor, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ProjectsPage() {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", code: "", status: "ACTIVE" });

  const handleCreateProject = async () => {
    if (!newProject.name || !newProject.code || !supabase) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("projects")
        .insert([{ 
          name: newProject.name, 
          code: newProject.code.toUpperCase(), 
          status: newProject.status
        }] as any);
      
      if (error) throw error;
      setShowCreate(false);
      setNewProject({ name: "", code: "", status: "ACTIVE" });
      router.refresh();
    } catch (err) {
      console.error("Failed to create project:", err);
      alert("Failed to create project. Check if project code already exists.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">Manage VFX projects and their settings</p>
        </div>
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
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockProjects.map((project) => {
          const counts = getStatusCounts(project.id);
          const total = Object.values(counts).reduce((a, b) => a + b, 0);
          const done = (counts.APPROVED || 0) + (counts.FINAL || 0);
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const specs = getDeliverySpecsForProject(project.id);

          return (
            <Card key={project.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FolderKanban className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{project.name}</CardTitle>
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
                      <p className="text-lg font-bold">{total}</p>
                      <p className="text-[10px] text-muted-foreground">SHOTS</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-lg font-bold text-amber-400">{counts.IN_PROGRESS + counts.INTERNAL_REVIEW + counts.CLIENT_REVIEW}</p>
                      <p className="text-[10px] text-muted-foreground">ACTIVE</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-lg font-bold text-green-400">{done}</p>
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
                        <span>{specs.resolution} • {specs.format} • {specs.frameRate}fps • {specs.colorSpace}</span>
                      </div>
                    </>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Link href={`/shots?project=${project.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">View Shots</Button>
                    </Link>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
