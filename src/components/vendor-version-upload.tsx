"use client";

import React, { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Upload,
  Film,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Link2,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface VendorVersionUploadProps {
  shotId: string;
  shotCode: string;
  vfxNotes: string | null;
  nextVersionNumber: number;
  onUploadComplete?: (version: any) => void;
  trigger?: React.ReactNode;
}

type UploadMode = "file" | "link";

export function VendorVersionUpload({
  shotId,
  shotCode,
  vfxNotes,
  nextVersionNumber,
  onUploadComplete,
  trigger,
}: VendorVersionUploadProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [uploadMode, setUploadMode] = useState<UploadMode>("file");
  const [externalLink, setExternalLink] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "preparing" | "uploading" | "finalizing">("idle");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const versionCode = `v${String(nextVersionNumber).padStart(3, "0")}`;

  const resetForm = useCallback(() => {
    setDescription("");
    setExternalLink("");
    setSelectedFile(null);
    setSubmitting(false);
    setError(null);
    setSuccess(false);
    setUploadMode("file");
    setUploadProgress(0);
    setUploadPhase("idle");
  }, []);

  const cancelUpload = useCallback(() => {
    xhrRef.current?.abort();
    xhrRef.current = null;
    setSubmitting(false);
    setUploadPhase("idle");
    setUploadProgress(0);
    setError("Upload cancelled");
  }, []);

  const putWithProgress = useCallback(
    (url: string, file: File, contentType: string): Promise<void> =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", contentType);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          xhrRef.current = null;
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText || ""}`.trim()));
        };
        xhr.onerror = () => {
          xhrRef.current = null;
          reject(new Error("Network error during upload"));
        };
        xhr.onabort = () => {
          xhrRef.current = null;
          reject(new Error("Upload aborted"));
        };
        xhr.send(file);
      }),
    []
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) setSelectedFile(file);
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (!supabase) {
      setError("Database not configured");
      return;
    }

    if (uploadMode === "file" && !selectedFile) {
      setError("Please select a file to upload");
      return;
    }

    if (uploadMode === "link" && !externalLink.trim()) {
      setError("Please enter a link");
      return;
    }

    setSubmitting(true);
    setError(null);
    setUploadProgress(0);

    try {
      if (uploadMode === "link") {
        const { data: version, error: dbError } = await (supabase as any)
          .from("shot_versions")
          .insert({
            shot_id: shotId,
            version_number: nextVersionNumber,
            version_code: versionCode,
            status: "INTERNAL_REVIEW",
            description: description.trim() || null,
            preview_url: externalLink.trim(),
            submitted_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (dbError) throw dbError;

        await (supabase as any)
          .from("shots")
          .update({ status: "INTERNAL_REVIEW" })
          .eq("id", shotId);

        if (onUploadComplete) onUploadComplete(version);
      } else if (selectedFile) {
        // Step 1: Prepare — create version row + presigned PUT URL
        setUploadPhase("preparing");
        const prepareRes = await fetch("/api/versions/prepare-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shotId,
            versionNumber: nextVersionNumber,
            description: description.trim() || undefined,
            filename: selectedFile.name,
          }),
        });

        if (!prepareRes.ok) {
          const errorData = await prepareRes.json().catch(() => ({}));
          const msg = errorData.details
            ? `${errorData.error}: ${errorData.details}`
            : errorData.error || `Prepare failed: ${prepareRes.status}`;
          throw new Error(msg);
        }

        const prepareData = await prepareRes.json();
        if (!prepareData.storageUpload?.url) {
          throw new Error("Storage upload URL missing — server misconfigured");
        }

        // Step 2: Direct browser → S3/R2 PUT with progress
        // CRITICAL: Content-Type must match what the server signed (SigV4 includes it)
        setUploadPhase("uploading");
        await putWithProgress(
          prepareData.storageUpload.url,
          selectedFile,
          prepareData.storageUpload.contentType || "application/octet-stream"
        );

        // Step 3: Finalize — triggers Bunny Stream fetch + shot status update
        setUploadPhase("finalizing");
        const finalizeRes = await fetch("/api/versions/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            versionId: prepareData.version.id,
            storageKey: prepareData.storageUpload.key,
            title: prepareData.videoTitle,
          }),
        });

        if (!finalizeRes.ok) {
          // File is uploaded; preview transcode failed but the master is safe.
          console.warn("Finalize failed, preview may not be available:", await finalizeRes.text());
        }

        if (onUploadComplete) onUploadComplete(prepareData.version);
      }

      setSuccess(true);
      setUploadPhase("idle");
      setTimeout(() => {
        setOpen(false);
        resetForm();
      }, 1500);
    } catch (err) {
      console.error("Version submit error:", err);
      setError(err instanceof Error ? err.message : "Failed to submit version");
      setUploadPhase("idle");
    } finally {
      setSubmitting(false);
    }
  }, [
    shotId,
    nextVersionNumber,
    versionCode,
    description,
    uploadMode,
    selectedFile,
    externalLink,
    onUploadComplete,
    resetForm,
    putWithProgress,
  ]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024)
      return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline">
            <Upload className="h-3 w-3 mr-1" />
            Upload Version
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Version — {shotCode} {versionCode}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Shot Details / VFX Notes */}
          {vfxNotes && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                VFX Notes
              </p>
              <p className="text-sm">{vfxNotes}</p>
            </div>
          )}

          {/* Upload Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={uploadMode === "file" ? "default" : "outline"}
              size="sm"
              onClick={() => setUploadMode("file")}
              disabled={submitting}
            >
              <Film className="h-3 w-3 mr-1" />
              Upload File
            </Button>
            <Button
              variant={uploadMode === "link" ? "default" : "outline"}
              size="sm"
              onClick={() => setUploadMode("link")}
              disabled={submitting}
            >
              <Link2 className="h-3 w-3 mr-1" />
              Paste Link
            </Button>
          </div>

          {/* File Upload */}
          {uploadMode === "file" && (
            <Card
              className={cn(
                "border-dashed cursor-pointer transition-colors",
                selectedFile
                  ? "border-green-500/50 bg-green-500/5"
                  : "hover:border-primary/50 hover:bg-muted/30"
              )}
              onClick={() =>
                !submitting && fileInputRef.current?.click()
              }
            >
              <CardContent className="pt-6 pb-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mov,.mp4,.mxf,.m4v,.exr,.dpx"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={submitting}
                />
                {selectedFile ? (
                  <div className="space-y-2">
                    <Film className="h-10 w-10 mx-auto text-green-500" />
                    <p className="text-sm font-medium truncate px-4">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        if (fileInputRef.current)
                          fileInputRef.current.value = "";
                      }}
                      disabled={submitting}
                    >
                      <X className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Film className="h-10 w-10 mx-auto text-muted-foreground" />
                    <p className="text-sm font-medium">
                      Drop render file here
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ProRes, EXR, DPX, or MP4
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Link Input */}
          {uploadMode === "link" && (
            <div className="space-y-2">
              <Label htmlFor="external-link">
                External Link (Frame.io, Dropbox, Google Drive)
              </Label>
              <Input
                id="external-link"
                placeholder="https://app.frame.io/reviews/..."
                value={externalLink}
                onChange={(e) => setExternalLink(e.target.value)}
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground">
                Paste a sharing link for your render file
              </p>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="version-desc">Description</Label>
            <Textarea
              id="version-desc"
              placeholder="What changed in this version?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              className="min-h-[60px]"
            />
          </div>

          {/* Upload progress */}
          {submitting && uploadMode === "file" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {uploadPhase === "preparing" && "Preparing upload…"}
                  {uploadPhase === "uploading" && `Uploading ${selectedFile?.name ?? ""}`}
                  {uploadPhase === "finalizing" && "Transcoding preview…"}
                </span>
                {uploadPhase === "uploading" && (
                  <span className="font-mono text-muted-foreground">{uploadProgress}%</span>
                )}
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width:
                      uploadPhase === "uploading"
                        ? `${uploadProgress}%`
                        : uploadPhase === "finalizing"
                        ? "100%"
                        : "10%",
                  }}
                />
              </div>
            </div>
          )}

          {/* Status */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle className="h-4 w-4" />
              Version submitted for internal review!
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                if (submitting && uploadPhase === "uploading") {
                  cancelUpload();
                } else {
                  setOpen(false);
                  resetForm();
                }
              }}
            >
              {submitting && uploadPhase === "uploading" ? "Cancel Upload" : "Cancel"}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                submitting ||
                (uploadMode === "file" && !selectedFile) ||
                (uploadMode === "link" && !externalLink.trim())
              }
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Submit {versionCode}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
