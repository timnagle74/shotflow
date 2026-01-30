"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileDown, Loader2, Play } from "lucide-react";
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
    ref_preview_url: string | null;
    ref_video_id: string | null;
    plate_source: string | null;
    due_date: string | null;
  };
  sequenceName: string;
  sequenceCode: string;
  projectName: string;
  projectCode: string;
  turnoverNumber?: string;
  turnoverDate?: string;
  vendor?: string;
  location?: string;
  sceneNumber?: string;
  reelNumber?: string;
  shotAction?: string;
  vfxSummary?: string;
  opticals?: string;
  frameRate?: number;
}

export function ShotCountSheet({ 
  shot, 
  sequenceName, 
  sequenceCode,
  projectName, 
  projectCode,
  turnoverNumber,
  turnoverDate,
  vendor,
  location,
  sceneNumber,
  reelNumber,
  shotAction,
  vfxSummary,
  opticals,
  frameRate = 24 
}: ShotCountSheetProps) {
  const [generating, setGenerating] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  // Get thumbnail from Bunny Stream
  useEffect(() => {
    if (shot.ref_video_id) {
      setThumbnailUrl(`https://vz-3b0f7864-a89.b-cdn.net/${shot.ref_video_id}/thumbnail.jpg`);
    }
  }, [shot.ref_video_id]);

  // Calculate frame counts
  const frameIn = shot.frame_start || 0;
  const frameOut = shot.frame_end || 0;
  const handleHead = shot.handle_head || 8;
  const handleTail = shot.handle_tail || 8;
  
  const cutLength = frameOut - frameIn;
  const compLength = cutLength + handleHead + handleTail;
  
  const cutSeconds = cutLength / frameRate;
  const compSeconds = compLength / frameRate;

  // Format timecode
  const framesToTC = (frames: number) => {
    const totalSeconds = Math.floor(frames / frameRate);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const remainingFrames = frames % frameRate;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(remainingFrames).padStart(2, '0')}`;
  };

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header bar
      doc.setFillColor(88, 28, 135); // Purple
      doc.rect(0, 0, pageWidth, 25, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "italic");
      doc.text(projectName, 14, 12);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`VFX # ${shot.code}`, 14, 20);
      
      // TO info on right
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      if (turnoverNumber) doc.text(`TO # ${turnoverNumber}`, pageWidth - 60, 12);
      if (turnoverDate) doc.text(`TO Date: ${turnoverDate}`, pageWidth - 60, 20);

      // Reset text color
      doc.setTextColor(0, 0, 0);
      
      // Metadata section
      let y = 35;
      doc.setFontSize(9);
      
      const metaRows = [
        [{ label: "Vendor", value: vendor || "—" }, { label: "Sequence", value: sequenceName }],
        [{ label: "Scene #", value: sceneNumber || "—" }, { label: "Reel #", value: reelNumber || "—" }],
        [{ label: "Comp Length", value: `${compLength}` }, { label: "Cut Length", value: `${cutLength}` }],
        [{ label: "Handles", value: `${handleHead} + ${handleTail}` }, { label: "Location", value: location || "—" }],
      ];

      metaRows.forEach(row => {
        doc.setFont("helvetica", "bold");
        doc.text(`${row[0].label}:`, 14, y);
        doc.setFont("helvetica", "normal");
        doc.text(row[0].value, 45, y);
        
        doc.setFont("helvetica", "bold");
        doc.text(`${row[1].label}:`, 110, y);
        doc.setFont("helvetica", "normal");
        doc.text(row[1].value, 145, y);
        y += 8;
      });

      // Shot Action
      if (shotAction || shot.description) {
        y += 5;
        doc.setFont("helvetica", "bold");
        doc.text("Shot Action:", 14, y);
        doc.setFont("helvetica", "normal");
        doc.text(shotAction || shot.description || "", 50, y);
      }

      // VFX Summary section
      y += 15;
      doc.setFillColor(88, 28, 135);
      doc.rect(14, y - 5, pageWidth - 28, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text("VFX Summary", 18, y);
      doc.setTextColor(0, 0, 0);
      
      y += 10;
      doc.setFont("helvetica", "normal");
      const vfxText = vfxSummary || shot.notes || "No VFX notes";
      const splitVfx = doc.splitTextToSize(vfxText, pageWidth - 28);
      doc.text(splitVfx, 14, y);
      y += splitVfx.length * 5 + 5;

      // Opticals if present
      if (opticals) {
        doc.setFont("helvetica", "bold");
        doc.text("Opticals:", 14, y);
        doc.setFont("helvetica", "normal");
        doc.text(opticals, 45, y);
        y += 10;
      }

      // Frame details box
      y += 10;
      doc.setDrawColor(150);
      doc.setLineWidth(0.3);
      doc.rect(14, y, pageWidth - 28, 35);
      
      y += 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Frame Details", 18, y);
      
      y += 10;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Frame In: ${frameIn}`, 18, y);
      doc.text(`TC In: ${framesToTC(frameIn)}`, 80, y);
      y += 7;
      doc.text(`Frame Out: ${frameOut}`, 18, y);
      doc.text(`TC Out: ${framesToTC(frameOut)}`, 80, y);
      y += 7;
      doc.text(`Duration: ${cutLength}f (${cutSeconds.toFixed(2)}s) + ${handleHead + handleTail}f handles = ${compLength}f total`, 18, y);

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(`Generated: ${new Date().toLocaleString()} | ${frameRate}fps`, 14, 285);

      doc.save(`${shot.code}_count_sheet.pdf`);
    } catch (error) {
      console.error("PDF generation error:", error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-purple-900 to-purple-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-200 text-xs italic">{projectName}</p>
            <p className="text-white font-bold text-lg">VFX # {shot.code}</p>
          </div>
          <div className="text-right">
            <p className="text-purple-200 text-xs">TO # {turnoverNumber || "—"}</p>
            <p className="text-purple-300 text-xs">TO Date: {turnoverDate || "—"}</p>
          </div>
        </div>
      </div>

      <CardContent className="p-0">
        {/* Main Content Grid */}
        <div className="grid grid-cols-[140px_1fr] gap-0">
          {/* Thumbnail */}
          <div className="bg-black aspect-video flex items-center justify-center border-r border-border">
            {thumbnailUrl ? (
              <img 
                src={thumbnailUrl} 
                alt={shot.code} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="text-muted-foreground/30">
                <Play className="h-8 w-8" />
              </div>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 text-xs divide-x divide-y divide-border">
            <div className="p-2">
              <span className="text-muted-foreground">Vendor</span>
              <p className="font-semibold truncate">{vendor || "—"}</p>
            </div>
            <div className="p-2">
              <span className="text-muted-foreground">Sequence</span>
              <p className="font-semibold truncate">{sequenceName}</p>
            </div>
            <div className="p-2">
              <span className="text-muted-foreground">Scene #</span>
              <p className="font-semibold">{sceneNumber || "—"}</p>
            </div>
            <div className="p-2">
              <span className="text-muted-foreground">Reel #</span>
              <p className="font-semibold">{reelNumber || "—"}</p>
            </div>
            <div className="p-2">
              <span className="text-muted-foreground">Comp Length</span>
              <p className="font-mono font-bold text-primary">{compLength}</p>
            </div>
            <div className="p-2">
              <span className="text-muted-foreground">Cut Length</span>
              <p className="font-mono font-bold">{cutLength}</p>
            </div>
            <div className="p-2">
              <span className="text-muted-foreground">Handles</span>
              <p className="font-mono">{handleHead} + {handleTail}</p>
            </div>
            <div className="p-2">
              <span className="text-muted-foreground">Location</span>
              <p className="font-semibold truncate">{location || "—"}</p>
            </div>
          </div>
        </div>

        {/* Shot Action */}
        {(shotAction || shot.description) && (
          <div className="px-4 py-2 bg-muted/30 border-t border-border">
            <span className="text-xs text-muted-foreground">Shot Action: </span>
            <span className="text-sm">{shotAction || shot.description}</span>
          </div>
        )}

        {/* VFX Summary Section */}
        <div className="border-t border-border">
          <div className="bg-purple-900/50 px-4 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-200">VFX Summary</span>
          </div>
          <div className="grid grid-cols-3 divide-x divide-border text-xs">
            <div className="p-3 col-span-2">
              <p className="text-sm leading-relaxed">{vfxSummary || shot.notes || <span className="text-muted-foreground italic">No VFX notes</span>}</p>
            </div>
            <div className="p-3 space-y-2">
              {opticals && (
                <div>
                  <span className="text-muted-foreground">Opticals</span>
                  <p className="font-mono">{opticals}</p>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Complexity</span>
                <p className="font-semibold">{shot.complexity}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className="mt-0.5">{shot.status.replace(/_/g, " ")}</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Frame Details */}
        <div className="border-t border-border px-4 py-3 bg-muted/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Frame Details</span>
            <span className="text-xs text-muted-foreground">{frameRate} fps</span>
          </div>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="bg-background rounded-md p-2">
              <p className="text-[10px] text-muted-foreground">Frame In</p>
              <p className="font-mono font-bold">{frameIn}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{framesToTC(frameIn)}</p>
            </div>
            <div className="bg-background rounded-md p-2">
              <p className="text-[10px] text-muted-foreground">Frame Out</p>
              <p className="font-mono font-bold">{frameOut}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{framesToTC(frameOut)}</p>
            </div>
            <div className="bg-background rounded-md p-2">
              <p className="text-[10px] text-muted-foreground">Cut</p>
              <p className="font-mono font-bold">{cutLength}f</p>
              <p className="text-[10px] text-muted-foreground">{cutSeconds.toFixed(2)}s</p>
            </div>
            <div className="bg-primary/10 rounded-md p-2 ring-1 ring-primary/30">
              <p className="text-[10px] text-primary">Total Comp</p>
              <p className="font-mono font-bold text-primary">{compLength}f</p>
              <p className="text-[10px] text-muted-foreground">{compSeconds.toFixed(2)}s</p>
            </div>
          </div>
        </div>

        {/* Export Button */}
        <div className="border-t border-border px-4 py-2 flex justify-end">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={generatePDF}
            disabled={generating}
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
            ) : (
              <><FileDown className="h-4 w-4 mr-2" />Export PDF</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
