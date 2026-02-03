"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Film,
  MessageSquare,
} from "lucide-react";

interface VersionEntry {
  id: string;
  version_number: number;
  version_code: string;
  status: string;
  description: string | null;
  created_at: string;
  preview_url: string | null;
}

interface VersionTimelineProps {
  versions: VersionEntry[];
  className?: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof Clock }
> = {
  WIP: { label: "Work in Progress", color: "text-zinc-400", icon: Clock },
  PENDING_REVIEW: {
    label: "Pending Review",
    color: "text-amber-400",
    icon: Eye,
  },
  INTERNAL_REVIEW: {
    label: "Internal Review",
    color: "text-purple-400",
    icon: Eye,
  },
  CLIENT_REVIEW: {
    label: "Client Review",
    color: "text-blue-400",
    icon: Eye,
  },
  APPROVED: {
    label: "Approved",
    color: "text-green-400",
    icon: CheckCircle2,
  },
  REVISE: {
    label: "Needs Revision",
    color: "text-red-400",
    icon: AlertCircle,
  },
  CBB: {
    label: "Could Be Better",
    color: "text-amber-400",
    icon: AlertCircle,
  },
};

export function VersionTimeline({
  versions,
  className,
}: VersionTimelineProps) {
  if (versions.length === 0) {
    return (
      <div className={cn("text-center py-6", className)}>
        <Film className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">No versions yet</p>
      </div>
    );
  }

  // Sort newest first
  const sorted = [...versions].sort(
    (a, b) => b.version_number - a.version_number
  );

  return (
    <div className={cn("space-y-0", className)}>
      {sorted.map((version, i) => {
        const config = STATUS_CONFIG[version.status] || STATUS_CONFIG.WIP;
        const StatusIcon = config.icon;
        const isLatest = i === 0;
        const isLast = i === sorted.length - 1;

        return (
          <div key={version.id} className="relative flex gap-3">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-[11px] top-8 bottom-0 w-px bg-border" />
            )}

            {/* Dot */}
            <div
              className={cn(
                "mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                isLatest
                  ? "border-primary bg-primary/20"
                  : "border-muted-foreground/30 bg-background"
              )}
            >
              <StatusIcon
                className={cn(
                  "h-3 w-3",
                  isLatest ? "text-primary" : config.color
                )}
              />
            </div>

            {/* Content */}
            <div
              className={cn(
                "flex-1 pb-4 min-w-0",
                isLatest && "pb-4"
              )}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn(
                    "font-mono text-xs",
                    isLatest && "border-primary/50 text-primary"
                  )}
                >
                  {version.version_code ||
                    `v${String(version.version_number).padStart(3, "0")}`}
                </Badge>
                <Badge
                  variant="secondary"
                  className={cn("text-[10px]", config.color)}
                >
                  {config.label}
                </Badge>
                {isLatest && (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-primary border-primary/30"
                  >
                    Latest
                  </Badge>
                )}
              </div>

              {version.description && (
                <p className="text-sm text-muted-foreground mt-1 flex items-start gap-1">
                  <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                  {version.description}
                </p>
              )}

              <p className="text-xs text-muted-foreground/60 mt-1">
                {new Date(version.created_at).toLocaleDateString()} at{" "}
                {new Date(version.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>

              {version.preview_url && (
                <a
                  href={version.preview_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline mt-1 inline-block"
                >
                  View render →
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
