"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Film,
  Loader2,
  Building2,
  Upload,
  Clock,
  CheckCircle2,
  ExternalLink,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { VendorVersionUpload } from "@/components/vendor-version-upload";
import { VersionTimeline } from "@/components/version-timeline";

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
  versions: VersionEntry[];
}

interface VersionEntry {
  id: string;
  shot_id: string;
  version_number: number;
  version_code: string;
  status: string;
  description: string | null;
  created_at: string;
  preview_url: string | null;
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
  const [expandedShotId, setExpandedShotId] = useState<string | null>(null);

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
  const loadVendorShots = useCallback(async () => {
    if (!supabase || !selectedVendor) return;

    // Get assigned shots
    const { data: shotsData } = await (supabase as any)
      .from("turnover_shots")
      .select(
        `
        id, shot_id, vendor_id, artist_id, vfx_notes, assigned_at,
        shot:shots(id, code, description, status),
        turnover:turnovers(
          id, turnover_number, title,
          project:projects(id, name, code)
        ),
        artist:artists(id, name)
      `
      )
      .eq("vendor_id", selectedVendor)
      .order("assigned_at", { ascending: false });

    if (shotsData) {
      // Get all versions for these shots
      const shotIds = shotsData.map((s: any) => s.shot_id);

      let allVersions: VersionEntry[] = [];

      if (shotIds.length > 0) {
        // Try shot_versions first
        const { data: versionsData } = await (supabase as any)
          .from("shot_versions")
          .select(
            "id, shot_id, version_number, version_code, status, description, created_at, preview_url"
          )
          .in("shot_id", shotIds)
          .order("version_number", { ascending: false });

        if (versionsData && versionsData.length > 0) {
          allVersions = versionsData as VersionEntry[];
        } else {
          // Fallback to versions table
          const { data: fallbackVersions } = await supabase
            .from("versions")
            .select(
              "id, shot_id, version_number, status, description, created_at, preview_url"
            )
            .in("shot_id", shotIds)
            .order("version_number", { ascending: false });

          allVersions = ((fallbackVersions || []) as any[]).map((v) => ({
            ...v,
            version_code: `v${String(v.version_number).padStart(3, "0")}`,
          }));
        }
      }

      // Map versions to each shot
      const shotsWithVersions: VendorShot[] = shotsData.map((shot: any) => ({
        ...shot,
        versions: allVersions.filter((v) => v.shot_id === shot.shot_id),
      }));

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
  }, [selectedVendor]);

  useEffect(() => {
    loadVendorShots();
  }, [loadVendorShots]);

  const updateArtistAssignment = async (
    turnoverShotId: string,
    artistId: string | null
  ) => {
    if (!supabase) return;

    await (supabase as any)
      .from("turnover_shots")
      .update({ artist_id: artistId || null })
      .eq("id", turnoverShotId);

    // Update local state
    setShots((prev) =>
      prev.map((s) =>
        s.id === turnoverShotId ? { ...s, artist_id: artistId } : s
      )
    );
  };

  const handleVersionUploaded = (shotId: string, version: any) => {
    // Add version to local state
    setShots((prev) =>
      prev.map((s) => {
        if (s.shot_id === shotId) {
          return {
            ...s,
            versions: [
              {
                id: version.id,
                shot_id: shotId,
                version_number: version.version_number,
                version_code:
                  version.version_code ||
                  `v${String(version.version_number).padStart(3, "0")}`,
                status: version.status || "INTERNAL_REVIEW",
                description: version.description,
                created_at: version.created_at || new Date().toISOString(),
                preview_url: version.preview_url,
              },
              ...s.versions,
            ],
          };
        }
        return s;
      })
    );
  };

  const filteredShots = shots.filter((s) => {
    if (statusFilter === "all") return true;
    return s.shot?.status === statusFilter;
  });

  const statusCounts = {
    all: shots.length,
    NOT_STARTED: shots.filter((s) => s.shot?.status === "NOT_STARTED").length,
    IN_PROGRESS: shots.filter((s) => s.shot?.status === "IN_PROGRESS").length,
    INTERNAL_REVIEW: shots.filter(
      (s) => s.shot?.status === "INTERNAL_REVIEW"
    ).length,
    CLIENT_REVIEW: shots.filter(
      (s) => s.shot?.status === "CLIENT_REVIEW"
    ).length,
    APPROVED: shots.filter((s) => s.shot?.status === "APPROVED").length,
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
          <p className="text-muted-foreground mt-1">
            View assigned shots, upload versions, and track progress
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <Select value={selectedVendor} onValueChange={setSelectedVendor}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select vendor" />
            </SelectTrigger>
            <SelectContent>
              {vendors.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name} {v.code && `(${v.code})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{shots.length}</p>
            <p className="text-xs text-muted-foreground">Total Assigned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-gray-400">
              {statusCounts.NOT_STARTED}
            </p>
            <p className="text-xs text-muted-foreground">Not Started</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-blue-500">
              {statusCounts.IN_PROGRESS}
            </p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-500">
              {statusCounts.CLIENT_REVIEW + statusCounts.INTERNAL_REVIEW}
            </p>
            <p className="text-xs text-muted-foreground">In Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-500">
              {statusCounts.APPROVED}
            </p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Filter */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">
            All
            <Badge variant="secondary" className="ml-1">
              {statusCounts.all}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="NOT_STARTED">Not Started</TabsTrigger>
          <TabsTrigger value="IN_PROGRESS">In Progress</TabsTrigger>
          <TabsTrigger value="INTERNAL_REVIEW">Internal Review</TabsTrigger>
          <TabsTrigger value="CLIENT_REVIEW">Client Review</TabsTrigger>
          <TabsTrigger value="APPROVED">Approved</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Shots List */}
      {filteredShots.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Film className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">
              No shots assigned to this vendor
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredShots.map((shot) => {
            const statusConfig =
              STATUS_CONFIG[shot.shot?.status || "NOT_STARTED"] ||
              STATUS_CONFIG.NOT_STARTED;
            const isExpanded = expandedShotId === shot.id;
            const latestVersion = shot.versions[0];
            const nextVersionNumber =
              shot.versions.length > 0
                ? Math.max(...shot.versions.map((v) => v.version_number)) + 1
                : 1;

            return (
              <Card key={shot.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Shot code and status */}
                    <div className="w-36">
                      <Link href={`/shots/${shot.shot_id}`}>
                        <span className="font-mono font-bold hover:underline">
                          {shot.shot?.code}
                        </span>
                      </Link>
                      <div className="mt-1">
                        <Badge
                          className={cn(
                            "text-[10px] text-white",
                            statusConfig.color
                          )}
                        >
                          {statusConfig.label}
                        </Badge>
                      </div>
                    </div>

                    {/* Project/Turnover */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        {shot.turnover?.project?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        TO{shot.turnover?.turnover_number} •{" "}
                        {shot.turnover?.title}
                      </p>
                    </div>

                    {/* VFX Notes (truncated) */}
                    <div className="flex-1 max-w-xs hidden lg:block">
                      {shot.vfx_notes ? (
                        <p className="text-sm text-muted-foreground truncate">
                          {shot.vfx_notes}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground/50 italic">
                          No notes
                        </p>
                      )}
                    </div>

                    {/* Latest Version */}
                    <div className="w-24">
                      {latestVersion ? (
                        <Badge variant="outline">
                          {latestVersion.version_code}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground"
                        >
                          No versions
                        </Badge>
                      )}
                    </div>

                    {/* Artist Assignment */}
                    <div className="w-40">
                      <Select
                        value={shot.artist_id || "unassigned"}
                        onValueChange={(v) =>
                          updateArtistAssignment(
                            shot.id,
                            v === "unassigned" ? null : v
                          )
                        }
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
                          <SelectItem value="unassigned">
                            Unassigned
                          </SelectItem>
                          {artists.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <VendorVersionUpload
                        shotId={shot.shot_id}
                        shotCode={shot.shot?.code || ""}
                        vfxNotes={shot.vfx_notes}
                        nextVersionNumber={nextVersionNumber}
                        onUploadComplete={(version) =>
                          handleVersionUploaded(shot.shot_id, version)
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedShotId(isExpanded ? null : shot.id)
                        }
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      <Link href={`/shots/${shot.shot_id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {/* Expanded: VFX Notes + Version Timeline */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-6">
                      {/* Shot Details */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium">Shot Details</h4>
                        {shot.shot?.description && (
                          <p className="text-sm text-muted-foreground">
                            {shot.shot.description}
                          </p>
                        )}
                        {shot.vfx_notes && (
                          <div className="bg-muted/50 rounded-lg p-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              VFX Notes
                            </p>
                            <p className="text-sm">{shot.vfx_notes}</p>
                          </div>
                        )}
                      </div>

                      {/* Version History */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">
                            Version History ({shot.versions.length})
                          </h4>
                          <VendorVersionUpload
                            shotId={shot.shot_id}
                            shotCode={shot.shot?.code || ""}
                            vfxNotes={shot.vfx_notes}
                            nextVersionNumber={nextVersionNumber}
                            onUploadComplete={(version) =>
                              handleVersionUploaded(shot.shot_id, version)
                            }
                            trigger={
                              <Button size="sm" variant="outline" className="h-7">
                                <Upload className="h-3 w-3 mr-1" />
                                New Version
                              </Button>
                            }
                          />
                        </div>
                        <VersionTimeline versions={shot.versions} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
