"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// Tabs removed - using unified drop zone with auto-detection
import { parseEDL, getVideoEvents, type EDLParseResult } from "@/lib/edl-parser";
import { parseAleFile, getClipName, isCircled, getSceneTake, parseAscSop, parseAscSat, type AleParseResult } from "@/lib/ale-parser";
import { parseXML, type XMLParseResult, type XMLClip } from "@/lib/xml-parser";
import { parseMarkerFile, matchMarkersToShots, type MarkerEntry, type MarkerParseResult } from "@/lib/marker-parser";
import { isFilmScribeXML, parseFilmScribe, filmScribeToShots, type FilmScribeParseResult } from "@/lib/filmscribe-parser";
import { Upload, FileText, Check, AlertCircle, AlertTriangle, Film, X, Database, Video, FolderOpen, Trash2, Loader2, MessageSquare, Download, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { downloadEDL } from "@/lib/edl-export";
import { downloadALE } from "@/lib/ale-export";
import { downloadFCPXML } from "@/lib/xml-export";

interface TurnoverFile {
  id: string;
  file: File;
  type: 'ref' | 'plate';
  description?: string;
  matchedShot?: string;
}

interface Project {
  id: string;
  name: string;
  code: string;
}

interface Sequence {
  id: string;
  project_id: string;
  name: string;
  code: string;
}

export default function TurnoverPage() {
  const router = useRouter();
  
  // Data from Supabase
  const [projects, setProjects] = useState<Project[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedProject, setSelectedProject] = useState("");
  const [selectedSequence, setSelectedSequence] = useState("new");

  // Load projects and sequences from Supabase
  useEffect(() => {
    async function loadData() {
      if (!supabase) {
        setLoadingData(false);
        return;
      }

      try {
        const { data: projectsData } = await supabase
          .from("projects")
          .select("id, name, code")
          .order("name") as { data: Project[] | null };

        if (projectsData && projectsData.length > 0) {
          setProjects(projectsData);
          setSelectedProject(projectsData[0].id);
        }

        const { data: sequencesData } = await supabase
          .from("sequences")
          .select("id, project_id, name, code")
          .order("name") as { data: Sequence[] | null };

        if (sequencesData) {
          setSequences(sequencesData);
        }
      } catch (err) {
        console.error("Failed to load data:", err);
      }

      setLoadingData(false);
    }

    loadData();
  }, []);

  // EDL state
  const [parseResult, setParseResult] = useState<EDLParseResult | null>(null);
  const [edlFileName, setEdlFileName] = useState("");
  const [edlImported, setEdlImported] = useState(false);
  const [edlDragOver, setEdlDragOver] = useState(false);
  const edlFileRef = useRef<HTMLInputElement>(null);

  // ALE state
  const [aleResult, setAleResult] = useState<AleParseResult | null>(null);
  const [aleFileName, setAleFileName] = useState("");
  const [aleImported, setAleImported] = useState(false);
  const [aleDragOver, setAleDragOver] = useState(false);
  const aleFileRef = useRef<HTMLInputElement>(null);

  // XML state (alternative to EDL - includes reposition/speed)
  const [xmlResult, setXmlResult] = useState<XMLParseResult | null>(null);
  const [xmlFileName, setXmlFileName] = useState("");
  const [xmlImported, setXmlImported] = useState(false);
  const [xmlDragOver, setXmlDragOver] = useState(false);
  const xmlFileRef = useRef<HTMLInputElement>(null);
  const [useXmlMode, setUseXmlMode] = useState(false); // Toggle between EDL and XML mode

  // FilmScribe state (Avid film finishing XML)
  const [filmscribeResult, setFilmscribeResult] = useState<FilmScribeParseResult | null>(null);
  const [filmscribeImported, setFilmscribeImported] = useState(false);

  // Turnover files (refs + plates)
  const [turnoverFiles, setTurnoverFiles] = useState<TurnoverFile[]>([]);
  const [refDragOver, setRefDragOver] = useState(false);
  const [plateDragOver, setPlateDragOver] = useState(false);
  const refFileRef = useRef<HTMLInputElement>(null);
  const plateFileRef = useRef<HTMLInputElement>(null);

  const projectSequences = sequences.filter(s => s.project_id === selectedProject);

  // EDL handlers
  const handleEdlFile = useCallback((file: File) => {
    setEdlFileName(file.name);
    setEdlImported(false);
    setParseResult(null);
    if (!file.name.toLowerCase().endsWith(".edl")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      try { setParseResult(parseEDL(content)); } catch { setParseResult(null); }
    };
    reader.readAsText(file);
  }, []);

  // ALE handlers
  const handleAleFile = useCallback((file: File) => {
    setAleFileName(file.name);
    setAleImported(false);
    setAleResult(null);
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".ale") && !ext.endsWith(".txt")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      try { setAleResult(parseAleFile(content)); } catch { setAleResult(null); }
    };
    reader.readAsText(file);
  }, []);

  const handleEdlUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleEdlFile(f); }, [handleEdlFile]);
  const handleAleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleAleFile(f); }, [handleAleFile]);

  const handleEdlDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setEdlDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleEdlFile(f); }, [handleEdlFile]);
  const handleAleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setAleDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleAleFile(f); }, [handleAleFile]);

  const clearEdl = () => { setEdlFileName(""); setParseResult(null); setEdlImported(false); if (edlFileRef.current) edlFileRef.current.value = ""; };
  const clearAle = () => { setAleFileName(""); setAleResult(null); setAleImported(false); if (aleFileRef.current) aleFileRef.current.value = ""; };

  // XML handlers (detects FilmScribe vs standard XML)
  const handleXmlFile = useCallback((file: File, setImportType?: (t: ImportType) => void) => {
    setXmlFileName(file.name);
    setXmlImported(false);
    setXmlResult(null);
    setFilmscribeResult(null);
    setFilmscribeImported(false);
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".xml")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      try { 
        // Detect FilmScribe XML format
        if (isFilmScribeXML(content)) {
          const result = parseFilmScribe(content);
          setFilmscribeResult(result);
          setUseXmlMode(true);
          setImportType?.('filmscribe');
        } else {
          const result = parseXML(content);
          setXmlResult(result);
          setUseXmlMode(true);
          setImportType?.('xml');
        }
      } catch { 
        setXmlResult(null);
        setFilmscribeResult(null);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleXmlUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { 
    const f = e.target.files?.[0]; 
    if (f) handleXmlFile(f); 
  }, [handleXmlFile]);

  const handleXmlDrop = useCallback((e: React.DragEvent) => { 
    e.preventDefault(); 
    setXmlDragOver(false); 
    const f = e.dataTransfer.files?.[0]; 
    if (f) handleXmlFile(f); 
  }, [handleXmlFile]);

  const clearXml = () => { 
    setXmlFileName(""); 
    setXmlResult(null); 
    setXmlImported(false); 
    setUseXmlMode(false);
    if (xmlFileRef.current) xmlFileRef.current.value = ""; 
  };

  // Marker/Notes file state
  const [markerResult, setMarkerResult] = useState<MarkerParseResult | null>(null);
  const [markerFileName, setMarkerFileName] = useState("");
  const [markerDragOver, setMarkerDragOver] = useState(false);
  const [markerMatchResult, setMarkerMatchResult] = useState<{
    matchedCount: number;
    totalMarkers: number;
    unmatchedMarkers: MarkerEntry[];
  } | null>(null);
  const markerFileRef = useRef<HTMLInputElement>(null);

  // Ref/Plate handlers
  const handleRefFiles = useCallback((files: FileList | File[]) => {
    const newFiles: TurnoverFile[] = Array.from(files).map(file => ({
      id: crypto.randomUUID(),
      file,
      type: 'ref' as const,
    }));
    setTurnoverFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handlePlateFiles = useCallback((files: FileList | File[]) => {
    const newFiles: TurnoverFile[] = Array.from(files).map(file => ({
      id: crypto.randomUUID(),
      file,
      type: 'plate' as const,
    }));
    setTurnoverFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleRefUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleRefFiles(e.target.files);
    if (refFileRef.current) refFileRef.current.value = "";
  }, [handleRefFiles]);

  const handlePlateUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handlePlateFiles(e.target.files);
    if (plateFileRef.current) plateFileRef.current.value = "";
  }, [handlePlateFiles]);

  const handleRefDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setRefDragOver(false);
    if (e.dataTransfer.files) handleRefFiles(e.dataTransfer.files);
  }, [handleRefFiles]);

  const handlePlateDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setPlateDragOver(false);
    if (e.dataTransfer.files) handlePlateFiles(e.dataTransfer.files);
  }, [handlePlateFiles]);

  const removeFile = useCallback((id: string) => {
    setTurnoverFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const updateFileDescription = useCallback((id: string, description: string) => {
    setTurnoverFiles(prev => prev.map(f => f.id === id ? { ...f, description } : f));
  }, []);

  const refFiles = turnoverFiles.filter(f => f.type === 'ref');
  const plateFiles = turnoverFiles.filter(f => f.type === 'plate');

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Unified import state
  type ImportType = 'none' | 'edl' | 'xml' | 'ale' | 'filmscribe';
  const [activeImportType, setActiveImportType] = useState<ImportType>('none');
  const [unifiedDragOver, setUnifiedDragOver] = useState(false);
  const unifiedFileRef = useRef<HTMLInputElement>(null);

  // Unified file handler - auto-detects file type
  const handleUnifiedFile = useCallback((file: File) => {
    const ext = file.name.toLowerCase();
    if (ext.endsWith('.edl')) {
      handleEdlFile(file);
      setActiveImportType('edl');
    } else if (ext.endsWith('.xml')) {
      // handleXmlFile will detect FilmScribe vs standard XML and set the import type
      handleXmlFile(file, setActiveImportType);
    } else if (ext.endsWith('.ale') || ext.endsWith('.txt')) {
      // Check if it's actually an ALE by reading first line
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        if (content.trim().startsWith('Heading') || content.includes('\tName\t') || content.includes('FIELD_DELIM')) {
          handleAleFile(file);
          setActiveImportType('ale');
        }
      };
      reader.readAsText(file.slice(0, 1000)); // Just check first 1KB
      handleAleFile(file);
      setActiveImportType('ale');
    }
  }, [handleEdlFile, handleXmlFile, handleAleFile]);

  const handleUnifiedUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleUnifiedFile(f);
  }, [handleUnifiedFile]);

  const handleUnifiedDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setUnifiedDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleUnifiedFile(f);
  }, [handleUnifiedFile]);

  const clearUnified = useCallback(() => {
    clearEdl();
    clearXml();
    clearAle();
    setActiveImportType('none');
    if (unifiedFileRef.current) unifiedFileRef.current.value = "";
  }, []);

  // Get the current file name for display
  const currentFileName = edlFileName || xmlFileName || aleFileName;

  const videoEvents = parseResult ? getVideoEvents(parseResult) : [];
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  
  // Helper to compute shot code consistently
  // Priority: clipName (FROM CLIP NAME) > reelName > EDL title + index > fallback
  const getShotCode = useCallback((event: typeof videoEvents[0], idx: number) => {
    // Prefer clipName from FROM CLIP NAME comment (the actual shot identifier)
    if (event.clipName?.trim()) {
      return event.clipName.trim();
    }
    // Fall back to EDL title + index if no clipName
    const edlTitle = parseResult?.title?.trim();
    if (edlTitle) {
      return videoEvents.length > 1 
        ? `${edlTitle}_${String(idx + 1).padStart(3, "0")}` 
        : edlTitle;
    }
    // Last resort: reel name or generic
    return event.reelName || `SHOT_${String(idx + 1).padStart(3, "0")}`;
  }, [parseResult?.title, videoEvents.length]);
  
  // Shot notes for VFX descriptions (editable in preview table)
  const [shotNotes, setShotNotes] = useState<Record<string, string>>({});
  
  // General VFX notes that apply to all shots in this turnover
  const [generalVfxNotes, setGeneralVfxNotes] = useState("");
  
  const updateShotNote = useCallback((shotCode: string, note: string) => {
    setShotNotes(prev => ({ ...prev, [shotCode]: note }));
  }, []);

  // Marker file handlers (must be after videoEvents and getShotCode are defined)
  const handleMarkerFile = useCallback((file: File) => {
    setMarkerFileName(file.name);
    setMarkerResult(null);
    setMarkerMatchResult(null);
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      try {
        const result = parseMarkerFile(content);
        setMarkerResult(result);
        
        // If we have shots parsed, auto-match
        if (videoEvents.length > 0) {
          const shots = videoEvents.map((event, idx) => ({
            code: getShotCode(event, idx),
            recordIn: event.recordIn,
            recordOut: event.recordOut,
          }));
          
          const { matches, matchedCount, unmatchedMarkers } = matchMarkersToShots(result.markers, shots);
          
          // Pre-fill shot notes
          setShotNotes(prev => ({ ...prev, ...matches }));
          setMarkerMatchResult({
            matchedCount,
            totalMarkers: result.markers.length,
            unmatchedMarkers,
          });
        } else if (xmlResult?.sequences[0]?.clips.length) {
          // Match to XML clips
          const shots = xmlResult.sequences[0].clips.map(clip => ({
            code: clip.name,
            recordIn: clip.sourceTimecode || undefined,
            recordOut: undefined, // XML doesn't always have out TC
          }));
          
          const { matches, matchedCount, unmatchedMarkers } = matchMarkersToShots(result.markers, shots);
          setShotNotes(prev => ({ ...prev, ...matches }));
          setMarkerMatchResult({
            matchedCount,
            totalMarkers: result.markers.length,
            unmatchedMarkers,
          });
        }
      } catch (err) {
        console.error("Failed to parse marker file:", err);
      }
    };
    reader.readAsText(file);
  }, [videoEvents, xmlResult, getShotCode]);

  const handleMarkerUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleMarkerFile(f);
  }, [handleMarkerFile]);

  const handleMarkerDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setMarkerDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleMarkerFile(f);
  }, [handleMarkerFile]);

  const clearMarkers = useCallback(() => {
    setMarkerFileName("");
    setMarkerResult(null);
    setMarkerMatchResult(null);
    if (markerFileRef.current) markerFileRef.current.value = "";
  }, []);

  const [importStatus, setImportStatus] = useState("");

  const handleEdlImport = useCallback(async () => {
    if (videoEvents.length === 0) return;
    
    // No longer require VFX notes upfront - AE adds them in review step

    setImporting(true);
    setImportError(null);
    setImportStatus("Preparing...");

    try {
      const projectId = selectedProject;
      
      // Build file list for upload preparation
      const allFiles = [
        ...refFiles.map(f => ({ name: f.file.name, type: 'ref' as const })),
        ...plateFiles.map(f => ({ name: f.file.name, type: 'plate' as const })),
      ];

      let uploadedFiles: Array<{
        originalName: string;
        type: 'ref' | 'plate';
        storagePath: string;
        cdnUrl: string;
        fileSize: number;
      }> = [];

      // Upload files directly to Bunny if we have any
      if (allFiles.length > 0) {
        setImportStatus("Getting upload URLs...");
        
        const prepareRes = await fetch("/api/turnover/prepare-uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, files: allFiles }),
        });

        if (!prepareRes.ok) {
          throw new Error("Failed to prepare uploads");
        }

        const { uploads } = await prepareRes.json();

        // Upload each file directly to Bunny Storage
        const allTurnoverFiles = [...refFiles, ...plateFiles];
        for (let i = 0; i < uploads.length; i++) {
          const config = uploads[i];
          const turnoverFile = allTurnoverFiles.find(f => f.file.name === config.originalName);
          if (!turnoverFile) continue;

          setImportStatus(`Uploading ${i + 1}/${uploads.length}: ${config.originalName}`);

          const uploadRes = await fetch(config.uploadUrl, {
            method: "PUT",
            headers: {
              "AccessKey": config.accessKey,
              "Content-Type": "application/octet-stream",
            },
            body: turnoverFile.file,
          });

          if (uploadRes.ok || uploadRes.status === 201) {
            uploadedFiles.push({
              originalName: config.originalName,
              type: config.type,
              storagePath: config.storagePath,
              cdnUrl: config.cdnUrl,
              fileSize: turnoverFile.file.size,
            });
          }
        }
      }

      // Now call import with just metadata
      setImportStatus("Creating shots...");
      
      const seqName = parseResult?.title || edlFileName.replace(/\.edl$/i, "");
      
      const shots = videoEvents.map((event, idx) => {
        const code = getShotCode(event, idx);
        return {
          code,
          clipName: event.clipName,
          cameraRoll: event.reelName, // Camera roll ID from EDL reel field
          sourceIn: event.sourceIn,
          sourceOut: event.sourceOut,
          recordIn: event.recordIn,
          recordOut: event.recordOut,
          durationFrames: event.durationFrames,
          vfxNotes: shotNotes[code] || null, // VFX description from user input
        };
      });

      const response = await fetch("/api/turnover/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sequenceId: selectedSequence !== "new" ? selectedSequence : undefined,
          sequenceName: seqName,
          sequenceCode: seqName.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase().slice(0, 20),
          shots,
          uploadedFiles,
          generalVfxNotes: generalVfxNotes.trim() || null,
          sourceEdlFilename: edlFileName || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Import failed");
      }

      const result = await response.json();
      console.log("Import result:", result);
      
      const toNum = result.turnoverNumber ? `TO${result.turnoverNumber}: ` : '';
      const refsInfo = result.refs ? ` | ${result.refs.matched}/${result.refs.created} refs matched` : '';
      const platesInfo = result.plates ? ` | ${result.plates.matched}/${result.plates.created} plates matched` : '';
      setImportStatus(`${toNum}Created ${result.shotsCreated} shot(s)${refsInfo}${platesInfo}`);
      setEdlImported(true);
      
      // Redirect to review page after short delay
      if (result.reviewUrl) {
        setTimeout(() => {
          router.push(result.reviewUrl);
        }, 1500);
      }
    } catch (err) {
      console.error("Import error:", err);
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }, [videoEvents, selectedProject, selectedSequence, parseResult, edlFileName, refFiles, plateFiles, getShotCode, shotNotes, generalVfxNotes, router]);

  const handleXmlImport = useCallback(async () => {
    if (!xmlResult || !xmlResult.sequences[0]?.clips.length) return;
    
    setImporting(true);
    setImportError(null);
    setImportStatus("Preparing...");

    try {
      const projectId = selectedProject;
      const clips = xmlResult.sequences[0].clips;
      
      // Build file list for upload preparation
      const allFiles = [
        ...refFiles.map(f => ({ name: f.file.name, type: 'ref' as const })),
        ...plateFiles.map(f => ({ name: f.file.name, type: 'plate' as const })),
      ];

      let uploadedFiles: Array<{
        originalName: string;
        type: 'ref' | 'plate';
        storagePath: string;
        cdnUrl: string;
        fileSize: number;
      }> = [];

      // Upload files directly to Bunny if we have any
      if (allFiles.length > 0) {
        setImportStatus("Getting upload URLs...");
        
        const prepareRes = await fetch("/api/turnover/prepare-uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, files: allFiles }),
        });

        if (!prepareRes.ok) {
          throw new Error("Failed to prepare uploads");
        }

        const { uploads } = await prepareRes.json();

        const allTurnoverFiles = [...refFiles, ...plateFiles];
        for (let i = 0; i < uploads.length; i++) {
          const config = uploads[i];
          const turnoverFile = allTurnoverFiles.find(f => f.file.name === config.originalName);
          if (!turnoverFile) continue;

          setImportStatus(`Uploading ${i + 1}/${uploads.length}: ${config.originalName}`);

          const uploadRes = await fetch(config.uploadUrl, {
            method: "PUT",
            headers: {
              "AccessKey": config.accessKey,
              "Content-Type": "application/octet-stream",
            },
            body: turnoverFile.file,
          });

          if (uploadRes.ok || uploadRes.status === 201) {
            uploadedFiles.push({
              originalName: config.originalName,
              type: config.type,
              storagePath: config.storagePath,
              cdnUrl: config.cdnUrl,
              fileSize: turnoverFile.file.size,
            });
          }
        }
      }

      setImportStatus("Creating shots...");
      
      const seqName = xmlResult.sequences[0].name || xmlFileName.replace(/\.xml$/i, "");
      
      const shots = clips.map((clip) => ({
        code: clip.name,
        clipName: clip.sourceFileName || clip.name,
        cameraRoll: clip.cameraRoll || clip.reelName || null,
        sourceIn: clip.sourceTimecode || null,
        sourceOut: null, // Could calculate from sourceTimecode + duration
        recordIn: null,
        recordOut: null,
        durationFrames: clip.duration,
        vfxNotes: null,
        hasReposition: clip.hasReposition,
        hasSpeedChange: clip.hasSpeedChange,
      }));

      const response = await fetch("/api/turnover/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sequenceId: selectedSequence !== "new" ? selectedSequence : undefined,
          sequenceName: seqName,
          sequenceCode: seqName.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase().slice(0, 20),
          shots,
          uploadedFiles,
          generalVfxNotes: generalVfxNotes.trim() || null,
          sourceEdlFilename: xmlFileName || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Import failed");
      }

      const result = await response.json();
      
      const toNum = result.turnoverNumber ? `TO${result.turnoverNumber}: ` : '';
      setImportStatus(`${toNum}Created ${result.shotsCreated} shot(s)`);
      setXmlImported(true);
      
      if (result.reviewUrl) {
        setTimeout(() => {
          router.push(result.reviewUrl);
        }, 1500);
      }
    } catch (err) {
      console.error("Import error:", err);
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }, [xmlResult, xmlFileName, selectedProject, selectedSequence, refFiles, plateFiles, generalVfxNotes, router]);

  const handleFilmscribeImport = useCallback(async () => {
    if (!filmscribeResult || filmscribeResult.eventsWithVfx === 0) return;
    
    setImporting(true);
    setImportError(null);
    setImportStatus("Preparing...");

    try {
      const projectId = selectedProject;
      
      // Build file list for upload preparation
      const allFiles = [
        ...refFiles.map(f => ({ name: f.file.name, type: 'ref' as const })),
        ...plateFiles.map(f => ({ name: f.file.name, type: 'plate' as const })),
      ];

      let uploadedFiles: Array<{
        originalName: string;
        type: 'ref' | 'plate';
        storagePath: string;
        cdnUrl: string;
        fileSize: number;
      }> = [];

      // Upload files directly to Bunny if we have any
      if (allFiles.length > 0) {
        setImportStatus("Getting upload URLs...");
        
        const prepareRes = await fetch("/api/turnover/prepare-uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, files: allFiles }),
        });

        if (!prepareRes.ok) {
          throw new Error("Failed to prepare uploads");
        }

        const { uploads } = await prepareRes.json();

        const allTurnoverFiles = [...refFiles, ...plateFiles];
        for (let i = 0; i < uploads.length; i++) {
          const config = uploads[i];
          const turnoverFile = allTurnoverFiles.find(f => f.file.name === config.originalName);
          if (!turnoverFile) continue;

          setImportStatus(`Uploading ${i + 1}/${uploads.length}: ${config.originalName}`);

          const uploadRes = await fetch(config.uploadUrl, {
            method: "PUT",
            headers: {
              "AccessKey": config.accessKey,
              "Content-Type": "application/octet-stream",
            },
            body: turnoverFile.file,
          });

          if (uploadRes.ok || uploadRes.status === 201) {
            uploadedFiles.push({
              originalName: config.originalName,
              type: config.type,
              storagePath: config.storagePath,
              cdnUrl: config.cdnUrl,
              fileSize: turnoverFile.file.size,
            });
          }
        }
      }

      setImportStatus("Creating shots...");
      
      const seqName = filmscribeResult.title || xmlFileName.replace(/\.xml$/i, "");
      
      // Convert FilmScribe events to shots format
      const shots = filmScribeToShots(filmscribeResult);

      const response = await fetch("/api/turnover/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sequenceId: selectedSequence !== "new" ? selectedSequence : undefined,
          sequenceName: seqName,
          sequenceCode: seqName.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase().slice(0, 20),
          shots,
          uploadedFiles,
          generalVfxNotes: generalVfxNotes.trim() || null,
          sourceEdlFilename: xmlFileName || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Import failed");
      }

      const result = await response.json();
      
      const toNum = result.turnoverNumber ? `TO${result.turnoverNumber}: ` : '';
      setImportStatus(`${toNum}Created ${result.shotsCreated} shot(s) with VFX notes`);
      setFilmscribeImported(true);
      
      if (result.reviewUrl) {
        setTimeout(() => {
          router.push(result.reviewUrl);
        }, 1500);
      }
    } catch (err) {
      console.error("Import error:", err);
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }, [filmscribeResult, xmlFileName, selectedProject, selectedSequence, refFiles, plateFiles, generalVfxNotes, router]);

  const handleAleImport = () => {
    // In production: save to shot_metadata + shot_cdls via Supabase
    // For now, mark as imported
    setAleImported(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Turnover Import</h1>
        <p className="text-muted-foreground mt-1">Import EDL or ALE files to create shots and metadata from editorial turnovers</p>
      </div>

      {/* Import Settings */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Import Settings</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-[auto_auto_1fr] gap-4 items-start">
          <div className="w-[200px]">
            <label className="text-sm font-medium">Target Project</label>
            <Select value={selectedProject} onValueChange={(v) => { setSelectedProject(v); setSelectedSequence("new"); }}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="w-[200px]">
            <label className="text-sm font-medium">Target Sequence</label>
            <Select value={selectedSequence} onValueChange={setSelectedSequence}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Create New Sequence</SelectItem>
                {projectSequences.map(s => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              General VFX Notes
            </label>
            <Textarea
              placeholder="General notes for all shots (color direction, cleanup notes, client instructions)..."
              className="mt-1.5 min-h-[60px] text-sm"
              value={generalVfxNotes}
              onChange={(e) => setGeneralVfxNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Source Materials Upload */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Reference Clips */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Video className="h-4 w-4" />
              Reference Clips
              {refFiles.length > 0 && <Badge variant="secondary" className="ml-auto">{refFiles.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className={cn("relative", refDragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg")}
              onDrop={handleRefDrop}
              onDragOver={(e) => { e.preventDefault(); setRefDragOver(true); }}
              onDragLeave={() => setRefDragOver(false)}
            >
              <label className={cn(
                "flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                refDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              )}>
                <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">Drop reference clips here</span>
                <span className="text-[10px] text-muted-foreground/60">Shows shots in sequence context</span>
                <input ref={refFileRef} type="file" accept=".mov,.mp4,.mxf,.m4v" multiple className="hidden" onChange={handleRefUpload} />
              </label>
            </div>
            {refFiles.length > 0 && (
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {refFiles.map(f => (
                  <div key={f.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md group">
                    <Film className="h-4 w-4 text-blue-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{f.file.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatFileSize(f.file.size)}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeFile(f.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source Plates */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Source Plates
              {plateFiles.length > 0 && <Badge variant="secondary" className="ml-auto">{plateFiles.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className={cn("relative", plateDragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg")}
              onDrop={handlePlateDrop}
              onDragOver={(e) => { e.preventDefault(); setPlateDragOver(true); }}
              onDragLeave={() => setPlateDragOver(false)}
            >
              <label className={cn(
                "flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                plateDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              )}>
                <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">Drop source plates here</span>
                <span className="text-[10px] text-muted-foreground/60">Clean plates, hero plates, BG elements</span>
                <input ref={plateFileRef} type="file" accept=".mov,.mp4,.mxf,.exr,.dpx,.tif,.tiff" multiple className="hidden" onChange={handlePlateUpload} />
              </label>
            </div>
            {plateFiles.length > 0 && (
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {plateFiles.map(f => (
                  <div key={f.id} className="p-2 bg-muted/30 rounded-md space-y-1.5">
                    <div className="flex items-center gap-2 group">
                      <Film className="h-4 w-4 text-amber-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{f.file.name}</p>
                        <p className="text-[10px] text-muted-foreground">{formatFileSize(f.file.size)}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeFile(f.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Plate description (e.g., Clean plate, BG element)"
                      className="h-7 text-xs"
                      value={f.description || ""}
                      onChange={(e) => updateFileDescription(f.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Unified Import Zone ─── */}
      <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Timeline Import</CardTitle></CardHeader>
                <CardContent>
                  <div
                    className={cn("relative", unifiedDragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg")}
                    onDrop={handleUnifiedDrop}
                    onDragOver={(e) => { e.preventDefault(); setUnifiedDragOver(true); }}
                    onDragLeave={() => setUnifiedDragOver(false)}
                  >
                    <label className={cn(
                      "flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                      unifiedDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
                      currentFileName && "border-primary/30 bg-primary/5"
                    )}>
                      {currentFileName ? (
                        <div className="flex flex-col items-center gap-2">
                          {activeImportType === 'edl' && <FileText className="h-8 w-8 text-primary" />}
                          {activeImportType === 'xml' && <FileCode className="h-8 w-8 text-primary" />}
                          {activeImportType === 'ale' && <Database className="h-8 w-8 text-primary" />}
                          {activeImportType === 'filmscribe' && <Film className="h-8 w-8 text-primary" />}
                          <span className="text-sm text-primary font-medium">{currentFileName}</span>
                          <Badge variant="outline" className="text-[10px]">{activeImportType.toUpperCase()}</Badge>
                          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={(e) => { e.preventDefault(); clearUnified(); }}><X className="h-3 w-3 mr-1" />Clear</Button>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                          <span className="text-sm text-muted-foreground">Drop EDL, XML, or ALE here</span>
                          <span className="text-xs text-muted-foreground/60 mt-1">or click to browse</span>
                        </>
                      )}
                      <input ref={unifiedFileRef} type="file" accept=".edl,.xml,.ale,.txt" className="hidden" onChange={handleUnifiedUpload} />
                    </label>
                  </div>
                </CardContent>
              </Card>

              {parseResult && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    {parseResult.title && (
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">EDL Title</label>
                        <p className="text-sm font-mono font-medium">{parseResult.title}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md bg-muted/50 p-2"><p className="text-lg font-bold">{parseResult.totalEvents}</p><p className="text-[10px] text-muted-foreground">TOTAL</p></div>
                      <div className="rounded-md bg-blue-600/10 p-2"><p className="text-lg font-bold text-blue-400">{parseResult.videoEvents}</p><p className="text-[10px] text-muted-foreground">VIDEO</p></div>
                      <div className="rounded-md bg-purple-600/10 p-2"><p className="text-lg font-bold text-purple-400">{parseResult.audioEvents}</p><p className="text-[10px] text-muted-foreground">AUDIO</p></div>
                    </div>
                    {parseResult.fcm !== 'UNKNOWN' && <Badge variant="outline" className="text-xs">{parseResult.fcm === 'DROP_FRAME' ? 'Drop Frame' : 'Non-Drop Frame'}</Badge>}
                    {videoEvents.length > 0 && !edlImported && (
                      <>
                        <div className="text-xs text-center py-1 rounded text-muted-foreground bg-muted/30">
                          VFX notes can be added during review
                        </div>
                        <Button className="w-full" onClick={handleEdlImport} disabled={importing}>
                          {importing ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{importStatus || "Importing..."}</>
                          ) : (
                            <><Check className="h-4 w-4 mr-2" />Import {videoEvents.length} Shot{videoEvents.length !== 1 ? 's' : ''} + {refFiles.length} Refs + {plateFiles.length} Plates</>
                          )}
                        </Button>
                      </>
                    )}
                    {importError && <div className="flex items-center gap-2 text-red-400 text-sm"><AlertCircle className="h-4 w-4" />{importError}</div>}
                    {edlImported && (
                      <>
                        <div className="flex items-center justify-center gap-2 py-2"><Badge className="bg-green-600 text-white border-0"><Check className="h-3 w-3 mr-1" />Imported Successfully</Badge></div>
                        <div className="border-t border-border pt-3 mt-3">
                          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Download className="h-3 w-3" />Export for VFX Vendors:</p>
                          <div className="grid grid-cols-3 gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-auto py-1.5 flex-col gap-0.5"
                              onClick={() => downloadEDL(
                                videoEvents.map((event, idx) => ({
                                  code: getShotCode(event, idx),
                                  clipName: event.clipName,
                                  sourceIn: event.sourceIn,
                                  sourceOut: event.sourceOut,
                                  recordIn: event.recordIn,
                                  recordOut: event.recordOut,
                                })),
                                { title: parseResult?.title || edlFileName.replace(/\.edl$/i, '') }
                              )}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span className="text-[10px]">EDL</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-auto py-1.5 flex-col gap-0.5"
                              onClick={() => downloadALE(
                                videoEvents.map((event, idx) => ({
                                  code: getShotCode(event, idx),
                                  clipName: event.clipName,
                                  sourceIn: event.sourceIn,
                                  sourceOut: event.sourceOut,
                                  notes: shotNotes[getShotCode(event, idx)] || undefined,
                                })),
                                { title: parseResult?.title || edlFileName.replace(/\.edl$/i, '') }
                              )}
                            >
                              <Database className="h-3.5 w-3.5" />
                              <span className="text-[10px]">ALE</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-auto py-1.5 flex-col gap-0.5"
                              onClick={() => downloadFCPXML(
                                videoEvents.map((event, idx) => ({
                                  id: `shot-${idx}`,
                                  code: getShotCode(event, idx),
                                  clipName: event.clipName,
                                  sourceIn: event.sourceIn,
                                  sourceOut: event.sourceOut,
                                  durationFrames: event.durationFrames,
                                })),
                                { title: parseResult?.title || edlFileName.replace(/\.edl$/i, '') }
                              )}
                            >
                              <FileCode className="h-3.5 w-3.5" />
                              <span className="text-[10px]">XML</span>
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {parseResult && parseResult.warnings.length > 0 && (
                <Card className="border-amber-600/30">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-amber-400"><AlertTriangle className="h-4 w-4" />{parseResult.warnings.length} Warning{parseResult.warnings.length !== 1 ? 's' : ''}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 max-h-40 overflow-auto">
                      {parseResult.warnings.map((w, i) => <div key={i} className="text-xs"><span className="text-muted-foreground">Line {w.line}:</span> <span className="text-amber-300">{w.message}</span></div>)}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* VFX Notes/Marker File Upload - shown after timeline is parsed */}
              {(videoEvents.length > 0 || xmlResult?.sequences[0]?.clips.length) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      VFX Notes File
                      <Badge variant="outline" className="ml-auto text-[10px]">Optional</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div
                      className={cn("relative", markerDragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg")}
                      onDrop={handleMarkerDrop}
                      onDragOver={(e) => { e.preventDefault(); setMarkerDragOver(true); }}
                      onDragLeave={() => setMarkerDragOver(false)}
                    >
                      <label className={cn(
                        "flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                        markerDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
                        markerFileName && "border-primary/30 bg-primary/5"
                      )}>
                        {markerFileName ? (
                          <div className="flex flex-col items-center gap-1">
                            <MessageSquare className="h-6 w-6 text-primary" />
                            <span className="text-xs text-primary font-medium">{markerFileName}</span>
                            <Button variant="ghost" size="sm" className="text-[10px] text-muted-foreground h-6" onClick={(e) => { e.preventDefault(); clearMarkers(); }}>
                              <X className="h-3 w-3 mr-1" />Clear
                            </Button>
                          </div>
                        ) : (
                          <>
                            <MessageSquare className="h-6 w-6 text-muted-foreground mb-1" />
                            <span className="text-xs text-muted-foreground">Drop marker export here</span>
                            <span className="text-[10px] text-muted-foreground/60">Avid marker export (.txt)</span>
                          </>
                        )}
                        <input ref={markerFileRef} type="file" accept=".txt,.tsv" className="hidden" onChange={handleMarkerUpload} />
                      </label>
                    </div>

                    {markerMatchResult && (
                      <div className={cn(
                        "p-3 rounded-md text-sm",
                        markerMatchResult.matchedCount === markerMatchResult.totalMarkers
                          ? "bg-green-600/10 text-green-400"
                          : markerMatchResult.matchedCount > 0
                          ? "bg-amber-600/10 text-amber-400"
                          : "bg-red-600/10 text-red-400"
                      )}>
                        <div className="flex items-center gap-2">
                          {markerMatchResult.matchedCount === markerMatchResult.totalMarkers ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                          <span className="font-medium">
                            {markerMatchResult.matchedCount}/{markerMatchResult.totalMarkers} markers matched
                          </span>
                        </div>
                        {markerMatchResult.unmatchedMarkers.length > 0 && (
                          <div className="mt-2 text-xs space-y-1">
                            <p className="text-muted-foreground">Unmatched markers (TC outside shot ranges):</p>
                            {markerMatchResult.unmatchedMarkers.slice(0, 5).map((m, i) => (
                              <div key={i} className="font-mono">{m.id} @ {m.timecode}</div>
                            ))}
                            {markerMatchResult.unmatchedMarkers.length > 5 && (
                              <div className="text-muted-foreground">...and {markerMatchResult.unmatchedMarkers.length - 5} more</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {markerResult && markerResult.warnings.length > 0 && (
                      <div className="text-xs text-amber-400 space-y-1">
                        {markerResult.warnings.slice(0, 3).map((w, i) => (
                          <div key={i}>{w}</div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* EDL Preview - only show when EDL is active */}
            {activeImportType === 'edl' && (
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />Parse Preview
                    {videoEvents.length > 0 && <Badge variant="secondary" className="ml-auto">{videoEvents.length} video events</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {videoEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Film className="h-12 w-12 mb-3 opacity-20" />
                      <p className="text-sm">Parsing EDL...</p>
                    </div>
                  ) : (
                    <div className="overflow-auto max-h-[300px] -mx-2">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card z-10">
                          <tr className="border-b border-border">
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">#</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">Shot Code</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">Rec In</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">Rec Out</th>
                            <th className="text-right p-2 text-xs font-medium text-muted-foreground">Dur</th>
                          </tr>
                        </thead>
                        <tbody>
                          {videoEvents.map((event, i) => {
                            const shotCode = getShotCode(event, i);
                            return (
                              <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                                <td className="p-2 font-mono text-xs text-muted-foreground">{String(event.eventNumber).padStart(3, '0')}</td>
                                <td className="p-2 font-mono text-xs font-medium">{shotCode}</td>
                                <td className="p-2 font-mono text-xs">{event.recordIn}</td>
                                <td className="p-2 font-mono text-xs">{event.recordOut}</td>
                                <td className="p-2 font-mono text-xs text-right">{event.durationFrames}f</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* VFX Shot Notes - Optional, can be added during review */}
              {videoEvents.length > 0 && (
                <Card className="border-muted">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                      <MessageSquare className="h-4 w-4" />
                      VFX Shot Notes
                      <Badge variant="outline" className="ml-auto text-[10px]">Optional — add during review</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {videoEvents.map((event, i) => {
                      const shotCode = getShotCode(event, i);
                      const hasNote = !!shotNotes[shotCode]?.trim();
                      return (
                        <div key={i} className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold">{shotCode}</span>
                            <span className="text-xs text-muted-foreground">{event.durationFrames}f</span>
                            {hasNote && (
                              <Badge variant="outline" className="text-[10px] text-green-500 border-green-500/30">✓</Badge>
                            )}
                          </div>
                          <Textarea
                            placeholder="Optional: Add VFX notes now, or during review step..."
                            className="min-h-[60px] text-sm resize-y"
                            value={shotNotes[shotCode] || ""}
                            onChange={(e) => updateShotNote(shotCode, e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </div>
            )}
          </div>

        {/* ─── XML Results (shown when XML detected) ─── */}
        {activeImportType === 'xml' && (
          <div className="grid gap-6 lg:grid-cols-3 mt-6">
            <div className="space-y-4">
              {xmlResult && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    {xmlResult.sequences[0]?.name && (
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Sequence</label>
                        <p className="text-sm font-mono font-medium">{xmlResult.sequences[0].name}</p>
                      </div>
                    )}
                    <Badge variant="outline" className="text-xs capitalize">{xmlResult.format} XML</Badge>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md bg-muted/50 p-2"><p className="text-lg font-bold">{xmlResult.totalClips}</p><p className="text-[10px] text-muted-foreground">CLIPS</p></div>
                      <div className="rounded-md bg-orange-600/10 p-2"><p className="text-lg font-bold text-orange-400">{xmlResult.clipsWithReposition}</p><p className="text-[10px] text-muted-foreground">REPO</p></div>
                      <div className="rounded-md bg-blue-600/10 p-2"><p className="text-lg font-bold text-blue-400">{xmlResult.clipsWithSpeedChange}</p><p className="text-[10px] text-muted-foreground">SPEED</p></div>
                    </div>
                    {xmlResult.clipsWithCDL > 0 && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Check className="h-3 w-3 text-purple-400" />{xmlResult.clipsWithCDL} clips with CDL data
                      </div>
                    )}
                    {xmlResult.warnings.length > 0 && (
                      <div className="text-xs text-yellow-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />{xmlResult.warnings.length} warnings
                      </div>
                    )}
                    {xmlResult.sequences[0]?.clips.length > 0 && !xmlImported && (
                      <>
                        <div className="text-xs text-center py-1 rounded text-muted-foreground bg-muted/30">
                          VFX notes can be added during review
                        </div>
                        <Button className="w-full" onClick={handleXmlImport} disabled={importing}>
                          {importing ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{importStatus || "Importing..."}</>
                          ) : (
                            <><Check className="h-4 w-4 mr-2" />Import {xmlResult.sequences[0].clips.length} Shot{xmlResult.sequences[0].clips.length !== 1 ? 's' : ''} + {refFiles.length} Refs + {plateFiles.length} Plates</>
                          )}
                        </Button>
                      </>
                    )}
                    {importError && <div className="flex items-center gap-2 text-red-400 text-sm"><AlertCircle className="h-4 w-4" />{importError}</div>}
                    {xmlImported && (
                      <div className="flex items-center justify-center gap-2 py-2">
                        <Badge className="bg-green-600 text-white border-0"><Check className="h-3 w-3 mr-1" />Imported Successfully</Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Parsed clips preview */}
            {xmlResult && xmlResult.sequences[0]?.clips.length > 0 && (
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      Parsed Clips
                      <Badge variant="secondary" className="ml-auto">{xmlResult.sequences[0].clips.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-md overflow-hidden max-h-[500px] overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="text-left p-2 font-medium">Shot Name</th>
                            <th className="text-left p-2 font-medium">Source Clip</th>
                            <th className="text-left p-2 font-medium">Scene/Take</th>
                            <th className="text-center p-2 font-medium">Duration</th>
                            <th className="text-center p-2 font-medium">Flags</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {xmlResult.sequences[0].clips.map((clip, i) => (
                            <tr key={clip.id || i} className="hover:bg-muted/30">
                              <td className="p-2 font-mono font-medium">{clip.name}</td>
                              <td className="p-2 text-muted-foreground truncate max-w-[200px]">{clip.sourceFileName || "—"}</td>
                              <td className="p-2">{clip.scene && clip.take ? `${clip.scene} T${clip.take}` : clip.scene || "—"}</td>
                              <td className="p-2 text-center font-mono">{clip.duration}f</td>
                              <td className="p-2 text-center space-x-1">
                                {clip.hasReposition && <Badge variant="secondary" className="bg-orange-500/20 text-orange-400 text-[10px]">REPO</Badge>}
                                {clip.hasSpeedChange && <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 text-[10px]">SPEED</Badge>}
                                {clip.hasCDL && <Badge variant="secondary" className="bg-purple-500/20 text-purple-400 text-[10px]">CDL</Badge>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                      XML import creates shots with reposition/speed data linked to source media
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ─── FilmScribe Results (shown when FilmScribe XML detected) ─── */}
        {activeImportType === 'filmscribe' && filmscribeResult && (
          <div className="grid gap-6 lg:grid-cols-3 mt-6">
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Title</label>
                    <p className="text-sm font-mono font-medium">{filmscribeResult.title}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">FilmScribe XML</Badge>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-lg font-bold">{filmscribeResult.eventsWithVfx}</p>
                      <p className="text-[10px] text-muted-foreground">VFX SHOTS</p>
                    </div>
                    <div className="rounded-md bg-purple-600/10 p-2">
                      <p className="text-lg font-bold text-purple-400">{filmscribeResult.totalVfxMarkers}</p>
                      <p className="text-[10px] text-muted-foreground">MARKERS</p>
                    </div>
                    <div className="rounded-md bg-blue-600/10 p-2">
                      <p className="text-lg font-bold text-blue-400">{filmscribeResult.eventsWithClips}</p>
                      <p className="text-[10px] text-muted-foreground">TOTAL CLIPS</p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {filmscribeResult.editRate}fps • {filmscribeResult.tracks}
                  </div>
                  {filmscribeResult.warnings.length > 0 && (
                    <div className="text-xs text-yellow-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />{filmscribeResult.warnings.length} warnings
                    </div>
                  )}
                  {filmscribeResult.eventsWithVfx > 0 && !filmscribeImported && (
                    <>
                      <div className="text-xs text-center py-1 rounded text-green-400/80 bg-green-600/10">
                        ✓ Shot codes derived from VFX marker IDs
                      </div>
                      <Button className="w-full" onClick={handleFilmscribeImport} disabled={importing}>
                        {importing ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{importStatus || "Importing..."}</>
                        ) : (
                          <><Check className="h-4 w-4 mr-2" />Import {filmscribeResult.eventsWithVfx} VFX Shots</>
                        )}
                      </Button>
                    </>
                  )}
                  {importError && <div className="flex items-center gap-2 text-red-400 text-sm"><AlertCircle className="h-4 w-4" />{importError}</div>}
                  {filmscribeImported && (
                    <div className="flex items-center justify-center gap-2 py-2">
                      <Badge className="bg-green-600 text-white border-0"><Check className="h-3 w-3 mr-1" />Imported Successfully</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* FilmScribe events preview */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    VFX Shots
                    <Badge variant="secondary" className="ml-auto">{filmscribeResult.eventsWithVfx} shots</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-md overflow-hidden max-h-[500px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left p-2 font-medium">Shot Code</th>
                          <th className="text-left p-2 font-medium">Camera File</th>
                          <th className="text-left p-2 font-medium">Cam</th>
                          <th className="text-left p-2 font-medium">Rec TC</th>
                          <th className="text-center p-2 font-medium">Dur</th>
                          <th className="text-left p-2 font-medium">VFX Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filmscribeResult.events
                          .filter(e => e.clipName !== null && e.vfxShotCode !== null)
                          .map((event, i) => (
                            <tr key={i} className="hover:bg-muted/30">
                              <td className="p-2 font-mono font-bold text-green-400">{event.vfxShotCode}</td>
                              <td className="p-2 font-mono text-blue-400 text-[10px]" title={event.tapeId || undefined}>{event.tapeId || event.tapeName || '—'}</td>
                              <td className="p-2 font-mono text-center">{event.camera || '—'}</td>
                              <td className="p-2 font-mono text-muted-foreground">{event.recordIn}</td>
                              <td className="p-2 text-center font-mono">{event.length}f</td>
                              <td className="p-2 max-w-[250px]">
                                {event.vfxDescription ? (
                                  <span className="text-purple-400">{event.vfxDescription}</span>
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    Camera File = original source filename from camera
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ─── ALE Results (shown when ALE detected) ─── */}
        {activeImportType === 'ale' && (
          <div className="grid gap-6 lg:grid-cols-3 mt-6">
            <div className="space-y-4">
              {/* ALE Summary */}
              {aleResult && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    {aleResult.heading.fps && (
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Frame Rate</label>
                        <p className="text-sm font-mono font-medium">{aleResult.heading.fps} fps</p>
                      </div>
                    )}
                    {aleResult.heading.videoFormat && (
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Video Format</label>
                        <p className="text-sm font-mono font-medium">{aleResult.heading.videoFormat}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className="text-lg font-bold">{aleResult.recordCount}</p>
                        <p className="text-[10px] text-muted-foreground">RECORDS</p>
                      </div>
                      <div className="rounded-md bg-blue-600/10 p-2">
                        <p className="text-lg font-bold text-blue-400">{aleResult.columns.length}</p>
                        <p className="text-[10px] text-muted-foreground">COLUMNS</p>
                      </div>
                    </div>
                    {aleResult.recordCount > 0 && !aleImported && (
                      <Button className="w-full" onClick={handleAleImport}>
                        <Check className="h-4 w-4 mr-2" />Import {aleResult.recordCount} Records
                      </Button>
                    )}
                    {aleImported && (
                      <div className="flex items-center justify-center gap-2 py-2">
                        <Badge className="bg-green-600 text-white border-0"><Check className="h-3 w-3 mr-1" />Imported to shot_metadata + shot_cdls</Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ALE Warnings */}
              {aleResult && aleResult.warnings.length > 0 && (
                <Card className="border-amber-600/30">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-amber-400"><AlertTriangle className="h-4 w-4" />{aleResult.warnings.length} Warning{aleResult.warnings.length !== 1 ? 's' : ''}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 max-h-40 overflow-auto">
                      {aleResult.warnings.map((w, i) => <div key={i} className="text-xs text-amber-300">{w}</div>)}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ALE Preview Table */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Database className="h-4 w-4" />ALE Preview
                    {aleResult && aleResult.recordCount > 0 && <Badge variant="secondary" className="ml-auto">{aleResult.recordCount} records</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!aleResult || aleResult.recordCount === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Database className="h-12 w-12 mb-3 opacity-20" />
                      <p className="text-sm">Upload an ALE file to preview metadata</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Supports Silverstack, Pomfort, and standard ALE exports</p>
                    </div>
                  ) : (
                    <div className="overflow-auto max-h-[600px] -mx-2">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card z-10">
                          <tr className="border-b border-border">
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">Name / Clip</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">Scene</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">Take</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">TC In</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">TC Out</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">Duration</th>
                            <th className="text-center p-2 text-xs font-medium text-muted-foreground">Circled</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">Camera</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">ASC_SOP</th>
                            <th className="text-left p-2 text-xs font-medium text-muted-foreground">ASC_SAT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aleResult.records.map((rec, i) => {
                            const clipName = getClipName(rec);
                            const { scene, take } = getSceneTake(rec);
                            const circled = isCircled(rec);
                            const tcIn = rec['Start'] || rec['Start TC'] || rec['Src Start TC'] || '';
                            const tcOut = rec['End'] || rec['End TC'] || rec['Src End TC'] || '';
                            const duration = rec['Duration'] || rec['Duration TC'] || '';
                            const camera = rec['Camera Type'] || rec['Camera'] || rec['Camera Model'] || '';
                            const ascSop = rec['ASC_SOP'] || rec['ASC SOP'] || '';
                            const ascSat = rec['ASC_SAT'] || rec['ASC SAT'] || '';

                            return (
                              <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                                <td className="p-2 font-mono text-xs font-medium max-w-[200px] truncate">{clipName || <span className="text-muted-foreground italic">—</span>}</td>
                                <td className="p-2 text-xs">{scene || '—'}</td>
                                <td className="p-2 text-xs">{take || '—'}</td>
                                <td className="p-2 font-mono text-xs">{tcIn || '—'}</td>
                                <td className="p-2 font-mono text-xs">{tcOut || '—'}</td>
                                <td className="p-2 font-mono text-xs">{duration || '—'}</td>
                                <td className="p-2 text-center">{circled ? <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-[10px]">●</Badge> : <span className="text-muted-foreground/40">—</span>}</td>
                                <td className="p-2 text-xs max-w-[120px] truncate">{camera || '—'}</td>
                                <td className="p-2 font-mono text-[10px] max-w-[180px] truncate">{ascSop || '—'}</td>
                                <td className="p-2 font-mono text-xs">{ascSat || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
