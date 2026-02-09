"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Film,
  Video,
  ArrowLeft,
  Clock,
  FileText,
  FolderOpen,
  MessageSquare,
  AlertCircle,
  Play,
  Download,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";

interface TurnoverShot {
  id: string;
  shot_id: string;
  vfx_notes: string | null;
  source_in: string | null;
  source_out: string | null;
  record_in: string | null;
  record_out: string | null;
  duration_frames: number | null;
  clip_name: string | null;
  reel_name: string | null;
  sort_order: number;
  vendor_id: string | null;
  shot: {
    id: string;
    code: string;
    description: string | null;
    status: string;
  };
}

interface TurnoverRef {
  id: string;
  filename: string;
  cdn_url: string | null;
  preview_url: string | null;
  assigned_shot_ids: string[];
}

interface ShotPlate {
  id: string;
  shot_id: string;
  filename: string;
  cdn_url: string | null;
  preview_url: string | null;
}

interface Turnover {
  id: string;
  turnover_number: number;
  title: string | null;
  general_notes: string | null;
  status: string;
  project: {
    id: string;
    name: string;
    code: string;
  };
  sequence: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface BidRequest {
  id: string;
  status: string;
  deadline: string | null;
  notes: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NOT_STARTED: { label: "Not Started", color: "bg-gray-500" },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-500" },
  INTERNAL_REVIEW: { label: "Internal Review", color: "bg-purple-500" },
  CLIENT_REVIEW: { label: "Client Review", color: "bg-amber-500" },
  APPROVED: { label: "Approved", color: "bg-green-500" },
  DELIVERED: { label: "Delivered", color: "bg-emerald-600" },
};

export default function VendorTurnoverDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const turnoverId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [turnover, setTurnover] = useState<Turnover | null>(null);
  const [shots, setShots] = useState<TurnoverShot[]>([]);
  const [refs, setRefs] = useState<TurnoverRef[]>([]);
  const [plates, setPlates] = useState<ShotPlate[]>([]);
  const [expandedShot, setExpandedShot] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [bidRequest, setBidRequest] = useState<BidRequest | null>(null);

  useEffect(() => {
    async function loadData() {
      if (authLoading) return;
      if (!supabase || !turnoverId) {
        setError("Configuration error");
        setLoading(false);
        return;
      }
      if (!user) {
        setError("Please log in to view this turnover");
        setLoading(false);
        return;
      }

      try {
        // Get user's vendor_id
        const { data: userData } = await supabase
          .from("users")
          .select("id, vendor_id")
          .eq("auth_id", user.id)
          .single();

        if (!userData?.vendor_id) {
          setError("No vendor account linked");
          setLoading(false);
          return;
        }

        setVendorId(userData.vendor_id);

        // Load turnover with project and sequence
        const { data: turnoverData, error: turnoverError } = await supabase
          .from("turnovers")
          .select(`
            id, turnover_number, title, general_notes, status,
            project:projects(id, name, code),
            sequence:sequences(id, name, code)
          `)
          .eq("id", turnoverId)
          .single();

        if (turnoverError) throw turnoverError;
        setTurnover(turnoverData as any);

        // Check for bid request for this turnover + vendor
        const { data: bidRequestData } = await supabase
          .from("bid_requests")
          .select("id, status, deadline, notes")
          .eq("turnover_id", turnoverId)
          .eq("vendor_id", userData.vendor_id)
          .single();

        if (bidRequestData) {
          setBidRequest(bidRequestData);
        }

        // Load turnover shots with shot details
        const { data: shotsData, error: shotsError } = await supabase
          .from("turnover_shots")
          .select(`
            id, shot_id, vfx_notes, source_in, source_out, record_in, record_out,
            duration_frames, clip_name, reel_name, sort_order, vendor_id,
            shot:shots(id, code, description, status)
          `)
          .eq("turnover_id", turnoverId)
          .order("sort_order");

        if (shotsError) throw shotsError;
        const typedShots = (shotsData || []) as unknown as TurnoverShot[];
        setShots(typedShots);

        // Load refs with assignments
        const { data: refsData } = await supabase
          .from("turnover_refs")
          .select("id, filename, cdn_url, preview_url")
          .eq("turnover_id", turnoverId)
          .order("sort_order");

        const typedRefs = (refsData || []) as Array<{
          id: string;
          filename: string;
          cdn_url: string | null;
          preview_url: string | null;
        }>;

        // Load ref assignments
        if (typedRefs.length > 0) {
          const { data: refAssignData } = await supabase
            .from("turnover_shot_refs")
            .select("turnover_shot_id, turnover_ref_id")
            .in("turnover_ref_id", typedRefs.map((r) => r.id));

          const typedRefAssigns = (refAssignData || []) as Array<{
            turnover_shot_id: string;
            turnover_ref_id: string;
          }>;

          const refsWithAssignments: TurnoverRef[] = typedRefs.map((ref) => ({
            ...ref,
            assigned_shot_ids: typedRefAssigns
              .filter((a) => a.turnover_ref_id === ref.id)
              .map((a) => a.turnover_shot_id),
          }));
          setRefs(refsWithAssignments);
        }

        // Load plates for all shots
        const shotIds = typedShots.map((s) => s.shot_id);
        if (shotIds.length > 0) {
          const { data: platesData } = await supabase
            .from("shot_plates")
            .select("id, shot_id, filename, cdn_url, preview_url")
            .in("shot_id", shotIds)
            .order("sort_order");

          setPlates((platesData || []) as ShotPlate[]);
        }

        // Mark bid request as viewed if pending
        if (bidRequestData?.status === "pending") {
          await supabase
            .from("bid_requests")
            .update({ status: "viewed", updated_at: new Date().toISOString() })
            .eq("id", bidRequestData.id);
        }
      } catch (err: any) {
        console.error("Failed to load turnover:", err);
        setError(err?.message || "Failed to load turnover data");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [turnoverId, authLoading, user]);

  const getPlatesForShot = (shotId: string) =>
    plates.filter((p) => p.shot_id === shotId);

  const getRefsForShot = (turnoverShotId: string) =>
    refs.filter((r) => r.assigned_shot_ids?.includes(turnoverShotId));

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !turnover) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-red-400">{error || "Turnover not found"}</p>
        <Button variant="outline" onClick={() => router.push("/vendor")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Portal
        </Button>
      </div>
    );
  }

  // Calculate stats
  const totalFrames = shots.reduce((sum, s) => sum + (s.duration_frames || 0), 0);
  const assignedToMe = shots.filter((s) => s.vendor_id === vendorId).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/vendor")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <p className="text-sm text-muted-foreground">
                {turnover.project?.code} •{" "}
                {turnover.sequence?.code || "No sequence"}
              </p>
              <h1 className="text-2xl font-bold">
                TO{turnover.turnover_number}
                {turnover.title && `: ${turnover.title}`}
              </h1>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {bidRequest && (
            <Badge
              className={cn(
                bidRequest.status === "pending" && "bg-yellow-500/20 text-yellow-600",
                bidRequest.status === "viewed" && "bg-blue-500/20 text-blue-600",
                bidRequest.status === "submitted" && "bg-green-500/20 text-green-600"
              )}
            >
              Bid: {bidRequest.status}
            </Badge>
          )}
          <Badge
            variant={turnover.status === "draft" ? "secondary" : "default"}
            className="capitalize"
          >
            {turnover.status}
          </Badge>
        </div>
      </div>

      {/* Bid Request Notes */}
      {bidRequest?.notes && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notes from Producer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{bidRequest.notes}</p>
            {bidRequest.deadline && (
              <p className="text-xs text-muted-foreground mt-2">
                Deadline: {new Date(bidRequest.deadline).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Film className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-3xl font-bold">{shots.length}</p>
            <p className="text-xs text-muted-foreground">Total Shots</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Film className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-3xl font-bold text-primary">{assignedToMe}</p>
            <p className="text-xs text-muted-foreground">Assigned to You</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-3xl font-bold">{totalFrames}</p>
            <p className="text-xs text-muted-foreground">Total Frames</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Video className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-3xl font-bold">{refs.length}</p>
            <p className="text-xs text-muted-foreground">References</p>
          </CardContent>
        </Card>
      </div>

      {/* General Notes */}
      {turnover.general_notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              General Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{turnover.general_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* References Section */}
      {refs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Video className="h-4 w-4" />
              Reference Materials ({refs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {refs.map((ref) => (
                <div
                  key={ref.id}
                  className="border rounded-lg overflow-hidden hover:border-primary/50 transition-colors"
                >
                  <div className="aspect-video bg-muted relative flex items-center justify-center">
                    {ref.preview_url ? (
                      <video
                        src={ref.preview_url}
                        className="w-full h-full object-cover"
                        controls
                        muted
                        playsInline
                      />
                    ) : ref.cdn_url ? (
                      <a
                        href={ref.cdn_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center hover:bg-black/20 transition-colors"
                      >
                        <Play className="h-8 w-8 text-white drop-shadow-lg" />
                      </a>
                    ) : (
                      <Film className="h-8 w-8 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium truncate">{ref.filename}</p>
                    <div className="flex items-center justify-between mt-1">
                      {ref.assigned_shot_ids.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {ref.assigned_shot_ids.slice(0, 3).map((tsId) => {
                            const shot = shots.find((s) => s.id === tsId);
                            return shot ? (
                              <Badge
                                key={tsId}
                                variant="outline"
                                className="text-[10px] px-1 py-0"
                              >
                                {shot.shot.code}
                              </Badge>
                            ) : null;
                          })}
                          {ref.assigned_shot_ids.length > 3 && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              +{ref.assigned_shot_ids.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                      {ref.cdn_url && (
                        <a
                          href={ref.cdn_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Download className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shots List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Film className="h-5 w-5" />
          Shots ({shots.length})
        </h2>

        {shots.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Film className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No shots in this turnover</p>
            </CardContent>
          </Card>
        ) : (
          shots.map((shot) => {
            const shotPlates = getPlatesForShot(shot.shot_id);
            const shotRefs = getRefsForShot(shot.id);
            const isExpanded = expandedShot === shot.id;
            const isAssignedToMe = shot.vendor_id === vendorId;
            const statusConfig = STATUS_CONFIG[shot.shot?.status || "NOT_STARTED"] || STATUS_CONFIG.NOT_STARTED;

            return (
              <Card
                key={shot.id}
                className={cn(
                  "cursor-pointer transition-colors",
                  isExpanded && "border-primary/50",
                  isAssignedToMe && "border-l-4 border-l-primary"
                )}
                onClick={() => setExpandedShot(isExpanded ? null : shot.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Shot Code */}
                    <div className="w-28">
                      <span className="font-mono font-bold text-lg">
                        {shot.shot.code}
                      </span>
                      {shot.duration_frames && (
                        <p className="text-xs text-muted-foreground">
                          {shot.duration_frames} frames
                        </p>
                      )}
                    </div>

                    {/* Status */}
                    <Badge className={cn("text-[10px] text-white", statusConfig.color)}>
                      {statusConfig.label}
                    </Badge>

                    {/* Timecodes */}
                    <div className="flex-1 hidden md:block">
                      {shot.record_in && shot.record_out && (
                        <p className="text-xs font-mono text-muted-foreground">
                          {shot.record_in} → {shot.record_out}
                        </p>
                      )}
                      {shot.reel_name && (
                        <p className="text-xs text-muted-foreground">
                          Reel: {shot.reel_name}
                        </p>
                      )}
                    </div>

                    {/* Badges */}
                    <div className="flex gap-2">
                      {isAssignedToMe && (
                        <Badge className="bg-primary/20 text-primary text-[10px]">
                          Assigned
                        </Badge>
                      )}
                      {shotRefs.length > 0 && (
                        <Badge
                          variant="outline"
                          className="text-blue-500 border-blue-500/30"
                        >
                          <Video className="h-3 w-3 mr-1" />
                          {shotRefs.length}
                        </Badge>
                      )}
                      {shotPlates.length > 0 && (
                        <Badge
                          variant="outline"
                          className="text-purple-500 border-purple-500/30"
                        >
                          <FolderOpen className="h-3 w-3 mr-1" />
                          {shotPlates.length}
                        </Badge>
                      )}
                      {shot.vfx_notes && (
                        <Badge
                          variant="outline"
                          className="text-green-500 border-green-500/30"
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Notes
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div
                      className="mt-4 pt-4 border-t space-y-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Description */}
                      {shot.shot.description && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Description
                          </p>
                          <p className="text-sm">{shot.shot.description}</p>
                        </div>
                      )}

                      {/* VFX Notes */}
                      {shot.vfx_notes && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            VFX Notes
                          </p>
                          <p className="text-sm whitespace-pre-wrap">
                            {shot.vfx_notes}
                          </p>
                        </div>
                      )}

                      {/* Shot References */}
                      {shotRefs.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            References ({shotRefs.length})
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {shotRefs.map((ref) => (
                              <div
                                key={ref.id}
                                className="border rounded overflow-hidden"
                              >
                                <div className="aspect-video bg-muted relative flex items-center justify-center">
                                  {ref.preview_url ? (
                                    <video
                                      src={ref.preview_url}
                                      className="w-full h-full object-cover"
                                      controls
                                      muted
                                      playsInline
                                    />
                                  ) : (
                                    <Film className="h-6 w-6 text-muted-foreground/40" />
                                  )}
                                </div>
                                <div className="p-1.5 flex items-center justify-between">
                                  <p className="text-[10px] truncate flex-1">
                                    {ref.filename}
                                  </p>
                                  {ref.cdn_url && (
                                    <a
                                      href={ref.cdn_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Download className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Shot Plates */}
                      {shotPlates.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Plates ({shotPlates.length})
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {shotPlates.map((plate) => (
                              <div
                                key={plate.id}
                                className="border rounded overflow-hidden"
                              >
                                <div className="aspect-video bg-muted relative flex items-center justify-center">
                                  {plate.preview_url ? (
                                    <video
                                      src={plate.preview_url}
                                      className="w-full h-full object-cover"
                                      controls
                                      muted
                                      playsInline
                                    />
                                  ) : (
                                    <FolderOpen className="h-6 w-6 text-muted-foreground/40" />
                                  )}
                                </div>
                                <div className="p-1.5 flex items-center justify-between">
                                  <p className="text-[10px] truncate flex-1">
                                    {plate.filename}
                                  </p>
                                  {plate.cdn_url && (
                                    <a
                                      href={plate.cdn_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Download className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
