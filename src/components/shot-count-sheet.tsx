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
      const margin = 14;
      
      // Header bar
      doc.setFillColor(88, 28, 135); // Purple
      doc.rect(0, 0, pageWidth, 28, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "italic");
      doc.text(projectName, margin, 10);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(`VFX # ${shot.code}`, margin, 22);
      
      // TO info on right
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`TO # ${turnoverNumber || "—"}`, pageWidth - 50, 10, { align: "right" });
      doc.text(`${turnoverDate || "—"}`, pageWidth - 50, 18, { align: "right" });

      // Reset text color
      doc.setTextColor(0, 0, 0);
      
      // Main info box
      let y = 38;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.rect(margin, y - 5, pageWidth - margin * 2, 52);
      
      // Metadata grid - 4 columns
      doc.setFontSize(8);
      const col1 = margin + 3;
      const col2 = 55;
      const col3 = 110;
      const col4 = 155;
      
      const metaData = [
        { x: col1, label: "Vendor", value: vendor || "—" },
        { x: col2, label: "Sequence", value: sequenceName },
        { x: col3, label: "Scene #", value: sceneNumber || "—" },
        { x: col4, label: "Reel #", value: reelNumber || "—" },
      ];
      
      metaData.forEach(item => {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120, 120, 120);
        doc.text(item.label, item.x, y);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.text(item.value, item.x, y + 5);
      });
      
      y += 15;
      
      // Frame counts row - prominent
      doc.setFillColor(245, 245, 245);
      doc.rect(margin + 1, y - 3, pageWidth - margin * 2 - 2, 14, 'F');
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text("Comp Length", col1, y + 2);
      doc.text("Cut Length", col2, y + 2);
      doc.text("Handles", col3, y + 2);
      doc.text("Location", col4, y + 2);
      
      doc.setTextColor(88, 28, 135);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(`${compLength}`, col1, y + 10);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text(`${cutLength}`, col2, y + 10);
      doc.setFontSize(10);
      doc.text(`${handleHead} + ${handleTail}`, col3, y + 10);
      doc.setFont("helvetica", "normal");
      doc.text(location || "—", col4, y + 10);
      
      y += 20;
      
      // Shot Action
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text("Shot Action", col1, y);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(shotAction || shot.description || "—", col1, y + 5);

      // VFX Summary section
      y += 20;
      doc.setFillColor(88, 28, 135);
      doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("VFX SUMMARY", margin + 3, y + 5.5);
      doc.setTextColor(0, 0, 0);
      
      // VFX notes box
      y += 10;
      doc.setDrawColor(200, 200, 200);
      doc.rect(margin, y, pageWidth - margin * 2, 30);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const vfxText = vfxSummary || shot.notes || "No VFX notes provided";
      const splitVfx = doc.splitTextToSize(vfxText, pageWidth - margin * 2 - 6);
      doc.text(splitVfx, margin + 3, y + 6);
      
      // Opticals/Complexity sidebar
      if (opticals || shot.complexity) {
        const sideX = pageWidth - 55;
        doc.setDrawColor(200, 200, 200);
        doc.line(sideX, y, sideX, y + 30);
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        if (opticals) {
          doc.text("Opticals", sideX + 3, y + 6);
          doc.setTextColor(0, 0, 0);
          doc.setFont("helvetica", "bold");
          doc.text(opticals, sideX + 3, y + 11);
        }
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120, 120, 120);
        doc.text("Complexity", sideX + 3, y + 18);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.text(shot.complexity, sideX + 3, y + 23);
      }

      // Frame Details section
      y += 38;
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, pageWidth - margin * 2, 35, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(margin, y, pageWidth - margin * 2, 35);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text("FRAME DETAILS", margin + 3, y + 5);
      doc.setFontSize(7);
      doc.text(`@ ${frameRate} fps`, pageWidth - margin - 20, y + 5);
      
      // Frame boxes
      const boxY = y + 10;
      const boxW = 40;
      const boxH = 20;
      const boxes = [
        { x: margin + 5, label: "Frame In", value: frameIn.toString(), sub: framesToTC(frameIn) },
        { x: margin + 50, label: "Frame Out", value: frameOut.toString(), sub: framesToTC(frameOut) },
        { x: margin + 95, label: "Cut", value: `${cutLength}f`, sub: `${cutSeconds.toFixed(2)}s` },
        { x: margin + 140, label: "Total Comp", value: `${compLength}f`, sub: `${compSeconds.toFixed(2)}s`, highlight: true },
      ];
      
      boxes.forEach(box => {
        if (box.highlight) {
          doc.setFillColor(88, 28, 135);
          doc.roundedRect(box.x, boxY, boxW, boxH, 2, 2, 'F');
          doc.setTextColor(255, 255, 255);
        } else {
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(200, 200, 200);
          doc.roundedRect(box.x, boxY, boxW, boxH, 2, 2, 'FD');
          doc.setTextColor(120, 120, 120);
        }
        
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.text(box.label, box.x + boxW/2, boxY + 4, { align: "center" });
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        if (!box.highlight) doc.setTextColor(0, 0, 0);
        doc.text(box.value, box.x + boxW/2, boxY + 12, { align: "center" });
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        if (!box.highlight) doc.setTextColor(120, 120, 120);
        doc.text(box.sub, box.x + boxW/2, boxY + 17, { align: "center" });
      });

      // Footer
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 290);
      doc.text(`${projectCode} / ${sequenceCode} / ${shot.code}`, pageWidth - margin, 290, { align: "right" });

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
