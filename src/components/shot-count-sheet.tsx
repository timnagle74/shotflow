"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileDown, Loader2, Calculator } from "lucide-react";
import jsPDF from "jspdf";

interface ShotCountSheetProps {
  shot: {
    code: string;
    description: string | null;
    status: string;
    complexity: string;
    frame_start: number | null;
    frame_end: number | null;
    handle_head: number | null;
    handle_tail: number | null;
    notes: string | null;
  };
  sequenceName: string;
  projectName: string;
  frameRate?: number;
}

export function ShotCountSheet({ shot, sequenceName, projectName, frameRate = 24 }: ShotCountSheetProps) {
  const [generating, setGenerating] = useState(false);

  // Calculate all the counts
  const frameIn = shot.frame_start || 0;
  const frameOut = shot.frame_end || 0;
  const handleHead = shot.handle_head || 8;
  const handleTail = shot.handle_tail || 8;
  
  const cutDuration = frameOut - frameIn;
  const handleFrames = handleHead + handleTail;
  const totalWorkingFrames = cutDuration + handleFrames;
  
  const cutSeconds = cutDuration / frameRate;
  const totalSeconds = totalWorkingFrames / frameRate;

  // Convert frames to timecode
  const framesToTC = (frames: number) => {
    const totalSeconds = frames / frameRate;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);
    const remainingFrames = frames % frameRate;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(remainingFrames).padStart(2, '0')}`;
  };

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Title
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("VFX Count Sheet", pageWidth / 2, 20, { align: "center" });
      
      // Shot info
      doc.setFontSize(14);
      doc.text(shot.code, pageWidth / 2, 30, { align: "center" });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Project: ${projectName}`, 14, 45);
      doc.text(`Sequence: ${sequenceName}`, 14, 52);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 59);

      // Count Sheet Box
      doc.setDrawColor(100);
      doc.setLineWidth(0.5);
      doc.rect(14, 70, pageWidth - 28, 100);
      
      // Labels and values
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      
      let y = 82;
      const labelX = 20;
      const valueX = 100;
      const lineHeight = 10;

      const rows = [
        ["Frame In:", frameIn.toString()],
        ["Frame Out:", frameOut.toString()],
        ["Cut Duration:", `${cutDuration} frames (${cutSeconds.toFixed(2)}s)`],
        ["Handle Head:", `${handleHead} frames`],
        ["Handle Tail:", `${handleTail} frames`],
        ["Total Handles:", `${handleFrames} frames`],
        ["Total Working:", `${totalWorkingFrames} frames (${totalSeconds.toFixed(2)}s)`],
        ["Frame Rate:", `${frameRate} fps`],
        ["Complexity:", shot.complexity],
        ["Status:", shot.status.replace(/_/g, " ")],
      ];

      rows.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.text(label, labelX, y);
        doc.setFont("helvetica", "normal");
        doc.text(value, valueX, y);
        y += lineHeight;
      });

      // VFX Notes
      if (shot.notes) {
        doc.setFont("helvetica", "bold");
        doc.text("VFX Notes:", 14, 185);
        doc.setFont("helvetica", "normal");
        const splitNotes = doc.splitTextToSize(shot.notes, pageWidth - 28);
        doc.text(splitNotes, 14, 195);
      }

      // Save
      const filename = `${shot.code}_count_sheet.pdf`;
      doc.save(filename);
    } catch (error) {
      console.error("PDF generation error:", error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Calculator className="h-3.5 w-3.5" />
            Count Sheet
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={generatePDF}
            disabled={generating}
            className="h-7 text-xs"
          >
            {generating ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <FileDown className="h-3 w-3 mr-1" />
            )}
            Export PDF
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Frame Range */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/30 rounded-md p-2 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Frame In</p>
            <p className="text-lg font-mono font-bold">{frameIn}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{framesToTC(frameIn)}</p>
          </div>
          <div className="bg-muted/30 rounded-md p-2 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Frame Out</p>
            <p className="text-lg font-mono font-bold">{frameOut}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{framesToTC(frameOut)}</p>
          </div>
        </div>

        <Separator />

        {/* Duration breakdown */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Cut Duration</span>
            <span className="text-sm font-mono font-semibold">{cutDuration}f <span className="text-muted-foreground">({cutSeconds.toFixed(2)}s)</span></span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Handles (H{handleHead} / T{handleTail})</span>
            <span className="text-sm font-mono">+{handleFrames}f</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Total Working Frames</span>
            <span className="text-sm font-mono font-bold text-primary">{totalWorkingFrames}f <span className="text-muted-foreground">({totalSeconds.toFixed(2)}s)</span></span>
          </div>
        </div>

        <Separator />

        {/* Quick stats */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">@ {frameRate} fps</span>
          <span className="text-muted-foreground">{shot.complexity} complexity</span>
        </div>
      </CardContent>
    </Card>
  );
}
