import { Badge } from "@/components/ui/badge";
import { cn, shotStatusColors, shotStatusLabels, versionStatusColors } from "@/lib/utils";

export function ShotStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("text-white border-0", shotStatusColors[status] || "bg-zinc-600")}>
      {shotStatusLabels[status] || status}
    </Badge>
  );
}

export function VersionStatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    WIP: "WIP",
    PENDING_REVIEW: "Pending Review",
    APPROVED: "Approved",
    REVISE: "Revise",
    CBB: "CBB",
  };
  return (
    <Badge className={cn("text-white border-0", versionStatusColors[status] || "bg-zinc-600")}>
      {labels[status] || status}
    </Badge>
  );
}
