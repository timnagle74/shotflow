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
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  ArrowLeft,
  FolderOpen,
  AlertCircle,
  Plus,
  Users,
  Mail,
  Paintbrush,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";
import { VendorVersionUpload } from "@/components/vendor-version-upload";
import { VersionTimeline } from "@/components/version-timeline";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Vendor {
  id: string;
  name: string;
  code: string | null;
  project_id: string;
}

interface ProjectSummary {
  id: string;
  name: string;
  code: string;
  shotCount: number;
  statusBreakdown: {
    NOT_STARTED: number;
    IN_PROGRESS: number;
    REVIEW: number;
    APPROVED: number;
  };
}

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

interface Artist {
  id: string;
  vendor_id: string;
  name: string;
  role: string | null;
}

interface AppUser {
  id: string;
  role: string;
  vendor_id: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NOT_STARTED: { label: "Not Started", color: "bg-gray-500" },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-500" },
  INTERNAL_REVIEW: { label: "Internal Review", color: "bg-purple-500" },
  CLIENT_REVIEW: { label: "Client Review", color: "bg-amber-500" },
  APPROVED: { label: "Approved", color: "bg-green-500" },
  DELIVERED: { label: "Delivered", color: "bg-emerald-600" },
};

const ADMIN_ROLES = ["ADMIN", "SUPERVISOR", "PRODUCER"];

// ─── Component ───────────────────────────────────────────────────────────────

export default function VendorPortalPage() {
  const { user: authUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [userVendors, setUserVendors] = useState<Vendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [allVendors, setAllVendors] = useState<Vendor[]>([]);

  // Freelancer detection
  const [isSoloFreelancer, setIsSoloFreelancer] = useState(false);
  const [vendorUserCount, setVendorUserCount] = useState<number>(0);

  // Project-level view
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  // Shot-level view (drill-in)
  const [selectedProject, setSelectedProject] = useState<{
    id: string;
    name: string;
    code: string;
  } | null>(null);
  const [shots, setShots] = useState<VendorShot[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedShotId, setExpandedShotId] = useState<string | null>(null);
  const [loadingShots, setLoadingShots] = useState(false);

  // My Team state
  const [showMyTeam, setShowMyTeam] = useState(false);
  const [teamArtists, setTeamArtists] = useState<Artist[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [showInviteArtist, setShowInviteArtist] = useState(false);
  const [inviteArtistName, setInviteArtistName] = useState("");
  const [inviteArtistEmail, setInviteArtistEmail] = useState("");
  const [inviteArtistSpecialty, setInviteArtistSpecialty] = useState("");
  const [invitingArtist, setInvitingArtist] = useState(false);
  const [inviteArtistError, setInviteArtistError] = useState<string | null>(null);
  const [inviteArtistSuccess, setInviteArtistSuccess] = useState<string | null>(null);

  // ─── Step 1: Resolve the user's vendor(s) ──────────────────────────────

  useEffect(() => {
    async function resolveUserVendors() {
      if (!supabase || !authUser) {
        setLoading(false);
        return;
      }

      // Get the app user record
      const { data: userData } = await (supabase as any)
        .from("users")
        .select("id, role, vendor_id")
        .eq("id", authUser.id)
        .single();

      if (!userData) {
        setLoading(false);
        return;
      }

      const typedUser = userData as AppUser;
      setAppUser(typedUser);

      const admin = ADMIN_ROLES.includes(typedUser.role);
      setIsAdmin(admin);

      if (admin) {
        // Admins can see all vendors — load them all
        const { data: vendorsData } = await (supabase as any)
          .from("vendors")
          .select("id, name, code, project_id")
          .eq("active", true)
          .order("name");

        const vendors = (vendorsData || []) as Vendor[];
        setAllVendors(vendors);
        setUserVendors(vendors);
        if (vendors.length > 0) {
          setSelectedVendorId(vendors[0].id);
        }
      } else {
        // Regular user: get vendors from user_vendors junction table first
        const { data: junctionData } = await (supabase as any)
          .from("user_vendors")
          .select("vendor_id")
          .eq("user_id", typedUser.id);

        const vendorIds: string[] = [];

        // Add primary vendor_id if set
        if (typedUser.vendor_id) {
          vendorIds.push(typedUser.vendor_id);
        }

        // Add junction table vendor_ids
        if (junctionData && junctionData.length > 0) {
          for (const row of junctionData) {
            if (!vendorIds.includes(row.vendor_id)) {
              vendorIds.push(row.vendor_id);
            }
          }
        }

        if (vendorIds.length === 0) {
          setUserVendors([]);
          setLoading(false);
          return;
        }

        // Fetch full vendor records
        const { data: vendorsData } = await (supabase as any)
          .from("vendors")
          .select("id, name, code, project_id")
          .in("id", vendorIds)
          .eq("active", true)
          .order("name");

        const vendors = (vendorsData || []) as Vendor[];
        setUserVendors(vendors);
        if (vendors.length > 0) {
          setSelectedVendorId(vendors[0].id);

          // Detect solo freelancer: ARTIST role + vendor with only 1 user
          if (typedUser.role === "ARTIST" && vendors.length === 1) {
            const { count } = await (supabase as any)
              .from("user_vendors")
              .select("*", { count: "exact", head: true })
              .eq("vendor_id", vendors[0].id);

            const userCount = count || 1;
            setVendorUserCount(userCount);
            setIsSoloFreelancer(userCount <= 1);
          }
        }
      }

      setLoading(false);
    }

    resolveUserVendors();
  }, [authUser]);

  // ─── Step 2: Load projects for selected vendor ─────────────────────────

  const loadProjects = useCallback(async () => {
    if (!supabase || !selectedVendorId) return;

    // Get all turnover_shots for this vendor, grouped by project
    const { data: shotsData } = await (supabase as any)
      .from("turnover_shots")
      .select(
        `
        id, shot_id,
        shot:shots(id, status),
        turnover:turnovers(
          id,
          project:projects(id, name, code)
        )
      `
      )
      .eq("vendor_id", selectedVendorId);

    if (!shotsData || shotsData.length === 0) {
      setProjects([]);
      return;
    }

    // Group by project
    const projectMap = new Map<string, ProjectSummary>();

    for (const row of shotsData as any[]) {
      const project = row.turnover?.project;
      if (!project) continue;

      if (!projectMap.has(project.id)) {
        projectMap.set(project.id, {
          id: project.id,
          name: project.name,
          code: project.code,
          shotCount: 0,
          statusBreakdown: {
            NOT_STARTED: 0,
            IN_PROGRESS: 0,
            REVIEW: 0,
            APPROVED: 0,
          },
        });
      }

      const summary = projectMap.get(project.id)!;
      summary.shotCount++;

      const status = row.shot?.status || "NOT_STARTED";
      if (status === "NOT_STARTED") {
        summary.statusBreakdown.NOT_STARTED++;
      } else if (status === "IN_PROGRESS") {
        summary.statusBreakdown.IN_PROGRESS++;
      } else if (
        status === "INTERNAL_REVIEW" ||
        status === "CLIENT_REVIEW"
      ) {
        summary.statusBreakdown.REVIEW++;
      } else if (
        status === "APPROVED" ||
        status === "FINAL" ||
        status === "DELIVERED"
      ) {
        summary.statusBreakdown.APPROVED++;
      } else {
        // Catch-all for other statuses (REVISIONS, etc.)
        summary.statusBreakdown.IN_PROGRESS++;
      }
    }

    setProjects(Array.from(projectMap.values()));
  }, [selectedVendorId]);

  useEffect(() => {
    if (selectedVendorId && !selectedProject) {
      loadProjects();
    }
  }, [selectedVendorId, selectedProject, loadProjects]);

  // ─── Step 3: Load shots for a specific project ─────────────────────────

  const loadProjectShots = useCallback(
    async (projectId: string) => {
      if (!supabase || !selectedVendorId) return;

      setLoadingShots(true);

      // Get assigned shots for this vendor + project
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
        .eq("vendor_id", selectedVendorId)
        .order("assigned_at", { ascending: false });

      if (shotsData) {
        // Filter to only this project's shots
        const projectShots = (shotsData as any[]).filter(
          (s: any) => s.turnover?.project?.id === projectId
        );

        // Get versions for these shots
        const shotIds = projectShots.map((s: any) => s.shot_id);
        let allVersions: VersionEntry[] = [];

        if (shotIds.length > 0) {
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

        const shotsWithVersions: VendorShot[] = projectShots.map(
          (shot: any) => ({
            ...shot,
            versions: allVersions.filter((v) => v.shot_id === shot.shot_id),
          })
        );

        setShots(shotsWithVersions);
      }

      // Get artists for this vendor
      const { data: artistsData } = await supabase
        .from("artists")
        .select("id, vendor_id, name, role")
        .eq("vendor_id", selectedVendorId)
        .eq("active", true)
        .order("name");

      setArtists((artistsData || []) as Artist[]);
      setLoadingShots(false);
    },
    [selectedVendorId]
  );

  // ─── My Team: load artists for this vendor ──────────────────────────────

  const loadTeamArtists = useCallback(async () => {
    if (!supabase || !selectedVendorId) return;
    setLoadingTeam(true);

    const { data: artistsData } = await (supabase as any)
      .from("artists")
      .select("id, vendor_id, name, role")
      .eq("vendor_id", selectedVendorId)
      .eq("active", true)
      .order("name");

    setTeamArtists((artistsData || []) as Artist[]);
    setLoadingTeam(false);
  }, [selectedVendorId]);

  useEffect(() => {
    if (selectedVendorId && showMyTeam) {
      loadTeamArtists();
    }
  }, [selectedVendorId, showMyTeam, loadTeamArtists]);

  const handleInviteArtist = useCallback(async () => {
    if (!selectedVendorId) return;
    setInvitingArtist(true);
    setInviteArtistError(null);
    setInviteArtistSuccess(null);

    try {
      const res = await fetch(`/api/vendors/${selectedVendorId}/artists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteArtistName,
          email: inviteArtistEmail,
          specialty: inviteArtistSpecialty || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setInviteArtistError(data.error || "Failed to invite artist");
        return;
      }

      setInviteArtistSuccess(data.message || "Artist invited!");
      setInviteArtistName("");
      setInviteArtistEmail("");
      setInviteArtistSpecialty("");

      // Reload team
      await loadTeamArtists();

      setTimeout(() => {
        setShowInviteArtist(false);
        setInviteArtistSuccess(null);
      }, 1500);
    } catch (err) {
      setInviteArtistError("Failed to invite artist");
    } finally {
      setInvitingArtist(false);
    }
  }, [selectedVendorId, inviteArtistName, inviteArtistEmail, inviteArtistSpecialty, loadTeamArtists]);

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleProjectClick = (project: ProjectSummary) => {
    setSelectedProject({ id: project.id, name: project.name, code: project.code });
    setStatusFilter("all");
    setExpandedShotId(null);
    loadProjectShots(project.id);
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    setShots([]);
    setArtists([]);
    setStatusFilter("all");
    setExpandedShotId(null);
  };

  const handleVendorChange = (vendorId: string) => {
    setSelectedVendorId(vendorId);
    setSelectedProject(null);
    setShots([]);
    setArtists([]);
    setProjects([]);
    setStatusFilter("all");
    setExpandedShotId(null);
    setShowMyTeam(false);
    setTeamArtists([]);
    setIsSoloFreelancer(false);
    setVendorUserCount(0);
  };

  const updateArtistAssignment = async (
    turnoverShotId: string,
    artistId: string | null
  ) => {
    if (!supabase) return;

    await (supabase as any)
      .from("turnover_shots")
      .update({ artist_id: artistId || null })
      .eq("id", turnoverShotId);

    setShots((prev) =>
      prev.map((s) =>
        s.id === turnoverShotId ? { ...s, artist_id: artistId } : s
      )
    );
  };

  const handleVersionUploaded = (shotId: string, version: any) => {
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

  // ─── Filtered shots ────────────────────────────────────────────────────

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

  // ─── Loading state ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ─── No vendor association ─────────────────────────────────────────────

  if (!isAdmin && userVendors.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendor Portal</h1>
          <p className="text-muted-foreground mt-1">
            View assigned shots, upload versions, and track progress
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium mb-2">
              No vendor account linked
            </p>
            <p className="text-muted-foreground text-sm">
              Your user account is not associated with any vendor. Contact your
              admin to get set up.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Current vendor name for display ───────────────────────────────────

  const currentVendor = userVendors.find((v) => v.id === selectedVendorId);
  const showVendorSwitcher = userVendors.length > 1;

  // Permissions: only VFX_VENDOR and admins can invite artists
  const canInviteArtists = isAdmin || appUser?.role === "VFX_VENDOR";

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {selectedProject ? (
            <>
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <button
                  onClick={handleBackToProjects}
                  className="hover:text-foreground transition-colors"
                >
                  {isSoloFreelancer ? "My Projects" : "Vendor Portal"}
                </button>
                <span>/</span>
                <span className="text-foreground">
                  {selectedProject.name} ({selectedProject.code})
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBackToProjects}
                  className="h-8 w-8"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    {selectedProject.name}
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    {isSoloFreelancer
                      ? "Your assigned shots"
                      : `Shots assigned to ${currentVendor?.name || "your vendor"}`}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold tracking-tight">
                {isSoloFreelancer
                  ? "My Projects"
                  : currentVendor && !isAdmin
                    ? `${currentVendor.name} — Projects`
                    : "Vendor Portal"}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isSoloFreelancer
                  ? "View your projects and assigned shots"
                  : currentVendor
                    ? `${currentVendor.name} — View your projects and assigned shots`
                    : "View assigned shots, upload versions, and track progress"}
              </p>
            </>
          )}
        </div>

        {/* Vendor switcher + My Team button */}
        <div className="flex items-center gap-3">
          {/* My Team toggle - only on projects level, hidden for solo freelancers */}
          {!selectedProject && canInviteArtists && selectedVendorId && !isSoloFreelancer && (
            <Button
              variant={showMyTeam ? "default" : "outline"}
              onClick={() => setShowMyTeam(!showMyTeam)}
            >
              <Users className="h-4 w-4 mr-2" />
              My Team
            </Button>
          )}
          {isAdmin && allVendors.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground">View as:</span>
              <Select
                value={selectedVendorId}
                onValueChange={handleVendorChange}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {allVendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} {v.code && `(${v.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {!isAdmin && showVendorSwitcher && (
            <>
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select
                value={selectedVendorId}
                onValueChange={handleVendorChange}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {userVendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} {v.code && `(${v.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </div>

      {/* ─── My Team Section (Level 1 only, hidden for solo freelancers) ─ */}
      {!selectedProject && showMyTeam && canInviteArtists && !isSoloFreelancer && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Team Artists ({teamArtists.length})
              </CardTitle>
              <Dialog open={showInviteArtist} onOpenChange={setShowInviteArtist}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-3 w-3 mr-1" />
                    Invite Artist
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Artist</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <label className="text-sm font-medium">Name</label>
                      <Input
                        placeholder="Full name"
                        className="mt-1.5"
                        value={inviteArtistName}
                        onChange={(e) => setInviteArtistName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Email</label>
                      <Input
                        placeholder="artist@example.com"
                        className="mt-1.5"
                        value={inviteArtistEmail}
                        onChange={(e) => setInviteArtistEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Role / Specialty</label>
                      <Input
                        placeholder="e.g. Compositor, Animator, Modeler"
                        className="mt-1.5"
                        value={inviteArtistSpecialty}
                        onChange={(e) => setInviteArtistSpecialty(e.target.value)}
                      />
                    </div>
                    {inviteArtistError && (
                      <div className="flex items-center gap-2 text-red-400 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        {inviteArtistError}
                      </div>
                    )}
                    {inviteArtistSuccess && (
                      <div className="flex items-center gap-2 text-green-400 text-sm">
                        <CheckCircle2 className="h-4 w-4" />
                        {inviteArtistSuccess}
                      </div>
                    )}
                    <Button
                      className="w-full"
                      onClick={handleInviteArtist}
                      disabled={invitingArtist || !inviteArtistName || !inviteArtistEmail}
                    >
                      {invitingArtist ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4 mr-2" />
                      )}
                      Send Invite
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {loadingTeam ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : teamArtists.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Paintbrush className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No artists yet. Invite your first team member!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {teamArtists.map((artist) => (
                  <div
                    key={artist.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-purple-400/10 text-purple-400 text-xs">
                        {artist.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {artist.name}
                      </p>
                      {artist.role && (
                        <p className="text-xs text-muted-foreground truncate">
                          {artist.role}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Level 1: Projects View ────────────────────────────────────── */}
      {!selectedProject && (
        <>
          {projects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FolderOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">
                  No projects with assigned shots
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => handleProjectClick(project)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <Badge variant="outline" className="font-mono text-xs">
                        {project.code}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Assigned Shots
                        </span>
                        <span className="text-2xl font-bold">
                          {project.shotCount}
                        </span>
                      </div>

                      {/* Status breakdown bar */}
                      {project.shotCount > 0 && (
                        <div className="space-y-2">
                          <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                            {project.statusBreakdown.NOT_STARTED > 0 && (
                              <div
                                className="bg-gray-400"
                                style={{
                                  width: `${(project.statusBreakdown.NOT_STARTED / project.shotCount) * 100}%`,
                                }}
                              />
                            )}
                            {project.statusBreakdown.IN_PROGRESS > 0 && (
                              <div
                                className="bg-blue-500"
                                style={{
                                  width: `${(project.statusBreakdown.IN_PROGRESS / project.shotCount) * 100}%`,
                                }}
                              />
                            )}
                            {project.statusBreakdown.REVIEW > 0 && (
                              <div
                                className="bg-amber-500"
                                style={{
                                  width: `${(project.statusBreakdown.REVIEW / project.shotCount) * 100}%`,
                                }}
                              />
                            )}
                            {project.statusBreakdown.APPROVED > 0 && (
                              <div
                                className="bg-green-500"
                                style={{
                                  width: `${(project.statusBreakdown.APPROVED / project.shotCount) * 100}%`,
                                }}
                              />
                            )}
                          </div>
                          <div className="grid grid-cols-4 gap-1 text-[10px] text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-gray-400" />
                              {project.statusBreakdown.NOT_STARTED} New
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                              {project.statusBreakdown.IN_PROGRESS} WIP
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-amber-500" />
                              {project.statusBreakdown.REVIEW} Review
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              {project.statusBreakdown.APPROVED} Done
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Level 2: Shots View (within a project) ────────────────────── */}
      {selectedProject && (
        <>
          {loadingShots ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-5 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold">{shots.length}</p>
                    <p className="text-xs text-muted-foreground">
                      Total Assigned
                    </p>
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
                      {statusCounts.CLIENT_REVIEW +
                        statusCounts.INTERNAL_REVIEW}
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
                  <TabsTrigger value="INTERNAL_REVIEW">
                    Internal Review
                  </TabsTrigger>
                  <TabsTrigger value="CLIENT_REVIEW">
                    Client Review
                  </TabsTrigger>
                  <TabsTrigger value="APPROVED">Approved</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Shots List */}
              {filteredShots.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Film className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">
                      No shots match the current filter
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
                        ? Math.max(
                            ...shot.versions.map((v) => v.version_number)
                          ) + 1
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

                            {/* Turnover */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">
                                TO{shot.turnover?.turnover_number}
                                {shot.turnover?.title &&
                                  ` • ${shot.turnover.title}`}
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
                                  setExpandedShotId(
                                    isExpanded ? null : shot.id
                                  )
                                }
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                              <Link href={`/shots/${shot.shot_id}`}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                >
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
                                <h4 className="text-sm font-medium">
                                  Shot Details
                                </h4>
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
                                      handleVersionUploaded(
                                        shot.shot_id,
                                        version
                                      )
                                    }
                                    trigger={
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7"
                                      >
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
            </>
          )}
        </>
      )}
    </div>
  );
}
