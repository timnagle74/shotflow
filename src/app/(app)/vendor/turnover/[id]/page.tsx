"use client";

import { useState, useEffect } from "react";
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
  AlertCircle,
  Play,
  Download,
  Layers,
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

interface DeliverySpec {
  handles_head: number;
  handles_tail: number;
}

export default function VendorTurnoverDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const turnoverId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [turnover, setTurnover] = useState<Turnover | null>(null);
  const [shots, setShots] = useState<TurnoverShot[]>([]);
  const [plates, setPlates] = useState<ShotPlate[]>([]);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [bidRequest, setBidRequest] = useState<BidRequest | null>(null);
  const [handles, setHandles] = useState({ head: 8, tail: 8 }); // Default 8+8

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

        // Load delivery specs for handles
        const projectId = (turnoverData as any)?.project?.id;
        if (projectId) {
          const { data: specsData } = await supabase
            .from("delivery_specs")
            .select("handles_head, handles_tail")
            .eq("project_id", projectId)
            .maybeSingle();

          if (specsData) {
            setHandles({
              head: (specsData as DeliverySpec).handles_head || 8,
              tail: (specsData as DeliverySpec).handles_tail || 8,
            });
          }
        }

        // Check for bid request for this turnover + vendor
        const { data: bidRequestData } = await supabase
          .from("bid_requests")
          .select("id, status, deadline, notes")
          .eq("turnover_id", turnoverId)
          .eq("vendor_id", userData.vendor_id)
          .maybeSingle();

        const typedBidRequest = bidRequestData as BidRequest | null;
        if (typedBidRequest) {
          setBidRequest(typedBidRequest);
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
        if (typedBidRequest?.status === "pending") {
          await (supabase as any)
            .from("bid_requests")
            .update({ status: "viewed", updated_at: new Date().toISOString() })
            .eq("id", typedBidRequest.id);
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
  const handlesPerShot = handles.head + handles.tail;
  const totalBaseFrames = shots.reduce((sum, s) => sum + (s.duration_frames || 0), 0);
  const totalHandleFrames = shots.length * handlesPerShot;
  const totalFrames = totalBaseFrames + totalHandleFrames;
  const totalShots = shots.length;

  // Get plate for a shot (first plate if multiple)
  const getPlateForShot = (shotId: string) => 
    plates.find((p) => p.shot_id === shotId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-3">
          {bidRequest?.deadline && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Bid Deadline</p>
              <p className={cn(
                "text-sm font-medium",
                new Date(bidRequest.deadline) < new Date() && "text-red-500"
              )}>
                {new Date(bidRequest.deadline).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats Bar */}
      <div className="flex items-center gap-6 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Film className="h-5 w-5 text-muted-foreground" />
          <span className="text-2xl font-bold">{totalShots}</span>
          <span className="text-muted-foreground">shots</span>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <span className="text-2xl font-bold">{totalFrames.toLocaleString()}</span>
          <span className="text-muted-foreground">frames</span>
          <span className="text-xs text-muted-foreground/70">
            (incl. {handles.head}+{handles.tail} handles)
          </span>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-muted-foreground" />
          <span className="text-2xl font-bold">{plates.length}</span>
          <span className="text-muted-foreground">plates</span>
        </div>
      </div>

      {/* Producer Notes */}
      {bidRequest?.notes && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-400">
              <FileText className="h-4 w-4" />
              Notes from Producer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{bidRequest.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* General Turnover Notes */}
      {turnover.general_notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Turnover Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{turnover.general_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Shot Grid - Plates with VFX Notes */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Shots</h2>
        
        {shots.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Film className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No shots in this turnover</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shots.map((shot) => {
              const plate = getPlateForShot(shot.shot_id);
              
              return (
                <Card key={shot.id} className="overflow-hidden">
                  {/* Plate Preview */}
                  <div className="aspect-video bg-muted relative">
                    {plate?.preview_url ? (
                      <video
                        src={plate.preview_url}
                        className="w-full h-full object-cover"
                        controls
                        muted
                        playsInline
                        poster=""
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Film className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                    
                    {/* Shot Code Overlay */}
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-black/70 text-white font-mono text-sm">
                        {shot.shot.code}
                      </Badge>
                    </div>
                    
                    {/* Frame Count Overlay */}
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="bg-black/70 text-white">
                        <Clock className="h-3 w-3 mr-1" />
                        {shot.duration_frames 
                          ? `${shot.duration_frames + handlesPerShot} fr` 
                          : "— fr"}
                      </Badge>
                    </div>

                    {/* Download Button */}
                    {plate?.cdn_url && (
                      <a
                        href={plate.cdn_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute bottom-2 right-2 p-2 rounded-full bg-black/70 hover:bg-black/90 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="h-4 w-4 text-white" />
                      </a>
                    )}
                  </div>

                  {/* Shot Info Footer */}
                  <CardContent className="p-3 space-y-2">
                    {/* Plate filename */}
                    {plate && (
                      <p className="text-xs text-muted-foreground truncate">
                        {plate.filename}
                      </p>
                    )}
                    
                    {/* VFX/Comp Notes */}
                    {shot.vfx_notes ? (
                      <div className="bg-muted/50 rounded p-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Comp Notes
                        </p>
                        <p className="text-sm line-clamp-3">{shot.vfx_notes}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/50 italic">
                        No comp notes
                      </p>
                    )}

                    {/* Timecode info if available */}
                    {shot.record_in && shot.record_out && (
                      <p className="text-[10px] font-mono text-muted-foreground">
                        TC: {shot.record_in} → {shot.record_out}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
