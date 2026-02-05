"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Pencil,
  X,
  MessageSquare,
  Loader2,
  Check
} from "lucide-react";
import { AnnotationCanvas } from "./annotation-canvas";

interface Annotation {
  id: string;
  frame_number: number;
  timecode?: string;
  drawing_data: string;
  comment?: string;
  author_id?: string;
  created_at: string;
}

type AnnotationSource = 
  | { type: 'version'; id: string }
  | { type: 'ref'; id: string }
  | { type: 'shotRef'; id: string }
  | { type: 'plate'; id: string };

interface AnnotatedPlayerProps {
  videoId?: string;
  hlsUrl?: string;
  /** @deprecated Use source prop instead */
  versionId?: string;
  /** Annotation source - version, ref, or plate */
  source?: AnnotationSource;
  poster?: string;
  className?: string;
  fps?: number; // Frames per second, default 24
}

export function AnnotatedPlayer({
  videoId,
  hlsUrl,
  versionId,
  source,
  poster,
  className,
  fps = 24,
}: AnnotatedPlayerProps) {
  // Support legacy versionId prop
  const annotationSource: AnnotationSource = source || { type: 'version', id: versionId! };
  const sourceParam = `${annotationSource.type}Id=${annotationSource.id}`;
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const BUNNY_STREAM_CDN = process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN || "";
  const streamUrl = hlsUrl || (videoId && BUNNY_STREAM_CDN 
    ? `${BUNNY_STREAM_CDN}/${videoId}/playlist.m3u8` 
    : null);

  // Calculate frame from time
  const timeToFrame = (time: number) => Math.floor(time * fps);
  
  // Calculate time from frame
  const frameToTime = (frame: number) => frame / fps;

  // Format timecode (HH:MM:SS:FF)
  const formatTimecode = (time: number) => {
    const totalFrames = Math.floor(time * fps);
    const frames = totalFrames % fps;
    const totalSeconds = Math.floor(time);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  };

  // Load annotations for this source (version, ref, or plate)
  useEffect(() => {
    const loadAnnotations = async () => {
      try {
        const res = await fetch(`/api/annotations?${sourceParam}`);
        if (res.ok) {
          const data = await res.json();
          setAnnotations(data);
        }
      } catch (err) {
        console.error("Failed to load annotations:", err);
      }
    };
    loadAnnotations();
  }, [sourceParam]);

  // Track video dimensions
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateDimensions = () => {
      setDimensions({
        width: video.clientWidth,
        height: video.clientHeight,
      });
    };

    video.addEventListener("loadedmetadata", updateDimensions);
    window.addEventListener("resize", updateDimensions);
    updateDimensions();

    return () => {
      video.removeEventListener("loadedmetadata", updateDimensions);
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  // Track current time and frame
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setCurrentFrame(timeToFrame(video.currentTime));
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [fps]);

  // Check for annotation at current frame
  useEffect(() => {
    if (isAnnotating) return;
    
    const annotation = annotations.find(a => a.frame_number === currentFrame);
    setCurrentAnnotation(annotation || null);
  }, [currentFrame, annotations, isAnnotating]);

  // Play/pause
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Frame step
  const stepFrame = (direction: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    setIsPlaying(false);
    const newTime = Math.max(0, Math.min(duration, video.currentTime + (direction / fps)));
    video.currentTime = newTime;
  };

  // Jump frames
  const jumpFrames = (frames: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    setIsPlaying(false);
    const newTime = Math.max(0, Math.min(duration, video.currentTime + (frames / fps)));
    video.currentTime = newTime;
  };

  // Start annotating
  const startAnnotating = () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      setIsPlaying(false);
    }
    setIsAnnotating(true);
    setComment("");
  };

  // Cancel annotation
  const cancelAnnotation = () => {
    setIsAnnotating(false);
    setComment("");
  };

  // Save annotation
  const saveAnnotation = async (drawingData: string) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_type: annotationSource.type,
          source_id: annotationSource.id,
          frame_number: currentFrame,
          timecode: formatTimecode(currentTime),
          drawing_data: drawingData,
          comment: comment || null,
        }),
      });

      if (res.ok) {
        const newAnnotation = await res.json();
        setAnnotations(prev => [...prev, newAnnotation]);
        setIsAnnotating(false);
        setComment("");
      } else {
        console.error("Failed to save annotation");
      }
    } catch (err) {
      console.error("Failed to save annotation:", err);
    }
    setIsSaving(false);
  };

  // Delete annotation
  const deleteAnnotation = async (annotationId: string) => {
    try {
      const res = await fetch(`/api/annotations/${annotationId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAnnotations(prev => prev.filter(a => a.id !== annotationId));
        setCurrentAnnotation(null);
      }
    } catch (err) {
      console.error("Failed to delete annotation:", err);
    }
  };

  // Jump to annotation
  const jumpToAnnotation = (annotation: Annotation) => {
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    setIsPlaying(false);
    video.currentTime = frameToTime(annotation.frame_number);
  };

  if (!streamUrl) {
    return (
      <div className={cn("relative aspect-video bg-zinc-900 rounded-lg flex items-center justify-center", className)}>
        <p className="text-muted-foreground">No video available</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Player container */}
      <div ref={containerRef} className="relative aspect-video bg-black rounded-lg overflow-hidden">
        {/* Video */}
        <video
          ref={videoRef}
          className="w-full h-full"
          src={streamUrl}
          poster={poster}
          playsInline
          onClick={togglePlay}
        />

        {/* Annotation overlay (read-only display) */}
        {currentAnnotation && !isAnnotating && dimensions.width > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            <AnnotationCanvas
              width={dimensions.width}
              height={dimensions.height}
              initialData={currentAnnotation.drawing_data}
              readOnly
            />
          </div>
        )}

        {/* Annotation drawing mode */}
        {isAnnotating && dimensions.width > 0 && (
          <div className="absolute inset-0 bg-black/30">
            <AnnotationCanvas
              width={dimensions.width}
              height={dimensions.height}
              onSave={saveAnnotation}
            />
            
            {/* Comment input */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-96 z-20">
              <Textarea
                placeholder="Add a comment (optional)..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="bg-zinc-900/90 border-zinc-700 text-white resize-none"
                rows={2}
              />
            </div>
            
            {/* Cancel button */}
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-32 z-20"
              onClick={cancelAnnotation}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        )}

        {/* Annotation indicator */}
        {currentAnnotation && !isAnnotating && (
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500">
              <MessageSquare className="h-3 w-3 mr-1" />
              Note at frame {currentAnnotation.frame_number}
            </Badge>
            <Button
              variant="destructive"
              size="icon"
              className="h-6 w-6"
              onClick={() => deleteAnnotation(currentAnnotation.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Comment display */}
        {currentAnnotation?.comment && !isAnnotating && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 max-w-md bg-zinc-900/90 rounded-lg px-4 py-2 text-sm">
            {currentAnnotation.comment}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between bg-zinc-900 rounded-lg p-3">
        {/* Transport controls */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => jumpFrames(-10)} title="-10 frames">
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => stepFrame(-1)} title="-1 frame">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={togglePlay}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => stepFrame(1)} title="+1 frame">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => jumpFrames(10)} title="+10 frames">
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Timecode display */}
        <div className="flex items-center gap-4">
          <div className="font-mono text-sm">
            <span className="text-muted-foreground">TC:</span>{" "}
            <span className="text-white">{formatTimecode(currentTime)}</span>
          </div>
          <div className="font-mono text-sm">
            <span className="text-muted-foreground">Frame:</span>{" "}
            <span className="text-white">{currentFrame}</span>
          </div>
        </div>

        {/* Annotate button */}
        <Button 
          onClick={startAnnotating} 
          disabled={isAnnotating}
          variant={isAnnotating ? "secondary" : "default"}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Pencil className="h-4 w-4 mr-2" />
          )}
          Add Note
        </Button>
      </div>

      {/* Annotations list */}
      {annotations.length > 0 && (
        <div className="bg-zinc-900 rounded-lg p-4">
          <h3 className="text-sm font-medium mb-3">Frame Notes ({annotations.length})</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {annotations
              .sort((a, b) => a.frame_number - b.frame_number)
              .map((annotation) => (
                <button
                  key={annotation.id}
                  onClick={() => jumpToAnnotation(annotation)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md hover:bg-zinc-800 transition-colors",
                    currentFrame === annotation.frame_number && "bg-zinc-800 ring-1 ring-yellow-500/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground">
                      {annotation.timecode || `Frame ${annotation.frame_number}`}
                    </span>
                    {currentFrame === annotation.frame_number && (
                      <Check className="h-3 w-3 text-yellow-500" />
                    )}
                  </div>
                  {annotation.comment && (
                    <p className="text-sm text-white mt-1 truncate">{annotation.comment}</p>
                  )}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AnnotatedPlayer;
