import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const shotStatusColors: Record<string, string> = {
  NOT_STARTED: "bg-zinc-600",
  IN_PROGRESS: "bg-blue-600",
  INTERNAL_REVIEW: "bg-amber-600",
  CLIENT_REVIEW: "bg-purple-600",
  REVISIONS: "bg-red-600",
  APPROVED: "bg-green-600",
  FINAL: "bg-emerald-700",
};

export const shotStatusLabels: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  INTERNAL_REVIEW: "Internal Review",
  CLIENT_REVIEW: "Client Review",
  REVISIONS: "Revisions",
  APPROVED: "Approved",
  FINAL: "Final",
};

export const roleLabels: Record<string, string> = {
  ADMIN: "Admin",
  VFX_SUPERVISOR: "VFX Supervisor",
  POST_SUPERVISOR: "Post Supervisor",
  SUPERVISOR: "Supervisor",
  PRODUCER: "Producer",
  COORDINATOR: "Coordinator",
  ARTIST: "Artist",
  VFX_EDITOR: "VFX Editor",
  CLIENT: "Client",
  VFX_VENDOR: "VFX Vendor",
};

export const roleColors: Record<string, { color: string; bg: string }> = {
  ADMIN: { color: "text-amber-400", bg: "bg-amber-400/10" },
  VFX_SUPERVISOR: { color: "text-red-400", bg: "bg-red-400/10" },
  POST_SUPERVISOR: { color: "text-rose-400", bg: "bg-rose-400/10" },
  SUPERVISOR: { color: "text-blue-400", bg: "bg-blue-400/10" },
  PRODUCER: { color: "text-indigo-400", bg: "bg-indigo-400/10" },
  COORDINATOR: { color: "text-cyan-400", bg: "bg-cyan-400/10" },
  ARTIST: { color: "text-purple-400", bg: "bg-purple-400/10" },
  VFX_EDITOR: { color: "text-pink-400", bg: "bg-pink-400/10" },
  CLIENT: { color: "text-green-400", bg: "bg-green-400/10" },
  VFX_VENDOR: { color: "text-orange-400", bg: "bg-orange-400/10" },
};

export const complexityColors: Record<string, string> = {
  SIMPLE: "text-green-400",
  MEDIUM: "text-yellow-400",
  COMPLEX: "text-orange-400",
  HERO: "text-red-400",
};

export const versionStatusColors: Record<string, string> = {
  WIP: "bg-zinc-600",
  PENDING_REVIEW: "bg-amber-600",
  APPROVED: "bg-green-600",
  REVISE: "bg-red-600",
  CBB: "bg-purple-600",
};

export function formatShotCode(sequenceCode: string, shotNumber: number): string {
  return `${sequenceCode}_${String(shotNumber).padStart(4, '0')}`;
}
