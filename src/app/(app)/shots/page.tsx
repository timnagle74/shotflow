"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShotStatusBadge } from "@/components/status-badge";
import { shotStatusLabels, shotStatusColors, complexityColors, cn } from "@/lib/utils";
import { LayoutGrid, List, Search, Clock, Loader2, Users } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ShotGroupsPanel } from "@/components/shot-groups-panel";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSearchParams } from "next/navigation";
import { CountSheetExport } from "@/components/count-sheet-export";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { ShotStatus } from "@/lib/database.types";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const STATUSES: ShotStatus[] = ["NOT_STARTED", "IN_PROGRESS", "REVISIONS", "INTERNAL_REVIEW", "CLIENT_REVIEW", "APPROVED", "FINAL"];

interface Project {
  id: string;
  name: string;
}

interface Sequence {
  id: string;
  name: string;
  code: string;
  project_id: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Shot {
  id: string;
  code: string;
  description: string | null;
  status: string;
  complexity: string;
  assigned_to_id: string | null;
  due_date: string | null;
  frame_start: number | null;
  frame_end: number | null;
  sequence_id: string;
  notes: string | null;
  ref_video_id?: string | null;
  ref_filename?: string | null;
}

interface EnrichedShot extends Shot {
  assignedTo: UserProfile | null;
  sequence: Sequence | null;
  versionCount: number;
  notes: string | null;
  ref_video_id?: string | null;
  ref_filename?: string | null;
}

// Droppable column wrapper
function KanbanColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn("space-y-2 min-h-[200px] rounded-lg transition-colors", isOver && "bg-primary/5")}>
      {children}
    </div>
  );
}

// Draggable shot card
function DraggableShotCard({ shot }: { shot: EnrichedShot }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: shot.id,
    data: { status: shot.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
      <Card className="hover:border-primary/50 transition-colors group" onDoubleClick={() => window.location.href = `/shots/${shot.id}`}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono font-bold flex-1">
              {shot.code}
            </span>
            <div className="flex items-center gap-1">
              <span className={cn("text-[10px] font-semibold", complexityColors[shot.complexity as keyof typeof complexityColors])}>{shot.complexity}</span>
            </div>
          </div>
          {shot.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{shot.description}</p>
          )}
          <div className="flex items-center justify-between">
            {shot.assignedTo ? (
              <div className="flex items-center gap-1.5">
                <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-primary">{shot.assignedTo.name.split(" ").map(n => n[0]).join("")}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{shot.assignedTo.name.split(" ")[0]}</span>
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground italic">Unassigned</span>
            )}
            {shot.versionCount > 0 && (
              <Badge variant="outline" className="text-[9px] px-1">v{shot.versionCount}</Badge>
            )}
          </div>
          {shot.due_date && (
            <div className="flex items-center gap-1 mt-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">{new Date(shot.due_date).toLocaleDateString()}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Overlay card shown while dragging
function ShotCardOverlay({ shot }: { shot: EnrichedShot }) {
  return (
    <Card className="border-primary shadow-lg shadow-primary/20 w-[200px]">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono font-bold">{shot.code}</span>
          <span className={cn("text-[10px] font-semibold", complexityColors[shot.complexity as keyof typeof complexityColors])}>{shot.complexity}</span>
        </div>
        {shot.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{shot.description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ShotsPageContent() {
  const searchParams = useSearchParams();
  const projectFromUrl = searchParams.get("project");
  const { currentUser, loading: userLoading, isArtist, canSeeAllShots } = useCurrentUser();
  
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [versionCounts, setVersionCounts] = useState<Record<string, number>>({});
  
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [filterSequence, setFilterSequence] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterComplexity, setFilterComplexity] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Load initial data
  useEffect(() => {
    async function fetchData() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        // Fetch projects
        const { data: projectsData } = await supabase
          .from("projects")
          .select("id, name")
          .order("name")
          .limit(100);
        
        if (projectsData) {
          setProjects(projectsData);
          // Set initial project from URL or first project
          const initialProject = projectFromUrl || projectsData[0]?.id || "";
          setSelectedProject(initialProject);
        }

        // Fetch all sequences
        const { data: seqData } = await supabase
          .from("sequences")
          .select("id, name, code, project_id")
          .limit(1000);
        if (seqData) setSequences(seqData as Sequence[]);

        // Fetch all users
        const { data: usersData } = await supabase
          .from("users")
          .select("id, name, email, role")
          .limit(500);
        if (usersData) setUsers(usersData as UserProfile[]);

      } catch (err) {
        console.error("Error loading data:", err);
      }
      setLoading(false);
    }

    fetchData();
  }, [projectFromUrl]);

  // Load shots when project changes
  useEffect(() => {
    async function fetchShots() {
      if (!supabase || !selectedProject || userLoading) return;

      try {
        // Get sequence IDs for this project
        const projectSeqs = sequences.filter(s => s.project_id === selectedProject);
        const seqIds = projectSeqs.map(s => s.id);

        if (seqIds.length === 0) {
          setShots([]);
          return;
        }

        // Fetch shots for these sequences
        // For artists without can_view_all_shots, only show their assigned shots
        let shotsQuery = supabase
          .from("shots")
          .select("*")
          .in("sequence_id", seqIds);
        
        if (isArtist && !canSeeAllShots && currentUser) {
          shotsQuery = shotsQuery.eq("assigned_to_id", currentUser.id);
        }
        
        const { data: shotsData } = await shotsQuery;

        if (shotsData) {
          setShots(shotsData as Shot[]);

          // Fetch version counts — prefer shot_versions, fall back to versions
          const shotIds = shotsData.map(s => s.id);
          if (shotIds.length > 0) {
            const { data: svData, error: svErr } = await supabase
              .from("shot_versions")
              .select("shot_id")
              .in("shot_id", shotIds);
            
            const versionsData = (!svErr && svData && svData.length > 0)
              ? svData
              : (await supabase.from("versions").select("shot_id").in("shot_id", shotIds)).data;

            if (versionsData) {
              const counts: Record<string, number> = {};
              versionsData.forEach(v => {
                counts[v.shot_id] = (counts[v.shot_id] || 0) + 1;
              });
              setVersionCounts(counts);
            }
          }
        }
      } catch (err) {
        console.error("Error loading shots:", err);
      }
    }

    fetchShots();
  }, [selectedProject, sequences, userLoading, currentUser, isArtist, canSeeAllShots]);

  // Update selected project when URL changes
  useEffect(() => {
    if (projectFromUrl && projects.some(p => p.id === projectFromUrl)) {
      setSelectedProject(projectFromUrl);
    }
  }, [projectFromUrl, projects]);

  // Enrich shots with related data
  const enrichedShots: EnrichedShot[] = shots.map(shot => ({
    ...shot,
    assignedTo: shot.assigned_to_id ? users.find(u => u.id === shot.assigned_to_id) || null : null,
    sequence: sequences.find(s => s.id === shot.sequence_id) || null,
    versionCount: versionCounts[shot.id] || 0,
  }));

  const projectSequences = sequences.filter(s => s.project_id === selectedProject);

  const filteredShots = enrichedShots.filter(shot => {
    if (filterSequence !== "all" && shot.sequence_id !== filterSequence) return false;
    if (filterAssignee !== "all" && shot.assigned_to_id !== filterAssignee) return false;
    if (filterComplexity !== "all" && shot.complexity !== filterComplexity) return false;
    if (searchQuery && !shot.code.toLowerCase().includes(searchQuery.toLowerCase()) && !shot.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const activeShot = activeId ? enrichedShots.find(s => s.id === activeId) : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const shotId = active.id as string;
    let newStatus: string;
    if (STATUSES.includes(over.id as ShotStatus)) {
      newStatus = over.id as string;
    } else {
      const overShot = enrichedShots.find(s => s.id === over.id);
      if (!overShot) return;
      newStatus = overShot.status;
    }

    const shot = enrichedShots.find(s => s.id === shotId);
    if (!shot || shot.status === newStatus) return;

    // Update local state immediately
    setShots(prev => prev.map(s => s.id === shotId ? { ...s, status: newStatus } : s));

    // Update Supabase
    if (supabase) {
      const { error } = await supabase
        .from("shots")
        .update({ status: newStatus as any })
        .eq("id", shotId);
      if (error) console.error("Failed to update shot status:", error);
    }
  }, [enrichedShots]);

  if (loading || userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shots Board</h1>
          <p className="text-muted-foreground mt-1">
            {isArtist && !canSeeAllShots ? "Your assigned shots" : "Track and manage shots across sequences"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Users className="h-4 w-4 mr-2" />
                Groups
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[500px]">
              <div className="mt-6">
                <ShotGroupsPanel
                  projectId={selectedProject}
                  sequenceId={filterSequence !== "all" ? filterSequence : undefined}
                  shots={shots.map(s => ({ id: s.id, code: s.code }))}
                  selectedShotIds={[]}
                />
              </div>
            </SheetContent>
          </Sheet>
          <CountSheetExport 
            shots={filteredShots.map(s => ({
              id: s.id,
              code: s.code,
              description: s.description,
              status: s.status,
              complexity: s.complexity,
              frame_start: s.frame_start,
              frame_end: s.frame_end,
              notes: s.notes,
              ref_video_id: s.ref_video_id,
              ref_filename: s.ref_filename,
            }))}
            sequenceName={filterSequence !== "all" 
              ? projectSequences.find(s => s.id === filterSequence)?.name || "All Sequences"
              : "All Sequences"
            }
            projectName={projects.find(p => p.id === selectedProject)?.name || "Project"}
          />
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search shots..." className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <Select value={filterSequence} onValueChange={setFilterSequence}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Sequence" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sequences</SelectItem>
            {projectSequences.map(s => <SelectItem key={s.id} value={s.id}>{s.code}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Assignee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Artists</SelectItem>
            {users.filter(u => u.role === "ARTIST").map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterComplexity} onValueChange={setFilterComplexity}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Complexity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="SIMPLE">Simple</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="COMPLEX">Complex</SelectItem>
            <SelectItem value="HERO">Hero</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban"><LayoutGrid className="h-4 w-4 mr-2" />Kanban</TabsTrigger>
          <TabsTrigger value="table"><List className="h-4 w-4 mr-2" />Table</TabsTrigger>
        </TabsList>

        {/* Kanban View */}
        <TabsContent value="kanban">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-7 gap-3">
              {STATUSES.map(status => {
                const shotsInStatus = filteredShots.filter(s => s.status === status);
                return (
                  <div key={status}>
                    <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
                      <div className={cn("h-2.5 w-2.5 rounded-full", shotStatusColors[status])} />
                      <span className="text-xs font-semibold uppercase tracking-wide">{shotStatusLabels[status]}</span>
                      <Badge variant="secondary" className="ml-auto text-[10px] px-1.5">{shotsInStatus.length}</Badge>
                    </div>
                    <KanbanColumn id={status}>
                      {shotsInStatus.map(shot => (
                        <DraggableShotCard key={shot.id} shot={shot} />
                      ))}
                    </KanbanColumn>
                  </div>
                );
              })}
            </div>
            <DragOverlay>
              {activeShot ? <ShotCardOverlay shot={activeShot} /> : null}
            </DragOverlay>
          </DndContext>
        </TabsContent>

        {/* Table View */}
        <TabsContent value="table">
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground p-3">Shot</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-3">Description</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-3">Status</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-3">Complexity</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-3">Assignee</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-3">Versions</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-3">Frames</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-3">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredShots.map(shot => (
                    <tr key={shot.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <Link href={`/shots/${shot.id}`} className="font-mono text-sm font-bold text-primary hover:underline">{shot.code}</Link>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground max-w-[200px] truncate">{shot.description || "—"}</td>
                      <td className="p-3"><ShotStatusBadge status={shot.status} /></td>
                      <td className="p-3"><span className={cn("text-sm font-medium", complexityColors[shot.complexity as keyof typeof complexityColors])}>{shot.complexity}</span></td>
                      <td className="p-3 text-sm">{shot.assignedTo?.name || <span className="text-muted-foreground italic">Unassigned</span>}</td>
                      <td className="p-3 text-sm">{shot.versionCount > 0 ? `v${String(shot.versionCount).padStart(3, "0")}` : "—"}</td>
                      <td className="p-3 text-sm font-mono text-muted-foreground">{shot.frame_start && shot.frame_end ? `${shot.frame_end - shot.frame_start}f` : "—"}</td>
                      <td className="p-3 text-sm text-muted-foreground">{shot.due_date ? new Date(shot.due_date).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ShotsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <ShotsPageContent />
    </Suspense>
  );
}
