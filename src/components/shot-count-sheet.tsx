"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileDown, Loader2, Play, Move, Timer, Camera, Aperture, Sun, Palette, Calendar, Monitor } from "lucide-react";
import jsPDF from "jspdf";

interface CDLValues {
  slope: (number | null)[];
  offset: (number | null)[];
  power: (number | null)[];
  saturation: number | null;
}

interface ShotCountSheetProps {
  shot: {
    code: string;
    description: string | null;
    status: string;
    complexity: string;
    frame_start: number | null;
    frame_end: number | null;
    record_frame_in: number | null;
    record_frame_out: number | null;
    record_tc_in: string | null;
    record_tc_out: string | null;
    source_tc_in: string | null;
    source_tc_out: string | null;
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
  // Editorial data (reposition, speed)
  sourceClip?: string;
  sourceTc?: string;
  hasReposition?: boolean;
  repoSummary?: string;       // e.g., "110% @ +20,+15"
  hasSpeedChange?: boolean;
  speedSummary?: string;      // e.g., "50% (slow-mo)"
  // Camera metadata
  camera?: string;            // Camera model (ALEXA 35)
  cameraId?: string;          // Camera index (A_, B_)
  iso?: string;               // Exposure index (2560)
  shutter?: string;           // Shutter angle (180.0)
  // Lens metadata
  lens?: string;              // Lens type (Cooke Anam/i 50mm)
  focalLength?: string;       // Extracted focal length
  // Color metadata
  colorspace?: string;        // Gamma (LOG-C)
  whiteBalance?: string;      // White balance (3500)
  look?: string;              // Look name
  cdl?: CDLValues;            // ASC CDL values
  // Resolution & Date
  resolution?: string;        // Frame dimensions
  shootDate?: string;         // Date camera (YYYYMMDD or YYYY-MM-DD)
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
  frameRate = 24,
  sourceClip,
  sourceTc,
  hasReposition,
  repoSummary,
  hasSpeedChange,
  speedSummary,
  camera,
  cameraId,
  lens,
  focalLength,
  iso,
  shutter,
  colorspace,
  whiteBalance,
  look,
  cdl,
  resolution,
  shootDate,
}: ShotCountSheetProps) {
  const [generating, setGenerating] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  // Get thumbnail from Bunny Stream
  useEffect(() => {
    if (shot.ref_video_id) {
      const cdn = process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN || '';
      setThumbnailUrl(`${cdn}/${shot.ref_video_id}/thumbnail.jpg`);
    }
  }, [shot.ref_video_id]);

  // Calculate frame counts
  const handleHead = shot.handle_head || 8;
  const handleTail = shot.handle_tail || 8;
  
  // Prefer record TC range for cut length, fall back to frame_start/frame_end
  let cutLength = 0;
  if (shot.record_frame_in != null && shot.record_frame_out != null && shot.record_frame_out > shot.record_frame_in) {
    cutLength = shot.record_frame_out - shot.record_frame_in;
  } else if (shot.frame_start != null && shot.frame_end != null && shot.frame_end > shot.frame_start) {
    cutLength = shot.frame_end - shot.frame_start;
  }
  const compLength = cutLength > 0 ? cutLength + handleHead + handleTail : 0;
  
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
      
      // Load thumbnail via img element and canvas (avoids CORS issues with server-side fetch)
      let thumbnailData: string | null = null;
      if (shot.ref_video_id) {
        try {
          const cdnBase = process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN || '';
          const cdnUrl = `${cdnBase}/${shot.ref_video_id}/thumbnail.jpg`;
          console.log('Loading thumbnail from:', cdnUrl);
          
          thumbnailData = await new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(img, 0, 0);
                  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                  console.log('Thumbnail converted, data URL length:', dataUrl.length);
                  resolve(dataUrl);
                } else {
                  console.error('Could not get canvas context');
                  resolve(null);
                }
              } catch (e) {
                console.error('Canvas conversion error:', e);
                resolve(null);
              }
            };
            
            img.onerror = (e) => {
              console.error('Image load error:', e);
              resolve(null);
            };
            
            // Set timeout for slow loads
            setTimeout(() => {
              if (!thumbnailData) {
                console.log('Thumbnail load timeout');
                resolve(null);
              }
            }, 5000);
            
            img.src = cdnUrl;
          });
        } catch (e) {
          console.error('Could not load thumbnail for PDF:', e);
        }
      } else {
        console.log('No ref_video_id for shot');
      }
      
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
      doc.text(`TO # ${turnoverNumber || "-"}`, pageWidth - 50, 10, { align: "right" });
      doc.text(`${turnoverDate || "-"}`, pageWidth - 50, 18, { align: "right" });

      // Reset text color
      doc.setTextColor(0, 0, 0);
      
      // Main content area with thumbnail
      let y = 35;
      const thumbWidth = 60;
      const thumbHeight = 34;
      
      // Thumbnail area
      doc.setDrawColor(100, 100, 100);
      doc.setFillColor(30, 30, 30);
      doc.rect(margin, y, thumbWidth, thumbHeight, 'FD');
      
      if (thumbnailData) {
        try {
          doc.addImage(thumbnailData, 'JPEG', margin + 1, y + 1, thumbWidth - 2, thumbHeight - 2);
        } catch (e) {
          // Fallback - just show placeholder text
          doc.setTextColor(100, 100, 100);
          doc.setFontSize(8);
          doc.text('No Preview', margin + thumbWidth/2, y + thumbHeight/2, { align: 'center' });
          doc.setTextColor(0, 0, 0);
        }
      } else {
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.text('No Preview', margin + thumbWidth/2, y + thumbHeight/2, { align: 'center' });
        doc.setTextColor(0, 0, 0);
      }
      
      // Metadata grid - to the right of thumbnail (2 columns layout)
      doc.setFontSize(8);
      const metaX = margin + thumbWidth + 8;
      const metaWidth = pageWidth - metaX - margin;
      const colA = metaX;
      const colB = metaX + metaWidth / 2;
      
      let metaY = y + 5;
      
      // Row 1: Vendor | Sequence
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text("Vendor", colA, metaY);
      doc.text("Sequence", colB, metaY);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text(vendor || "-", colA, metaY + 5);
      doc.text(sequenceName || "-", colB, metaY + 5);
      
      // Row 2: Scene # | Reel #
      metaY += 12;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text("Scene #", colA, metaY);
      doc.text("Reel #", colB, metaY);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text(sceneNumber || "-", colA, metaY + 5);
      doc.text(reelNumber || "-", colB, metaY + 5);
      
      // Row 3: Comp/Cut/Handles
      metaY += 12;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text("Comp", colA, metaY);
      doc.text("Cut", colA + 25, metaY);
      doc.text("Handles", colB, metaY);
      
      doc.setTextColor(88, 28, 135);
      doc.setFont("helvetica", "bold");
      doc.text(`${compLength}`, colA, metaY + 5);
      doc.setTextColor(0, 0, 0);
      doc.text(`${cutLength}`, colA + 25, metaY + 5);
      doc.text(`${handleHead}+${handleTail}`, colB, metaY + 5);
      
      // Location on same row
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text("Location", colB + 30, metaY);
      doc.setTextColor(0, 0, 0);
      doc.text(location || "-", colB + 30, metaY + 5);
      
      // Move y past the thumbnail
      y = y + thumbHeight + 5;
      
      // Shot Action
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text("Shot Action", margin, y);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(shotAction || shot.description || "-", margin, y + 5);

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
        { x: margin + 5, label: "Src TC In", value: shot.source_tc_in || '—', sub: shot.record_tc_in || '' },
        { x: margin + 50, label: "Src TC Out", value: shot.source_tc_out || '—', sub: shot.record_tc_out || '' },
        { x: margin + 95, label: "Cut", value: cutLength > 0 ? `${cutLength}f` : '—', sub: cutLength > 0 ? `${cutSeconds.toFixed(2)}s` : '' },
        { x: margin + 140, label: "Total Comp", value: compLength > 0 ? `${compLength}f` : '—', sub: compLength > 0 ? `${compSeconds.toFixed(2)}s` : '', highlight: true },
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

      // Camera & Lens Section
      if (camera || cameraId || lens || iso || shutter || resolution) {
        y += 40;
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, y, pageWidth - margin * 2, 28, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.rect(margin, y, pageWidth - margin * 2, 28);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text("CAMERA & LENS", margin + 3, y + 5);
        
        // Shoot date on right
        if (shootDate) {
          const formattedDate = shootDate.includes('-') ? shootDate : `${shootDate.slice(0,4)}-${shootDate.slice(4,6)}-${shootDate.slice(6,8)}`;
          doc.setFont("helvetica", "normal");
          doc.text(formattedDate, pageWidth - margin - 3, y + 5, { align: "right" });
        }
        
        // Camera/Lens/Resolution row
        const camY = y + 10;
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text("Camera", margin + 3, camY);
        doc.text("Lens", margin + 55, camY);
        doc.text("Resolution", margin + 110, camY);
        
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(camera || "-", margin + 3, camY + 6);
        doc.text(lens || "-", margin + 55, camY + 6);
        doc.text(resolution || "-", margin + 110, camY + 6);
        
        // Camera ID subtitle
        if (cameraId) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6);
          doc.setTextColor(120, 120, 120);
          doc.text(`Cam ${cameraId.replace(/_$/, '')}`, margin + 3, camY + 11);
        }
        
        // ISO/Shutter row
        if (iso || shutter) {
          doc.setFontSize(7);
          doc.setTextColor(120, 120, 120);
          doc.setFont("helvetica", "normal");
          doc.text("ISO", margin + 150, camY);
          doc.text("Shutter", margin + 170, camY);
          doc.setTextColor(0, 0, 0);
          doc.setFont("helvetica", "bold");
          doc.text(iso || "-", margin + 150, camY + 6);
          doc.text(shutter ? `${shutter}°` : "-", margin + 170, camY + 6);
        }
      }

      // Color Section
      if (colorspace || whiteBalance || look || cdl) {
        y += 32;
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, y, pageWidth - margin * 2, cdl ? 40 : 22, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.rect(margin, y, pageWidth - margin * 2, cdl ? 40 : 22);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text("COLOR", margin + 3, y + 5);
        
        const colorY = y + 10;
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text("Colorspace", margin + 3, colorY);
        doc.text("White Bal", margin + 50, colorY);
        doc.text("Look", margin + 95, colorY);
        
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(colorspace || "-", margin + 3, colorY + 6);
        doc.text(whiteBalance ? `${whiteBalance}K` : "-", margin + 50, colorY + 6);
        doc.setFontSize(8);
        const lookText = look ? (look.length > 20 ? look.slice(0, 20) + '...' : look) : "-";
        doc.text(lookText, margin + 95, colorY + 6);
        
        // CDL values
        if (cdl) {
          const cdlY = colorY + 14;
          doc.setFontSize(6);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(120, 120, 120);
          doc.text("ASC CDL", margin + 3, cdlY);
          
          // Slope
          doc.text("Slope", margin + 30, cdlY);
          doc.setTextColor(180, 80, 80);
          doc.text(cdl.slope[0]?.toFixed(4) || "-", margin + 30, cdlY + 4);
          doc.setTextColor(80, 180, 80);
          doc.text(cdl.slope[1]?.toFixed(4) || "-", margin + 30, cdlY + 8);
          doc.setTextColor(80, 80, 180);
          doc.text(cdl.slope[2]?.toFixed(4) || "-", margin + 30, cdlY + 12);
          
          // Offset
          doc.setTextColor(120, 120, 120);
          doc.text("Offset", margin + 60, cdlY);
          doc.setTextColor(180, 80, 80);
          doc.text(cdl.offset[0]?.toFixed(4) || "-", margin + 60, cdlY + 4);
          doc.setTextColor(80, 180, 80);
          doc.text(cdl.offset[1]?.toFixed(4) || "-", margin + 60, cdlY + 8);
          doc.setTextColor(80, 80, 180);
          doc.text(cdl.offset[2]?.toFixed(4) || "-", margin + 60, cdlY + 12);
          
          // Power
          doc.setTextColor(120, 120, 120);
          doc.text("Power", margin + 90, cdlY);
          doc.setTextColor(180, 80, 80);
          doc.text(cdl.power[0]?.toFixed(4) || "-", margin + 90, cdlY + 4);
          doc.setTextColor(80, 180, 80);
          doc.text(cdl.power[1]?.toFixed(4) || "-", margin + 90, cdlY + 8);
          doc.setTextColor(80, 80, 180);
          doc.text(cdl.power[2]?.toFixed(4) || "-", margin + 90, cdlY + 12);
          
          // Saturation
          doc.setTextColor(120, 120, 120);
          doc.text("Sat", margin + 120, cdlY);
          doc.setTextColor(0, 0, 0);
          doc.text(cdl.saturation?.toFixed(4) || "-", margin + 120, cdlY + 4);
        }
      }

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
              <p className="font-mono font-bold text-primary">{compLength > 0 ? `${compLength}f` : '—'}</p>
            </div>
            <div className="p-2">
              <span className="text-muted-foreground">Cut Length</span>
              <p className="font-mono font-bold">{cutLength > 0 ? `${cutLength}f` : '—'}</p>
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
              <p className="text-[10px] text-muted-foreground">Src TC In</p>
              <p className="font-mono font-bold text-xs">{shot.source_tc_in || '—'}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{shot.record_tc_in || '—'}</p>
            </div>
            <div className="bg-background rounded-md p-2">
              <p className="text-[10px] text-muted-foreground">Src TC Out</p>
              <p className="font-mono font-bold text-xs">{shot.source_tc_out || '—'}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{shot.record_tc_out || '—'}</p>
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

        {/* Source Clip & Editorial Section */}
        {(sourceClip || hasReposition || hasSpeedChange) && (
          <div className="border-t border-border px-4 py-3 bg-muted/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source / Editorial</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                {sourceClip && (
                  <div>
                    <span className="text-muted-foreground">Source Clip</span>
                    <p className="font-mono text-[10px] truncate">{sourceClip}</p>
                    {sourceTc && <p className="font-mono text-[10px] text-muted-foreground">{sourceTc}</p>}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 items-start justify-end">
                {hasReposition && (
                  <Badge variant="secondary" className="bg-orange-500/20 text-orange-600 border-orange-500/30">
                    <Move className="h-3 w-3 mr-1" />
                    REPO
                    {repoSummary && <span className="ml-1 font-mono text-[10px]">{repoSummary}</span>}
                  </Badge>
                )}
                {hasSpeedChange && (
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-600 border-blue-500/30">
                    <Timer className="h-3 w-3 mr-1" />
                    SPEED
                    {speedSummary && <span className="ml-1 font-mono text-[10px]">{speedSummary}</span>}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Camera & Lens Section */}
        {(camera || cameraId || lens || iso || shutter || resolution || shootDate) && (
          <div className="border-t border-border px-4 py-3 bg-muted/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5" /> Camera & Lens
              </span>
              {shootDate && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {shootDate.includes('-') ? shootDate : `${shootDate.slice(0,4)}-${shootDate.slice(4,6)}-${shootDate.slice(6,8)}`}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              {/* Camera */}
              <div className="space-y-1">
                <span className="text-muted-foreground">Camera</span>
                <p className="font-semibold">{camera || "—"}</p>
                {cameraId && <p className="text-[10px] text-muted-foreground font-mono">Cam {cameraId.replace(/_$/, '')}</p>}
              </div>
              {/* Lens */}
              <div className="space-y-1">
                <span className="text-muted-foreground">Lens</span>
                <p className="font-semibold">{lens || "—"}</p>
                {focalLength && !lens?.includes(focalLength) && (
                  <p className="text-[10px] text-muted-foreground font-mono">{focalLength}mm</p>
                )}
              </div>
              {/* Resolution */}
              <div className="space-y-1">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Monitor className="h-3 w-3" /> Resolution
                </span>
                <p className="font-mono text-[11px]">{resolution || "—"}</p>
              </div>
            </div>
            {/* Exposure row */}
            {(iso || shutter) && (
              <div className="grid grid-cols-4 gap-3 text-xs mt-3 pt-2 border-t border-border/50">
                <div>
                  <span className="text-muted-foreground">ISO</span>
                  <p className="font-mono font-semibold">{iso || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Shutter</span>
                  <p className="font-mono font-semibold">{shutter ? `${shutter}°` : "—"}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Color Section */}
        {(colorspace || whiteBalance || look || cdl) && (
          <div className="border-t border-border px-4 py-3 bg-muted/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5" /> Color
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Colorspace</span>
                <p className="font-semibold">{colorspace || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground flex items-center gap-1">
                  <Sun className="h-3 w-3" /> White Bal
                </span>
                <p className="font-mono font-semibold">{whiteBalance ? `${whiteBalance}K` : "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Look</span>
                <p className="font-semibold truncate">{look || "—"}</p>
              </div>
            </div>
            {/* CDL Values */}
            {cdl && (
              <div className="mt-3 pt-2 border-t border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">ASC CDL</span>
                <div className="grid grid-cols-4 gap-2 mt-1 text-[10px] font-mono">
                  <div>
                    <span className="text-muted-foreground">Slope</span>
                    <p className="text-red-400">{cdl.slope[0]?.toFixed(4) || "—"}</p>
                    <p className="text-green-400">{cdl.slope[1]?.toFixed(4) || "—"}</p>
                    <p className="text-blue-400">{cdl.slope[2]?.toFixed(4) || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Offset</span>
                    <p className="text-red-400">{cdl.offset[0]?.toFixed(4) || "—"}</p>
                    <p className="text-green-400">{cdl.offset[1]?.toFixed(4) || "—"}</p>
                    <p className="text-blue-400">{cdl.offset[2]?.toFixed(4) || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Power</span>
                    <p className="text-red-400">{cdl.power[0]?.toFixed(4) || "—"}</p>
                    <p className="text-green-400">{cdl.power[1]?.toFixed(4) || "—"}</p>
                    <p className="text-blue-400">{cdl.power[2]?.toFixed(4) || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Saturation</span>
                    <p>{cdl.saturation?.toFixed(4) || "—"}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

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
              <><FileDown className="h-4 w-4 mr-2" />Export Count Sheet</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
