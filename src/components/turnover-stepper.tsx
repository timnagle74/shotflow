"use client";

import { cn } from "@/lib/utils";
import { Check, Upload, Eye, Building2, Clapperboard } from "lucide-react";

interface TurnoverStepperProps {
  currentStep: "import" | "review" | "assign" | "production";
  className?: string;
}

const steps = [
  { key: "import", label: "Import", icon: Upload },
  { key: "review", label: "Review", icon: Eye },
  { key: "assign", label: "Assign", icon: Building2 },
  { key: "production", label: "Production", icon: Clapperboard },
] as const;

const stepOrder = { import: 0, review: 1, assign: 2, production: 3 };

export function TurnoverStepper({ currentStep, className }: TurnoverStepperProps) {
  const currentIndex = stepOrder[currentStep];

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {steps.map((step, i) => {
        const isComplete = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isFuture = i > currentIndex;
        const StepIcon = step.icon;

        return (
          <div key={step.key} className="flex items-center">
            {/* Step circle + label */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                  isComplete && "border-green-500 bg-green-500/20 text-green-400",
                  isCurrent && "border-primary bg-primary/20 text-primary",
                  isFuture && "border-muted-foreground/30 bg-transparent text-muted-foreground/40"
                )}
              >
                {isComplete ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <StepIcon className="h-3.5 w-3.5" />
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  isComplete && "text-green-400",
                  isCurrent && "text-primary",
                  isFuture && "text-muted-foreground/40"
                )}
              >
                {step.label}
                {isComplete && " ✓"}
              </span>
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "mx-3 h-px w-8 transition-colors",
                  i < currentIndex ? "bg-green-500/50" : "bg-muted-foreground/20"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
