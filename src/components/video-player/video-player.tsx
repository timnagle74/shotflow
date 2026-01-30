"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import videojs from 'video.js';
import Player from 'video.js/dist/types/player';
import 'video.js/dist/video-js.css';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Maximize,
  ChevronLeft,
  ChevronRight,
  Type,
  RatioIcon,
  Settings,
} from 'lucide-react';
import {
  VideoPlayerProps,
  BurnInSettings,
  AspectRatio,
  ASPECT_RATIOS,
  DEFAULT_BURN_IN_SETTINGS,
  BurnInPosition,
} from './types';

function formatTimecode(seconds: number, frameRate: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * frameRate);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Helper to get Bunny Stream CDN URL
const BUNNY_STREAM_CDN = typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN || 'https://vz-3b0f7864-a89.b-cdn.net')
  : '';

export function VideoPlayer({
  src,
  hlsUrl,
  bunnyVideoId,
  poster,
  shotCode = 'SHOT_0000',
  projectName = 'Project',
  clientName = 'Client',
  watermarkText = 'CONFIDENTIAL',
  frameRate = 24,
  frameStart = 1001,
  clientMode = false,
  showBurnInControls = true,
  showAspectRatioControls = true,
  onFrameChange,
  className,
}: VideoPlayerProps) {
  // Determine the video source - prioritize HLS for Bunny Stream
  const videoSource = React.useMemo(() => {
    if (hlsUrl) return hlsUrl;
    if (bunnyVideoId && BUNNY_STREAM_CDN) {
      return `${BUNNY_STREAM_CDN}/${bunnyVideoId}/playlist.m3u8`;
    }
    return src;
  }, [src, hlsUrl, bunnyVideoId]);

  const isHLS = videoSource?.includes('.m3u8');
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(frameStart);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('none');
  const [burnIns, setBurnIns] = useState<BurnInSettings>(() => {
    // Default settings - client mode has more watermarks on
    if (clientMode) {
      return {
        ...DEFAULT_BURN_IN_SETTINGS,
        watermark: { enabled: true, position: 'center' },
        clientName: { enabled: true, position: 'bottom-right' },
      };
    }
    return DEFAULT_BURN_IN_SETTINGS;
  });

  // Track if we were playing before source change
  const wasPlayingRef = useRef(false);

  // Initialize video.js player (only once)
  useEffect(() => {
    if (!videoRef.current || playerRef.current) return;

    // Ensure we have a video element
    const videoElement = document.createElement('video-js');
    videoElement.classList.add('vjs-big-play-centered', 'vjs-fluid');
    videoRef.current.appendChild(videoElement);

    const player = videojs(videoElement, {
      controls: false, // We use custom controls
      responsive: true,
      fluid: true,
      preload: 'auto',
      sources: [],
      poster,
      html5: {
        vhs: {
          overrideNative: true, // Better HLS handling
        },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
    });

    player.on('play', () => setIsPlaying(true));
    player.on('pause', () => setIsPlaying(false));
    player.on('timeupdate', () => {
      const time = player.currentTime() || 0;
      setCurrentTime(time);
      const frame = frameStart + Math.floor(time * frameRate);
      setCurrentFrame(frame);
      onFrameChange?.(frame);
    });
    player.on('loadedmetadata', () => {
      setDuration(player.duration() || 0);
      // Auto-play if we were playing before source change
      if (wasPlayingRef.current) {
        player.play();
        wasPlayingRef.current = false;
      }
    });

    playerRef.current = player;

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [poster, frameRate, frameStart, onFrameChange]);

  // Update source when it changes (without recreating player)
  useEffect(() => {
    if (!playerRef.current || !videoSource) return;
    
    // Remember if we were playing
    wasPlayingRef.current = isPlaying;
    
    const sourceType = isHLS ? 'application/x-mpegURL' : 'video/mp4';
    playerRef.current.src({ src: videoSource, type: sourceType });
  }, [videoSource, isHLS]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!playerRef.current) return;
      
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (isPlaying) playerRef.current.pause();
          else playerRef.current.play();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          stepFrame(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          stepFrame(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          stepFrame(-10);
          break;
        case 'ArrowDown':
          e.preventDefault();
          stepFrame(10);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, frameRate]);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    if (isPlaying) playerRef.current.pause();
    else playerRef.current.play();
  }, [isPlaying]);

  const stepFrame = useCallback((frames: number) => {
    if (!playerRef.current) return;
    const frameDuration = 1 / frameRate;
    const newTime = Math.max(0, Math.min(duration, currentTime + frames * frameDuration));
    playerRef.current.currentTime(newTime);
  }, [frameRate, currentTime, duration]);

  const seekTo = useCallback((time: number) => {
    if (!playerRef.current) return;
    playerRef.current.currentTime(time);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!videoRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoRef.current.requestFullscreen();
    }
  }, []);

  const toggleBurnIn = useCallback((key: keyof BurnInSettings) => {
    setBurnIns(prev => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }));
  }, []);

  const setBurnInPosition = useCallback((key: keyof BurnInSettings, position: BurnInPosition) => {
    setBurnIns(prev => ({
      ...prev,
      [key]: { ...prev[key], position },
    }));
  }, []);

  // Render burn-in text at a position
  const renderBurnIn = (position: BurnInPosition) => {
    const items: { key: string; text: string }[] = [];
    
    if (burnIns.shotCode.enabled && burnIns.shotCode.position === position) {
      items.push({ key: 'shotCode', text: shotCode });
    }
    if (burnIns.frameNumber.enabled && burnIns.frameNumber.position === position) {
      items.push({ key: 'frameNumber', text: `F: ${currentFrame}` });
    }
    if (burnIns.timecode.enabled && burnIns.timecode.position === position) {
      items.push({ key: 'timecode', text: formatTimecode(currentTime, frameRate) });
    }
    if (burnIns.projectName.enabled && burnIns.projectName.position === position) {
      items.push({ key: 'projectName', text: projectName });
    }
    if (burnIns.date.enabled && burnIns.date.position === position) {
      items.push({ key: 'date', text: new Date().toLocaleDateString() });
    }
    if (burnIns.watermark.enabled && burnIns.watermark.position === position) {
      items.push({ key: 'watermark', text: watermarkText });
    }
    if (burnIns.clientName.enabled && burnIns.clientName.position === position) {
      items.push({ key: 'clientName', text: clientName });
    }

    if (items.length === 0) return null;

    const isCenter = position === 'center';
    
    return (
      <div className={cn(
        "absolute pointer-events-none select-none",
        position === 'top-left' && "top-3 left-3",
        position === 'top-center' && "top-3 left-1/2 -translate-x-1/2",
        position === 'top-right' && "top-3 right-3",
        position === 'bottom-left' && "bottom-16 left-3",
        position === 'bottom-center' && "bottom-16 left-1/2 -translate-x-1/2",
        position === 'bottom-right' && "bottom-16 right-3",
        position === 'center' && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
      )}>
        {items.map(item => (
          <div
            key={item.key}
            className={cn(
              "font-mono text-white/80 text-shadow",
              isCenter ? "text-2xl md:text-4xl font-bold opacity-30" : "text-xs md:text-sm bg-black/50 px-2 py-0.5 rounded mb-1",
            )}
            style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
          >
            {item.text}
          </div>
        ))}
      </div>
    );
  };

  // Calculate aspect ratio overlay dimensions
  const getAspectRatioMask = () => {
    if (aspectRatio === 'none') return null;
    
    const info = ASPECT_RATIOS[aspectRatio];
    const videoAspect = 16 / 9; // Assume 16:9 video
    const targetAspect = info.ratio;

    if (targetAspect >= videoAspect) {
      // Letterbox (bars top/bottom)
      const heightPercent = (videoAspect / targetAspect) * 100;
      const barHeight = (100 - heightPercent) / 2;
      return { type: 'letterbox', barHeight };
    } else {
      // Pillarbox (bars left/right)
      const widthPercent = (targetAspect / videoAspect) * 100;
      const barWidth = (100 - widthPercent) / 2;
      return { type: 'pillarbox', barWidth };
    }
  };

  const aspectMask = getAspectRatioMask();

  return (
    <div className={cn("relative bg-black rounded-lg overflow-hidden group", className)}>
      {/* Video Container */}
      <div ref={videoRef} className="relative w-full aspect-video" />

      {/* Aspect Ratio Overlay */}
      {aspectMask && (
        <>
          {aspectMask.type === 'letterbox' && (
            <>
              <div
                className="absolute top-0 left-0 right-0 bg-black/70 pointer-events-none border-b border-yellow-500/50"
                style={{ height: `${aspectMask.barHeight}%` }}
              />
              <div
                className="absolute bottom-0 left-0 right-0 bg-black/70 pointer-events-none border-t border-yellow-500/50"
                style={{ height: `${aspectMask.barHeight}%` }}
              />
            </>
          )}
          {aspectMask.type === 'pillarbox' && (
            <>
              <div
                className="absolute top-0 left-0 bottom-0 bg-black/70 pointer-events-none border-r border-yellow-500/50"
                style={{ width: `${aspectMask.barWidth}%` }}
              />
              <div
                className="absolute top-0 right-0 bottom-0 bg-black/70 pointer-events-none border-l border-yellow-500/50"
                style={{ width: `${aspectMask.barWidth}%` }}
              />
            </>
          )}
          <div className="absolute top-2 right-2 pointer-events-none">
            <Badge variant="outline" className="bg-black/60 text-yellow-400 border-yellow-500/50 text-[10px]">
              {ASPECT_RATIOS[aspectRatio].label}
            </Badge>
          </div>
        </>
      )}

      {/* Burn-ins */}
      {renderBurnIn('top-left')}
      {renderBurnIn('top-center')}
      {renderBurnIn('top-right')}
      {renderBurnIn('bottom-left')}
      {renderBurnIn('bottom-center')}
      {renderBurnIn('bottom-right')}
      {renderBurnIn('center')}

      {/* No video placeholder */}
      {!videoSource && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <div className="text-center text-muted-foreground">
            <Play className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No video loaded</p>
          </div>
        </div>
      )}

      {/* Custom Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Progress Bar */}
        <div
          className="w-full h-1 bg-white/20 rounded-full mb-3 cursor-pointer group/progress"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            seekTo(percent * duration);
          }}
        >
          <div
            className="h-full bg-purple-500 rounded-full relative"
            style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          {/* Left Controls */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => stepFrame(-10)}>
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => stepFrame(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/10" onClick={togglePlay}>
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => stepFrame(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => stepFrame(10)}>
              <SkipForward className="h-4 w-4" />
            </Button>

            <div className="ml-3 text-xs text-white/70 font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
            <div className="ml-2 text-xs text-white/50 font-mono">
              F:{currentFrame}
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1">
            {/* Burn-in Controls */}
            {showBurnInControls && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10">
                    <Type className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Burn-ins</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={burnIns.shotCode.enabled}
                    onCheckedChange={() => toggleBurnIn('shotCode')}
                  >
                    Shot Code
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={burnIns.frameNumber.enabled}
                    onCheckedChange={() => toggleBurnIn('frameNumber')}
                  >
                    Frame Number
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={burnIns.timecode.enabled}
                    onCheckedChange={() => toggleBurnIn('timecode')}
                  >
                    Timecode
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={burnIns.projectName.enabled}
                    onCheckedChange={() => toggleBurnIn('projectName')}
                  >
                    Project Name
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={burnIns.date.enabled}
                    onCheckedChange={() => toggleBurnIn('date')}
                  >
                    Date
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={burnIns.watermark.enabled}
                    onCheckedChange={() => toggleBurnIn('watermark')}
                  >
                    Watermark
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={burnIns.clientName.enabled}
                    onCheckedChange={() => toggleBurnIn('clientName')}
                  >
                    Client Name
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Aspect Ratio Controls */}
            {showAspectRatioControls && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10">
                    <RatioIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Aspect Ratio Guide</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatio)}>
                    <DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="2.39:1">2.39:1 (Scope)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="1.85:1">1.85:1 (Flat)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="16:9">16:9 (HD)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="4:3">4:3 (Academy)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="1:1">1:1 (Square)</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Fullscreen */}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={toggleFullscreen}>
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Keyboard Hint (shown briefly) */}
      <div className="absolute top-3 left-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="text-[10px] text-white/40 font-mono space-y-0.5">
          <div>SPACE: Play/Pause</div>
          <div>←/→: ±1 frame</div>
          <div>↑/↓: ±10 frames</div>
          <div>F: Fullscreen</div>
        </div>
      </div>
    </div>
  );
}
