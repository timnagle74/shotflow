"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import {
  Eye, Loader2, CheckCircle2, Clock, MessageSquare,
  Film, ExternalLink, AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { cn, shotStatusLabels, shotStatusColors, versionStatusColors } from "@/lib/utils";

interface VersionForReview {
  id: string;
  shot_id: string;
  version_number: number;
  version_code: string;
  status: string;
  description: string | null;
  created_at: string;
  created_by_id: string;
  shot: {
    id: string;
    code: string;
    status: string;
    description: string | null;
    sequence: {
      code: string;
      project: {
        name: string;
        code: string;
      };
    };
  };
}

const VERSION_STATUS_LABELS: Record<string, string> = {
  WIP: "Work in Progress",
  PENDING_REVIEW: "Pending Review",
  APPROVED: "Approved",
  REVISE: "Needs Revision",
  CBB: "Could Be Better",
};

export default function ReviewsPage() {
  const [versions, setVersions] = useState<VersionForReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");

  useEffect(() => {
    async function loadVersions() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        // Load shot_versions first, then fall back to versions table
        const { data, error } = await (supabase as any)
          .from("shot_versions")
          .select(`
            id, shot_id, version_number, version_code, status, description, created_at, created_by_id,
            shot:shots(
              id, code, status, description,
              sequence:sequences(
                code,
                project:projects(name, code)
              )
            )
          `)
          .order("created_at", { ascending: false })
          .limit(100);

        if (!error && data) {
          setVersions(data as VersionForReview[]);
        } else {
          // Fall back to versions table
          const { data: fallbackData } = await supabase
            .from("versions")
            .select(`
              id, shot_id, version_number, status, description, created_at, created_by_id
            `)
            .order("created_at", { ascending: false })
            .limit(100);

          if (fallbackData) {
            // Map to common format
            setVersions(fallbackData.map((v: any) => ({
              ...v,
              version_code: `v${String(v.version_number).padStart(3, '0')}`,
              shot: null,
            })));
          }
        }
      } catch (err) {
        console.error("Failed to load versions:", err);
      } finally {
        setLoading(false);
      }
    }

    loadVersions();
  }, []);

  const filteredVersions = versions.filter((v) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "pending") return v.status === "PENDING_REVIEW" || v.status === "INTERNAL_REVIEW";
    if (statusFilter === "approved") return v.status === "APPROVED";
    if (statusFilter === "revise") return v.status === "REVISE" || v.status === "CBB";
    return v.status === statusFilter;
  });

  const pendingCount = versions.filter(
    (v) => v.status === "PENDING_REVIEW" || v.status === "INTERNAL_REVIEW"
  ).length;

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
          <h1 className="text-3xl font-bold tracking-tight">Reviews</h1>
          <p className="text-muted-foreground mt-1">
            Review and approve shot versions
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="destructive" className="text-sm px-3 py-1">
            {pendingCount} pending review
          </Badge>
        )}
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">
            All
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {versions.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="pending">
            <Clock className="h-3 w-3 mr-1" />
            Pending
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Approved
          </TabsTrigger>
          <TabsTrigger value="revise">
            <AlertCircle className="h-3 w-3 mr-1" />
            Needs Revision
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredVersions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Eye className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">
              {statusFilter === "pending"
                ? "No versions pending review"
                : "No versions found"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredVersions.map((version) => {
            const statusColor =
              versionStatusColors[version.status] || "bg-zinc-600";
            const statusLabel =
              VERSION_STATUS_LABELS[version.status] || version.status;

            return (
              <Card key={version.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-32">
                      <p className="font-mono font-bold text-sm">
                        {version.shot?.code || "—"}
                      </p>
                      <Badge
                        className={cn(
                          "text-[10px] text-white mt-1",
                          statusColor
                        )}
                      >
                        {statusLabel}
                      </Badge>
                    </div>

                    <div className="w-20">
                      <Badge variant="outline" className="font-mono">
                        {version.version_code ||
                          `v${String(version.version_number).padStart(3, "0")}`}
                      </Badge>
                    </div>

                    <div className="flex-1">
                      {version.shot?.sequence && (
                        <p className="text-sm text-muted-foreground">
                          {version.shot.sequence.project?.name} •{" "}
                          {version.shot.sequence.code}
                        </p>
                      )}
                      {version.description && (
                        <p className="text-sm truncate max-w-md">
                          {version.description}
                        </p>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {new Date(version.created_at).toLocaleDateString()}
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/shots/${version.shot_id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-3 w-3 mr-1" />
                          Review
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
