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
  APPROVED: "bg-green-600",
  FINAL: "bg-emerald-700",
};

export const shotStatusLabels: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  INTERNAL_REVIEW: "Internal Review",
  CLIENT_REVIEW: "Client Review",
  APPROVED: "Approved",
  FINAL: "Final",
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
