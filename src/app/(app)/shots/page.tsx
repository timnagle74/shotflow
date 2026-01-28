"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShotStatusBadge } from "@/components/status-badge";
import { mockShots, mockSequences, mockUsers, mockProjects, getShotsForProject } from "@/lib/mock-data";
import { shotStatusLabels, shotStatusColors, complexityColors, cn } from "@/lib/utils";
import { LayoutGrid, List, Filter, Search, Clock, User } from "lucide-react";
import Link from "next/link";

const STATUSES = ["NOT_STARTED", "IN_PROGRESS", "INTERNAL_REVIEW", "CLIENT_REVIEW", "APPROVED", "FINAL"] as const;

export default function ShotsPage() {
  const [selectedProject, setSelectedProject] = useState("p1");
  const [filterSequence, setFilterSequence] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterComplexity, setFilterComplexity] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const allShots = getShotsForProject(selectedProject);
  const projectSequences = mockSequences.filter(s => s.projectId === selectedProject);

  const filteredShots = allShots.filter(shot => {
    if (filterSequence !== "all" && shot.sequenceId !== filterSequence) return false;
    if (filterAssignee !== "all" && shot.assignedToId !== filterAssignee) return false;
    if (filterComplexity !== "all" && shot.complexity !== filterComplexity) return false;
    if (searchQuery && !shot.code.toLowerCase().includes(searchQuery.toLowerCase()) && !shot.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

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
          <div className="grid grid-cols-6 gap-3">
            {STATUSES.map(status => {
              const shotsInStatus = filteredShots.filter(s => s.status === status);
              return (
                <div key={status} className="space-y-2">
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <div className={cn("h-2.5 w-2.5 rounded-full", shotStatusColors[status])} />
                    <span className="text-xs font-semibold uppercase tracking-wide">{shotStatusLabels[status]}</span>
                    <Badge variant="secondary" className="ml-auto text-[10px] px-1.5">{shotsInStatus.length}</Badge>
                  </div>
                  <div className="space-y-2 min-h-[200px]">
                    {shotsInStatus.map(shot => (
                      <Link key={shot.id} href={`/shots/${shot.id}`}>
                        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-mono font-bold">{shot.code}</span>
                              <span className={cn("text-[10px] font-semibold", complexityColors[shot.complexity])}>{shot.complexity}</span>
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
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
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
