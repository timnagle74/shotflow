"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  Film, Loader2, Building2, Upload, Clock, CheckCircle2, 
  AlertCircle, ExternalLink, User, Calendar
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface VendorShot {
  id: string;
  shot_id: string;
  vendor_id: string;
  artist_id: string | null;
  vfx_notes: string | null;
  assigned_at: string | null;
  shot: {
    id: string;
    code: string;
    description: string | null;
    status: string;
  };
  turnover: {
    id: string;
    turnover_number: number;
    title: string | null;
    project: {
      id: string;
      name: string;
      code: string;
    };
  };
  artist?: {
    id: string;
    name: string;
  };
  latest_version?: {
    id: string;
    version_code: string;
    status: string;
    created_at: string;
  };
}

interface Vendor {
  id: string;
  name: string;
  code: string | null;
  project_id: string;
}

interface Artist {
  id: string;
  vendor_id: string;
  name: string;
  role: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NOT_STARTED: { label: "Not Started", color: "bg-gray-500" },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-500" },
  INTERNAL_REVIEW: { label: "Internal Review", color: "bg-purple-500" },
  CLIENT_REVIEW: { label: "Client Review", color: "bg-amber-500" },
  APPROVED: { label: "Approved", color: "bg-green-500" },
  DELIVERED: { label: "Delivered", color: "bg-emerald-600" },
};

export default function VendorPortalPage() {
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [shots, setShots] = useState<VendorShot[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Load vendors
  useEffect(() => {
    async function loadVendors() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data: vendorsData } = await (supabase as any)
        .from("vendors")
        .select("id, name, code, project_id")
        .eq("active", true)
        .order("name");

      const typedVendors = (vendorsData || []) as Vendor[];
      if (typedVendors.length > 0) {
        setVendors(typedVendors);
        setSelectedVendor(typedVendors[0].id);
      }

      setLoading(false);
    }

    loadVendors();
  }, []);

  // Load shots for selected vendor
  useEffect(() => {
    async function loadVendorShots() {
      if (!supabase || !selectedVendor) return;

      // Get assigned shots
      const { data: shotsData } = await (supabase as any)
        .from("turnover_shots")
        .select(`
          id, shot_id, vendor_id, artist_id, vfx_notes, assigned_at,
          shot:shots(id, code, description, status),
          turnover:turnovers(
            id, turnover_number, title,
            project:projects(id, name, code)
          ),
          artist:artists(id, name)
        `)
        .eq("vendor_id", selectedVendor)
        .order("assigned_at", { ascending: false });

      if (shotsData) {
        // Get latest versions for each shot
        const shotIds = shotsData.map((s: any) => s.shot_id);
        const { data: versionsData } = await supabase
          .from("shot_versions")
          .select("id, shot_id, version_code, status, created_at")
          .in("shot_id", shotIds)
          .order("version_number", { ascending: false });

        // Map latest version to each shot
        const shotsWithVersions = shotsData.map((shot: any) => {
          const versions = (versionsData || []).filter((v: any) => v.shot_id === shot.shot_id);
          return {
            ...shot,
            latest_version: versions[0] || null,
          };
        });

        setShots(shotsWithVersions);
      }

      // Get artists for this vendor
      const { data: artistsData } = await supabase
        .from("artists")
        .select("id, vendor_id, name, role")
        .eq("vendor_id", selectedVendor)
        .eq("active", true)
        .order("name");

      setArtists((artistsData || []) as Artist[]);
    }

    loadVendorShots();
  }, [selectedVendor]);

  const updateArtistAssignment = async (turnoverShotId: string, artistId: string | null) => {
    if (!supabase) return;

    await (supabase as any)
      .from("turnover_shots")
      .update({ artist_id: artistId || null })
      .eq("id", turnoverShotId);

    // Update local state
    setShots(prev => prev.map(s => 
      s.id === turnoverShotId ? { ...s, artist_id: artistId } : s
    ));
  };

  const filteredShots = shots.filter(s => {
    if (statusFilter === "all") return true;
    return s.shot?.status === statusFilter;
  });

  const statusCounts = {
    all: shots.length,
    NOT_STARTED: shots.filter(s => s.shot?.status === 'NOT_STARTED').length,
    IN_PROGRESS: shots.filter(s => s.shot?.status === 'IN_PROGRESS').length,
    CLIENT_REVIEW: shots.filter(s => s.shot?.status === 'CLIENT_REVIEW').length,
    APPROVED: shots.filter(s => s.shot?.status === 'APPROVED').length,
  };

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
          <h1 className="text-3xl font-bold tracking-tight">Vendor Portal</h1>
          <p className="text-muted-foreground mt-1">View and manage assigned shots</p>
        </div>
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <Select value={selectedVendor} onValueChange={setSelectedVendor}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select vendor" />
            </SelectTrigger>
            <SelectContent>
              {vendors.map(v => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name} {v.code && `(${v.code})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{shots.length}</p>
            <p className="text-xs text-muted-foreground">Total Assigned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-blue-500">{statusCounts.IN_PROGRESS}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-500">{statusCounts.CLIENT_REVIEW}</p>
            <p className="text-xs text-muted-foreground">In Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-500">{statusCounts.APPROVED}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Filter */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">
            All
            <Badge variant="secondary" className="ml-1">{statusCounts.all}</Badge>
          </TabsTrigger>
          <TabsTrigger value="NOT_STARTED">Not Started</TabsTrigger>
          <TabsTrigger value="IN_PROGRESS">In Progress</TabsTrigger>
          <TabsTrigger value="CLIENT_REVIEW">In Review</TabsTrigger>
          <TabsTrigger value="APPROVED">Approved</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Shots List */}
      {filteredShots.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Film className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No shots assigned to this vendor</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredShots.map(shot => {
            const statusConfig = STATUS_CONFIG[shot.shot?.status || 'NOT_STARTED'] || STATUS_CONFIG.NOT_STARTED;
            
            return (
              <Card key={shot.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Shot code and status */}
                    <div className="w-40">
                      <Link href={`/shots/${shot.shot_id}`}>
                        <span className="font-mono font-bold hover:underline">{shot.shot?.code}</span>
                      </Link>
                      <Badge className={cn("ml-2 text-[10px] text-white", statusConfig.color)}>
                        {statusConfig.label}
                      </Badge>
                    </div>

                    {/* Project/Turnover */}
                    <div className="flex-1">
                      <p className="text-sm">{shot.turnover?.project?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        TO{shot.turnover?.turnover_number} • {shot.turnover?.title}
                      </p>
                    </div>

                    {/* VFX Notes */}
                    <div className="flex-1 max-w-xs">
                      {shot.vfx_notes ? (
                        <p className="text-sm text-muted-foreground truncate">{shot.vfx_notes}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground/50 italic">No notes</p>
                      )}
                    </div>

                    {/* Latest Version */}
                    <div className="w-24">
                      {shot.latest_version ? (
                        <Badge variant="outline">
                          {shot.latest_version.version_code}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          No versions
                        </Badge>
                      )}
                    </div>

                    {/* Artist Assignment */}
                    <div className="w-40">
                      <Select
                        value={shot.artist_id || "unassigned"}
                        onValueChange={(v) => updateArtistAssignment(shot.id, v === "unassigned" ? null : v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {shot.artist?.name || "Unassigned"}
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {artists.map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <Upload className="h-3 w-3 mr-1" />
                        Upload Version
                      </Button>
                      <Link href={`/shots/${shot.shot_id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
