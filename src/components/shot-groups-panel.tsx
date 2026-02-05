"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Users, Film, Video, ChevronRight, ChevronDown, Loader2 } from "lucide-react";

interface ShotGroup {
  id: string;
  name: string;
  description: string | null;
  color: string;
  project_id: string;
  sequence_id: string | null;
  shot_group_members: { shot_id: string; shots: { id: string; code: string } }[];
  shot_group_plates: { id: string; filename: string; cdn_url: string | null }[];
  shot_group_refs: { id: string; filename: string; cdn_url: string | null }[];
}

interface Shot {
  id: string;
  code: string;
  description?: string | null;
  notes?: string | null;
}

interface ShotGroupsPanelProps {
  projectId: string;
  sequenceId?: string;
  shots: Shot[];
  selectedShotIds?: string[];
  onGroupSelect?: (group: ShotGroup) => void;
}

export function ShotGroupsPanel({
  projectId,
  sequenceId,
  shots,
  selectedShotIds = [],
  onGroupSelect,
}: ShotGroupsPanelProps) {
  const [groups, setGroups] = useState<ShotGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Predefined color options
  const COLOR_OPTIONS = [
    "#6366f1", // indigo
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#ef4444", // red
    "#f97316", // orange
    "#eab308", // yellow
    "#22c55e", // green
    "#14b8a6", // teal
    "#06b6d4", // cyan
    "#3b82f6", // blue
  ];

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [newGroupColor, setNewGroupColor] = useState(COLOR_OPTIONS[0]);
  const [creating, setCreating] = useState(false);

  // Add shots dialog
  const [showAddShots, setShowAddShots] = useState<string | null>(null);
  const [shotSearchTerm, setShotSearchTerm] = useState("");
  const [selectedForAdd, setSelectedForAdd] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sequenceId) params.set("sequenceId", sequenceId);
      else if (projectId) params.set("projectId", projectId);

      const res = await fetch(`/api/shot-groups?${params}`);
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
    } catch (err) {
      console.error("Failed to fetch groups:", err);
    }
    setLoading(false);
  }, [projectId, sequenceId]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreating(true);

    try {
      const res = await fetch("/api/shot-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sequenceId: sequenceId || null,
          name: newGroupName.trim(),
          description: newGroupDesc.trim() || null,
          color: newGroupColor,
          shotIds: selectedShotIds,
        }),
      });

      if (res.ok) {
        setNewGroupName("");
        setNewGroupDesc("");
        setNewGroupColor(COLOR_OPTIONS[0]);
        setShowCreate(false);
        fetchGroups();
      }
    } catch (err) {
      console.error("Failed to create group:", err);
    }
    setCreating(false);
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Delete this group?")) return;

    try {
      await fetch(`/api/shot-groups?id=${groupId}`, { method: "DELETE" });
      fetchGroups();
    } catch (err) {
      console.error("Failed to delete group:", err);
    }
  };

  const handleAddShots = async (groupId: string) => {
    if (selectedForAdd.size === 0) return;
    setAdding(true);

    try {
      await fetch("/api/shot-groups/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          shotIds: Array.from(selectedForAdd),
        }),
      });
      setShowAddShots(null);
      setSelectedForAdd(new Set());
      fetchGroups();
    } catch (err) {
      console.error("Failed to add shots:", err);
    }
    setAdding(false);
  };

  const handleRemoveShot = async (groupId: string, shotId: string) => {
    try {
      await fetch(`/api/shot-groups/members?groupId=${groupId}&shotId=${shotId}`, {
        method: "DELETE",
      });
      fetchGroups();
    } catch (err) {
      console.error("Failed to remove shot:", err);
    }
  };

  const toggleExpand = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const filteredShots = shots.filter((s) => {
    const searchLower = shotSearchTerm.toLowerCase();
    const matchesSearch =
      s.code.toLowerCase().includes(searchLower) ||
      s.description?.toLowerCase().includes(searchLower) ||
      s.notes?.toLowerCase().includes(searchLower);
    const notInGroup = !groups
      .find((g) => g.id === showAddShots)
      ?.shot_group_members.some((m) => m.shot_id === s.id);
    return matchesSearch && notInGroup;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Shot Groups
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            New
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No groups yet. Create one to organize related shots.
          </p>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => {
              const isExpanded = expandedGroups.has(group.id);
              const memberCount = group.shot_group_members.length;
              const plateCount = group.shot_group_plates.length;
              const refCount = group.shot_group_refs.length;

              return (
                <div key={group.id} className="border rounded-md">
                  <div
                    className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleExpand(group.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: group.color }}
                    />
                    <span className="font-medium text-sm flex-1">{group.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {memberCount} shots
                    </Badge>
                    {plateCount > 0 && (
                      <Badge variant="outline" className="text-xs">
                        <Film className="h-3 w-3 mr-1" />
                        {plateCount}
                      </Badge>
                    )}
                    {refCount > 0 && (
                      <Badge variant="outline" className="text-xs">
                        <Video className="h-3 w-3 mr-1" />
                        {refCount}
                      </Badge>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t bg-muted/20">
                      {group.description && (
                        <p className="text-xs text-muted-foreground mb-2">{group.description}</p>
                      )}

                      <div className="flex flex-wrap gap-1 mb-2">
                        {group.shot_group_members.map((m) => (
                          <Badge
                            key={m.shot_id}
                            variant="secondary"
                            className="text-xs cursor-pointer hover:bg-destructive/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveShot(group.id, m.shot_id);
                            }}
                          >
                            {m.shots.code}
                            <span className="ml-1 opacity-50">×</span>
                          </Badge>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowAddShots(group.id);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Shots
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGroup(group.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Create Group Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Shot Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g., Sky Replacement, Window Comps"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Input
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
                placeholder="Notes about this group..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-7 h-7 rounded-full transition-all ${
                      newGroupColor === color 
                        ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110" 
                        : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewGroupColor(color)}
                  />
                ))}
              </div>
            </div>
            {selectedShotIds.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedShotIds.length} selected shot(s) will be added to this group.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup} disabled={!newGroupName.trim() || creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Shots Dialog */}
      <Dialog open={!!showAddShots} onOpenChange={() => setShowAddShots(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Shots to Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Search shots..."
              value={shotSearchTerm}
              onChange={(e) => setShotSearchTerm(e.target.value)}
            />
            <ScrollArea className="h-80 border rounded-md p-2">
              {filteredShots.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No available shots
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredShots.map((shot) => {
                    const shotNotes = shot.description || shot.notes;
                    return (
                      <label
                        key={shot.id}
                        className="flex items-start gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                      >
                        <Checkbox
                          className="mt-0.5"
                          checked={selectedForAdd.has(shot.id)}
                          onCheckedChange={(checked) => {
                            setSelectedForAdd((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(shot.id);
                              else next.delete(shot.id);
                              return next;
                            });
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{shot.code}</span>
                          {shotNotes && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {shotNotes}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddShots(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => showAddShots && handleAddShots(showAddShots)}
              disabled={selectedForAdd.size === 0 || adding}
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add {selectedForAdd.size} Shot(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
