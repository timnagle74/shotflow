"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Shot {
  id: string;
  code: string;
  description: string | null;
  status: string;
  complexity: string;
  frame_start: number | null;
  frame_end: number | null;
  notes: string | null;
  ref_video_id: string | null;
  ref_filename: string | null;
}

interface CountSheetExportProps {
  shots: Shot[];
  sequenceName: string;
  projectName: string;
}

export function CountSheetExport({ shots, sequenceName, projectName }: CountSheetExportProps) {
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    setGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Title
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("VFX Count Sheet", pageWidth / 2, 20, { align: "center" });
      
      // Project/Sequence info
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Project: ${projectName}`, 14, 35);
      doc.text(`Sequence: ${sequenceName}`, 14, 42);
      doc.text(`Total Shots: ${shots.length}`, 14, 49);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 56);

      // Calculate total frames
      const totalFrames = shots.reduce((sum, shot) => {
        if (shot.frame_start && shot.frame_end) {
          return sum + (shot.frame_end - shot.frame_start);
        }
        return sum;
      }, 0);
      doc.text(`Total Frames: ${totalFrames} (${(totalFrames / 24).toFixed(1)}s @ 24fps)`, 14, 63);

      // Fetch thumbnails and build table data
      const tableData: (string | { content: string; styles?: any })[][] = [];
      
      for (const shot of shots) {
        const frameCount = shot.frame_start && shot.frame_end 
          ? shot.frame_end - shot.frame_start 
          : 0;
        const duration = frameCount > 0 ? `${frameCount}f (${(frameCount / 24).toFixed(1)}s)` : "-";
        
        tableData.push([
          shot.code,
          shot.frame_start?.toString() || "-",
          shot.frame_end?.toString() || "-",
          duration,
          shot.complexity,
          shot.status.replace(/_/g, " "),
          shot.notes || "-",
        ]);
      }

      // Generate table
      autoTable(doc, {
        startY: 75,
        head: [[
          "Shot Code",
          "Frame In",
          "Frame Out", 
          "Duration",
          "Complexity",
          "Status",
          "VFX Notes"
        ]],
        body: tableData,
        headStyles: {
          fillColor: [41, 37, 36],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 8,
        },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 30 },
          1: { cellWidth: 20, halign: "right" },
          2: { cellWidth: 20, halign: "right" },
          3: { cellWidth: 25, halign: "right" },
          4: { cellWidth: 20 },
          5: { cellWidth: 25 },
          6: { cellWidth: "auto" },
        },
        alternateRowStyles: {
          fillColor: [245, 245, 244],
        },
        margin: { left: 14, right: 14 },
      });

      // Add page numbers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(
          `Page ${i} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" }
        );
      }

      // Save
      const filename = `${projectName}_${sequenceName}_count_sheet.pdf`.replace(/[^a-zA-Z0-9_-]/g, "_");
      doc.save(filename);
    } catch (error) {
      console.error("PDF generation error:", error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={generatePDF}
      disabled={generating || shots.length === 0}
    >
      {generating ? (
        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
      ) : (
        <><FileDown className="h-4 w-4 mr-2" />Export Count Sheet</>
      )}
    </Button>
  );
}
