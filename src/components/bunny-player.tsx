"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, RefreshCw, Play, ExternalLink } from "lucide-react";

interface BunnyPlayerProps {
  /** Bunny Stream video ID (guid) */
  videoId?: string;
  /** Direct HLS URL (alternative to videoId) */
  hlsUrl?: string;
  /** Poster/thumbnail image URL */
  poster?: string;
  /** Video title for accessibility */
  title?: string;
  /** Whether to autoplay */
  autoplay?: boolean;
  /** Whether to loop */
  loop?: boolean;
  /** Whether to show controls */
  controls?: boolean;
  /** Whether to mute */
  muted?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when video is ready */
  onReady?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
  /** Use iframe embed instead of direct HLS */
  useEmbed?: boolean;
}

const BUNNY_STREAM_CDN = process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN || "";
const BUNNY_LIBRARY_ID = process.env.NEXT_PUBLIC_BUNNY_STREAM_LIBRARY_ID || "";

/**
 * Bunny Stream Player Component
 * 
 * Supports two modes:
 * 1. Direct HLS playback using video.js (default)
 * 2. Bunny iframe embed (set useEmbed=true)
 */
export function BunnyPlayer({
  videoId,
  hlsUrl,
  poster,
  title = "Video",
  autoplay = false,
  loop = false,
  controls = true,
  muted = false,
  className,
  onReady,
  onError,
  useEmbed = false,
}: BunnyPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine the HLS URL
  const streamUrl = hlsUrl || (videoId && BUNNY_STREAM_CDN 
    ? `${BUNNY_STREAM_CDN}/${videoId}/playlist.m3u8` 
    : null);

  // Determine the embed URL
  const embedUrl = videoId 
    ? `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID || '588859'}/${videoId}?autoplay=${autoplay}&loop=${loop}&muted=${muted}&preload=true`
    : null;

  // Handle iframe load
  const handleIframeLoad = () => {
    setIsLoading(false);
    onReady?.();
  };

  // Handle iframe error
  const handleIframeError = () => {
    const msg = "Failed to load video player";
    setError(msg);
    setIsLoading(false);
    onError?.(msg);
  };

  // Use iframe embed mode
  if (useEmbed && embedUrl) {
    return (
      <div className={cn("relative aspect-video bg-black rounded-lg overflow-hidden", className)}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-center p-4">
            <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
            <p className="text-sm text-red-400">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setError(null);
                setIsLoading(true);
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={embedUrl}
            loading="lazy"
            className="w-full h-full"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            title={title}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        )}
      </div>
    );
  }

  // Use direct HLS with native video element
  // For production, you'd want to use video.js with HLS.js
  if (!streamUrl) {
    return (
      <div className={cn("relative aspect-video bg-zinc-900 rounded-lg flex items-center justify-center", className)}>
        <div className="text-center text-muted-foreground">
          <Play className="h-12 w-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No video available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative aspect-video bg-black rounded-lg overflow-hidden", className)}>
      <video
        className="w-full h-full"
        src={streamUrl}
        poster={poster}
        autoPlay={autoplay}
        loop={loop}
        controls={controls}
        muted={muted}
        playsInline
        onLoadedData={() => {
          setIsLoading(false);
          onReady?.();
        }}
        onError={(e) => {
          const msg = "Failed to load video";
          setError(msg);
          setIsLoading(false);
          onError?.(msg);
        }}
      />
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

/**
 * Video Status Badge Component
 * Shows transcoding status for Bunny Stream videos
 */
interface VideoStatusBadgeProps {
  versionId: string;
  onReady?: () => void;
}

export function VideoStatusBadge({ versionId, onReady }: VideoStatusBadgeProps) {
  const [status, setStatus] = useState<{
    isReady: boolean;
    statusLabel: string;
  } | null>(null);
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const response = await fetch(`/api/versions/${versionId}/video-status`);
      if (response.ok) {
        const data = await response.json();
        setStatus({
          isReady: data.isReady,
          statusLabel: data.statusLabel,
        });
        if (data.isReady) {
          onReady?.();
        }
      }
    } catch (err) {
      console.error("Failed to check video status:", err);
    }
    setChecking(false);
  };

  useEffect(() => {
    checkStatus();
    // Poll every 10 seconds if not ready
    const interval = setInterval(() => {
      if (!status?.isReady) {
        checkStatus();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [versionId]);

  if (!status) {
    return checking ? (
      <Badge variant="outline" className="animate-pulse">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Checking...
      </Badge>
    ) : null;
  }

  if (status.isReady) {
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
        Ready
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
      {status.statusLabel}
    </Badge>
  );
}

/**
 * Download Button Component
 * Fetches signed URL and triggers download
 */
interface DownloadButtonProps {
  versionId: string;
  filename?: string;
  className?: string;
}

export function DownloadButton({ versionId, filename, className }: DownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/versions/${versionId}/download`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to get download URL");
      }

      const { downloadUrl } = await response.json();

      // Open download URL in new tab or trigger download
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename || "download";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }

    setLoading(false);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={loading}
      className={className}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <ExternalLink className="h-4 w-4 mr-2" />
      )}
      {error ? "Retry" : "Download ProRes"}
    </Button>
  );
}
