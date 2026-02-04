"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Check, X, MessageSquare, Clock, ChevronLeft, ChevronRight,
  Loader2, AlertCircle, CheckCircle2, XCircle, Film
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Version {
  id: string;
  version_code: string;
  preview_url: string | null;
  status: string;
  client_status: string | null;
  client_notes: string | null;
  shot: {
    code: string;
    description: string | null;
  };
}

interface ReviewSession {
  id: string;
  name: string;
  description: string | null;
  allow_comments: boolean;
  allow_approvals: boolean;
  watermark_text: string | null;
  project: {
    name: string;
  };
  versions: Version[];
}

interface Comment {
  id: string;
  version_id: string;
  comment_text: string;
  timecode_frame: number | null;
  author_name: string;
  is_client_comment: boolean;
  created_at: string;
}

export default function ClientReviewPage() {
  const params = useParams();
  const token = params.token as string;
  const videoRef = useRef<HTMLVideoElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<ReviewSession | null>(null);
  
  // Current version
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Player state
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Review state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load session data
  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch(`/api/review/${token}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Review session not found or expired");
          } else {
            setError("Failed to load review session");
          }
          return;
        }
        
        const data = await res.json();
        setSession(data.session);
        setComments(data.comments || []);
      } catch (err) {
        console.error("Load error:", err);
        setError("Failed to load review session");
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      loadSession();
    }
  }, [token]);

  // Video controls
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  }, [playing]);

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  }, []);

  const seekTo = useCallback((time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const skipFrames = useCallback((frames: number) => {
    if (!videoRef.current) return;
    const frameTime = 1 / 24; // Assuming 24fps
    const newTime = Math.max(0, Math.min(duration, currentTime + frames * frameTime));
    seekTo(newTime);
  }, [currentTime, duration, seekTo]);

  // Navigation
  const goToVersion = useCallback((index: number) => {
    if (!session) return;
    const newIndex = Math.max(0, Math.min(session.versions.length - 1, index));
    setCurrentIndex(newIndex);
    setPlaying(false);
    setCurrentTime(0);
  }, [session]);

  // Submit approval/rejection
  const submitReview = useCallback(async (status: 'approved' | 'rejected' | 'needs_changes') => {
    if (!session || !reviewerName.trim()) return;
    
    const version = session.versions[currentIndex];
    setSubmitting(true);
    
    try {
      await fetch(`/api/review/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionId: version.id,
          status,
          reviewerName: reviewerName.trim(),
        }),
      });
      
      // Update local state
      setSession(prev => {
        if (!prev) return prev;
        const updated = { ...prev };
        updated.versions = [...prev.versions];
        updated.versions[currentIndex] = {
          ...updated.versions[currentIndex],
          client_status: status,
        };
        return updated;
      });
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setSubmitting(false);
    }
  }, [session, currentIndex, reviewerName, token]);

  // Submit comment
  const submitComment = useCallback(async () => {
    if (!session || !newComment.trim() || !reviewerName.trim()) return;
    
    const version = session.versions[currentIndex];
    const frameNumber = Math.floor(currentTime * 24); // Assuming 24fps
    
    setSubmitting(true);
    
    try {
      const res = await fetch(`/api/review/${token}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionId: version.id,
          comment: newComment.trim(),
          authorName: reviewerName.trim(),
          timecodeFrame: frameNumber,
        }),
      });
      
      if (res.ok) {
        const { comment } = await res.json();
        setComments(prev => [...prev, comment]);
        setNewComment("");
        setShowCommentInput(false);
      }
    } catch (err) {
      console.error("Comment error:", err);
    } finally {
      setSubmitting(false);
    }
  }, [session, currentIndex, newComment, reviewerName, currentTime, token]);

  const formatTimecode = (seconds: number) => {
    const frames = Math.floor((seconds % 1) * 24);
    const secs = Math.floor(seconds % 60);
    const mins = Math.floor((seconds / 60) % 60);
    const hrs = Math.floor(seconds / 3600);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-white/50" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
        <AlertCircle className="h-16 w-16 text-red-500" />
        <h1 className="text-2xl font-bold">Review Unavailable</h1>
        <p className="text-white/60">{error || "Session not found"}</p>
      </div>
    );
  }

  const currentVersion = session.versions[currentIndex];
  const versionComments = comments.filter(c => 
    c.version_id === currentVersion?.id
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{session.name}</h1>
            <p className="text-white/60 text-sm">{session.project?.name}</p>
          </div>
          <div className="flex items-center gap-4">
            {!reviewerName ? (
              <Input
                placeholder="Enter your name to review"
                className="w-48 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
              />
            ) : (
              <Badge variant="outline" className="text-white border-white/30">
                Reviewing as: {reviewerName}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Main Player Area */}
        <div className="flex-1 p-6">
          {/* Shot Info */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-lg font-mono px-3 py-1 text-white border-white/30">
                {currentVersion?.shot?.code}
              </Badge>
              <span className="text-white/60">{currentVersion?.version_code}</span>
              {currentVersion?.client_status && (
                <Badge className={cn(
                  "capitalize",
                  currentVersion.client_status === 'approved' && "bg-green-600",
                  currentVersion.client_status === 'rejected' && "bg-red-600",
                  currentVersion.client_status === 'needs_changes' && "bg-amber-600",
                )}>
                  {currentVersion.client_status === 'needs_changes' ? 'Needs Changes' : currentVersion.client_status}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-white/60">
              <span>{currentIndex + 1} of {session.versions.length}</span>
            </div>
          </div>

          {/* Video Player */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            {currentVersion?.preview_url ? (
              <video
                ref={videoRef}
                src={currentVersion.preview_url}
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setPlaying(false)}
                muted={muted}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Film className="h-16 w-16 text-white/20" />
              </div>
            )}
            
            {/* Watermark */}
            {session.watermark_text && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-white/10 text-4xl font-bold rotate-[-30deg]">
                  {session.watermark_text}
                </span>
              </div>
            )}
          </div>

          {/* Player Controls */}
          <div className="mt-4 space-y-3">
            {/* Progress Bar */}
            <div 
              className="h-2 bg-white/10 rounded-full cursor-pointer relative"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                seekTo(percent * duration);
              }}
            >
              <div 
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
              {/* Comment markers */}
              {versionComments.filter(c => c.timecode_frame).map((comment, i) => (
                <div
                  key={i}
                  className="absolute top-0 w-1 h-full bg-yellow-500"
                  style={{ left: `${duration ? (comment.timecode_frame! / 24 / duration) * 100 : 0}%` }}
                  title={comment.comment_text}
                />
              ))}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => skipFrames(-1)}>
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={togglePlay}>
                  {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => skipFrames(1)}>
                  <SkipForward className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setMuted(!muted)}>
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <span className="font-mono text-sm text-white/60 ml-2">
                  {formatTimecode(currentTime)} / {formatTimecode(duration)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => goToVersion(currentIndex - 1)}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => goToVersion(currentIndex + 1)}
                  disabled={currentIndex === session.versions.length - 1}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Approval Buttons */}
          {session.allow_approvals && reviewerName && (
            <div className="mt-6 flex items-center gap-3">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => submitReview('approved')}
                disabled={submitting}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                className="flex-1 bg-amber-600 hover:bg-amber-700"
                onClick={() => submitReview('needs_changes')}
                disabled={submitting}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Needs Changes
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={() => submitReview('rejected')}
                disabled={submitting}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          )}
        </div>

        {/* Comments Sidebar */}
        <div className="w-80 border-l border-white/10 p-4 flex flex-col">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Comments ({versionComments.length})
          </h3>

          <div className="flex-1 overflow-y-auto space-y-3">
            {versionComments.map((comment) => (
              <div key={comment.id} className="bg-white/5 rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{comment.author_name}</span>
                  {comment.timecode_frame && (
                    <button
                      className="text-xs font-mono text-blue-400 hover:underline"
                      onClick={() => seekTo(comment.timecode_frame! / 24)}
                    >
                      <Clock className="h-3 w-3 inline mr-1" />
                      {formatTimecode(comment.timecode_frame / 24)}
                    </button>
                  )}
                </div>
                <p className="text-sm text-white/80">{comment.comment_text}</p>
                <p className="text-xs text-white/40">
                  {new Date(comment.created_at).toLocaleString()}
                </p>
              </div>
            ))}

            {versionComments.length === 0 && (
              <p className="text-white/40 text-sm text-center py-8">No comments yet</p>
            )}
          </div>

          {/* Add Comment */}
          {session.allow_comments && reviewerName && (
            <div className="mt-4 pt-4 border-t border-white/10">
              {showCommentInput ? (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a comment at current timecode..."
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 min-h-[80px]"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={submitComment}
                      disabled={submitting || !newComment.trim()}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowCommentInput(false);
                        setNewComment("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full border-white/20 text-white hover:bg-white/10"
                  onClick={() => setShowCommentInput(true)}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Add Comment at {formatTimecode(currentTime)}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Version Thumbnails Strip */}
      <div className="border-t border-white/10 p-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {session.versions.map((version, i) => (
            <button
              key={version.id}
              className={cn(
                "flex-shrink-0 w-32 rounded-lg overflow-hidden border-2 transition-all",
                i === currentIndex 
                  ? "border-white" 
                  : "border-transparent hover:border-white/50"
              )}
              onClick={() => goToVersion(i)}
            >
              <div className="aspect-video bg-white/10 flex items-center justify-center">
                <Film className="h-6 w-6 text-white/30" />
              </div>
              <div className="p-1.5 bg-white/5">
                <p className="font-mono text-xs truncate">{version.shot.code}</p>
                <p className="text-[10px] text-white/60">{version.version_code}</p>
              </div>
              {version.client_status && (
                <div className={cn(
                  "h-1",
                  version.client_status === 'approved' && "bg-green-500",
                  version.client_status === 'rejected' && "bg-red-500",
                  version.client_status === 'needs_changes' && "bg-amber-500",
                )} />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
