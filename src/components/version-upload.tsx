"use client";

import React, { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VersionUploadProps {
  shotId: string;
  nextVersionNumber: number;
  createdById: string;
  onUploadComplete?: (version: any) => void;
  trigger?: React.ReactNode;
}

interface FileState {
  file: File | null;
}

type UploadStatus = "idle" | "preparing" | "uploading" | "finalizing" | "success" | "error";

export function VersionUpload({
  shotId,
  nextVersionNumber,
  createdById,
  onUploadComplete,
  trigger,
}: VersionUploadProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [videoFile, setVideoFile] = useState<FileState>({ file: null });
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setDescription("");
    setVideoFile({ file: null });
    setUploadStatus("idle");
    setUploadProgress(0);
    setErrorMessage("");
    setStatusMessage("");
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile({ file });
    }
  }, []);

  const removeFile = useCallback(() => {
    setVideoFile({ file: null });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // Upload file with progress using XMLHttpRequest
  const uploadWithProgress = (
    url: string,
    file: File,
    headers: Record<string, string>,
    onProgress: (progress: number) => void
  ): Promise<Response> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      });

      xhr.addEventListener("load", () => {
        resolve(new Response(xhr.response, {
          status: xhr.status,
          statusText: xhr.statusText,
        }));
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Upload failed"));
      });

      xhr.open("PUT", url);
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
      xhr.send(file);
    });
  };

  const handleUpload = useCallback(async () => {
    if (!videoFile.file) {
      setErrorMessage("Please select a video file to upload");
      return;
    }

    setUploadStatus("preparing");
    setUploadProgress(0);
    setErrorMessage("");
    setStatusMessage("Preparing upload...");

    try {
      // Step 1: Get upload URL from API
      const prepareResponse = await fetch("/api/versions/prepare-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId,
          versionNumber: nextVersionNumber,
          description: description.trim() || undefined,
          createdById,
          hasProres: true,
          hasPreview: false, // No separate preview - we'll transcode
          proresFilename: videoFile.file.name,
        }),
      });

      if (!prepareResponse.ok) {
        const errorData = await prepareResponse.json();
        throw new Error(errorData.error || "Failed to prepare upload");
      }

      const prepareData = await prepareResponse.json();

      // Step 2: Upload video directly to Bunny Storage
      if (prepareData.storageUpload) {
        setUploadStatus("uploading");
        setStatusMessage(`Uploading ${formatFileSize(videoFile.file.size)}...`);

        const response = await uploadWithProgress(
          prepareData.storageUpload.url,
          videoFile.file,
          {
            "Content-Type": "application/octet-stream",
          },
          (progress) => setUploadProgress(progress)
        );

        if (!response.ok && response.status !== 201) {
          throw new Error(`Upload failed: ${response.status}`);
        }
      }

      // Step 3: Finalize - create version record & trigger transcoding
      setUploadStatus("finalizing");
      setUploadProgress(100);
      setStatusMessage("Creating version & starting transcode...");

      const finalizeResponse = await fetch("/api/versions/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId,
          versionNumber: nextVersionNumber,
          description: description.trim() || undefined,
          createdById,
          storagePath: prepareData.storageUpload?.path,
        }),
      });

      if (!finalizeResponse.ok) {
        const errorData = await finalizeResponse.json();
        throw new Error(errorData.error || "Failed to finalize upload");
      }

      const result = await finalizeResponse.json();

      setUploadStatus("success");
      setStatusMessage(
        result.transcoding 
          ? "Upload complete! Web preview will be ready in ~1 min."
          : "Upload complete!"
      );

      // Notify parent
      if (onUploadComplete) {
        onUploadComplete(result.version);
      }

      // Close dialog after short delay
      setTimeout(() => {
        setOpen(false);
        resetForm();
      }, 2000);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Upload failed"
      );
    }
  }, [
    shotId,
    nextVersionNumber,
    description,
    createdById,
    videoFile.file,
    onUploadComplete,
    resetForm,
  ]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const isUploading = ["preparing", "uploading", "finalizing"].includes(uploadStatus);

  return (
    <Dialog open={open} onOpenChange={(o) => {
      setOpen(o);
      if (!o) resetForm();
    }}>
      <DialogTrigger asChild>
        {trigger || <Button size="sm">Submit New Version</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Submit Version {String(nextVersionNumber).padStart(3, "0")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What changed in this version?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isUploading}
              className="min-h-[80px]"
            />
          </div>

          {/* Single File Upload */}
          <Card
            className={cn(
              "border-dashed cursor-pointer transition-colors",
              videoFile.file
                ? "border-green-500/50 bg-green-500/5"
                : "hover:border-primary/50 hover:bg-muted/30"
            )}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <CardContent className="pt-6 pb-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".mov,.mxf,.mp4,.m4v"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
              {videoFile.file ? (
                <div className="space-y-2">
                  <Film className="h-10 w-10 mx-auto text-green-500" />
                  <p className="text-sm font-medium truncate px-4">
                    {videoFile.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(videoFile.file.size)}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile();
                    }}
                    disabled={isUploading}
                  >
                    <X className="h-3 w-3 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Film className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium">Drop video file here</p>
                  <p className="text-xs text-muted-foreground">
                    ProRes, MXF, or MP4
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Auto-transcode info */}
          {videoFile.file && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                Your video will be stored for download and automatically transcoded to H.264 for web playback.
              </span>
            </div>
          )}

          {/* Progress / Status */}
          {uploadStatus !== "idle" && (
            <div className="space-y-2">
              {/* Progress bar */}
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-300",
                    uploadStatus === "error"
                      ? "bg-red-500"
                      : uploadStatus === "success"
                      ? "bg-green-500"
                      : "bg-primary"
                  )}
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>

              {/* Status message */}
              <div className="flex items-center justify-center gap-2 text-sm">
                {isUploading && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{statusMessage} {uploadStatus === "uploading" ? `${uploadProgress}%` : ""}</span>
                  </>
                )}
                {uploadStatus === "success" && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-green-500">{statusMessage}</span>
                  </>
                )}
                {uploadStatus === "error" && (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-red-500">{errorMessage}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading || !videoFile.file}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {uploadStatus === "uploading" ? "Uploading..." : "Processing..."}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Submit Version
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
