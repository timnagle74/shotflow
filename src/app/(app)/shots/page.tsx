"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShotStatusBadge } from "@/components/status-badge";
import { mockShots, mockSequences, mockUsers, mockProjects, getShotsForProject } from "@/lib/mock-data";
import { shotStatusLabels, shotStatusColors, complexityColors, cn } from "@/lib/utils";
import { LayoutGrid, List, Search, Clock, GripVertical } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
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
  type DragOverEvent,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const STATUSES: ShotStatus[] = ["NOT_STARTED", "IN_PROGRESS", "INTERNAL_REVIEW", "CLIENT_REVIEW", "REVISIONS", "APPROVED", "FINAL"];

// Droppable column wrapper
function KanbanColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn("space-y-2 min-h-[200px] rounded-lg transition-colors", isOver && "bg-primary/5")}>
      {children}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EnrichedShot = Omit<ReturnType<typeof getShotsForProject>[number], 'status'> & { status: string };

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
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-1">
            <Link href={`/shots/${shot.id}`} className="text-xs font-mono font-bold hover:text-primary transition-colors flex-1">
              {shot.code}
            </Link>
            <div className="flex items-center gap-1">
              <span className={cn("text-[10px] font-semibold", complexityColors[shot.complexity])}>{shot.complexity}</span>
              <div {...listeners} className="cursor-grab active:cursor-grabbing p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="h-3 w-3 text-muted-foreground" />
              </div>
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
            {shot.versions.length > 0 && (
              <Badge variant="outline" className="text-[9px] px-1">v{shot.versions.length}</Badge>
            )}
          </div>
          {shot.dueDate && (
            <div className="flex items-center gap-1 mt-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">{shot.dueDate.toLocaleDateString()}</span>
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
          <span className={cn("text-[10px] font-semibold", complexityColors[shot.complexity])}>{shot.complexity}</span>
        </div>
        {shot.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{shot.description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ShotsPage() {
  const [selectedProject, setSelectedProject] = useState("p1");
  const [filterSequence, setFilterSequence] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterComplexity, setFilterComplexity] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [shotStatuses, setShotStatuses] = useState<Record<string, string>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const allShots: EnrichedShot[] = getShotsForProject(selectedProject).map(s => ({
    ...s,
    status: shotStatuses[s.id] || s.status,
  }));
  const projectSequences = mockSequences.filter(s => s.projectId === selectedProject);

  const filteredShots = allShots.filter(shot => {
    if (filterSequence !== "all" && shot.sequenceId !== filterSequence) return false;
    if (filterAssignee !== "all" && shot.assignedToId !== filterAssignee) return false;
    if (filterComplexity !== "all" && shot.complexity !== filterComplexity) return false;
    if (searchQuery && !shot.code.toLowerCase().includes(searchQuery.toLowerCase()) && !shot.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const activeShot = activeId ? allShots.find(s => s.id === activeId) : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const shotId = active.id as string;
    // The over target could be a column ID (status) or another shot card
    let newStatus: string;
    if (STATUSES.includes(over.id as ShotStatus)) {
      newStatus = over.id as string;
    } else {
      // Dropped on a shot card — find that shot's status
      const overShot = allShots.find(s => s.id === over.id);
      if (!overShot) return;
      newStatus = overShot.status;
    }

    const shot = allShots.find(s => s.id === shotId);
    if (!shot || shot.status === newStatus) return;

    // Update local state immediately
    setShotStatuses(prev => ({ ...prev, [shotId]: newStatus }));

    // Also update mock data in memory
    const idx = mockShots.findIndex(s => s.id === shotId);
    if (idx !== -1) {
      (mockShots[idx] as { status: string }).status = newStatus;
    }

    // Update Supabase if configured
    if (supabase) {
      const { error } = await (supabase as any)
        .from("shots")
        .update({ status: newStatus })
        .eq("id", shotId);
      if (error) console.error("Failed to update shot status:", error);
    }
  }, [allShots]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shots Board</h1>
          <p className="text-muted-foreground mt-1">Track and manage shots across sequences</p>
        </div>
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {mockProjects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            {mockUsers.filter(u => u.role === "ARTIST").map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
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
                      <td className="p-3"><span className={cn("text-sm font-medium", complexityColors[shot.complexity])}>{shot.complexity}</span></td>
                      <td className="p-3 text-sm">{shot.assignedTo?.name || <span className="text-muted-foreground italic">Unassigned</span>}</td>
                      <td className="p-3 text-sm">{shot.versions.length > 0 ? `v${String(shot.versions.length).padStart(3, "0")}` : "—"}</td>
                      <td className="p-3 text-sm font-mono text-muted-foreground">{shot.frameStart && shot.frameEnd ? `${shot.frameEnd - shot.frameStart}f` : "—"}</td>
                      <td className="p-3 text-sm text-muted-foreground">{shot.dueDate?.toLocaleDateString() || "—"}</td>
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
