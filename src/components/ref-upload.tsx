"use client";

import React, { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RefUploadProps {
  shotId: string;
  projectCode: string;
  shotCode: string;
  currentRef?: string | null;
  onUploadComplete?: (ref: any) => void;
  trigger?: React.ReactNode;
}

type UploadStatus = "idle" | "uploading" | "transcoding" | "success" | "error";

export function RefUpload({
  shotId,
  projectCode,
  shotCode,
  currentRef,
  onUploadComplete,
  trigger,
}: RefUploadProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setFile(null);
    setUploadStatus("idle");
    setUploadProgress(0);
    setErrorMessage("");
    setStatusMessage("");
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  }, []);

  const removeFile = useCallback(() => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

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
        resolve(
          new Response(xhr.response, {
            status: xhr.status,
            statusText: xhr.statusText,
          })
        );
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
    if (!file) {
      setErrorMessage("Please select a reference clip");
      return;
    }

    setUploadStatus("uploading");
    setUploadProgress(0);
    setErrorMessage("");
    setStatusMessage("Preparing upload...");

    try {
      // Get upload URL
      const prepareResponse = await fetch("/api/refs/prepare-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId,
          projectCode,
          shotCode,
          filename: file.name,
          type: "shot",
        }),
      });

      if (!prepareResponse.ok) {
        const errorData = await prepareResponse.json();
        throw new Error(errorData.error || "Failed to prepare upload");
      }

      const { uploadUrl, accessKey, storagePath, cdnUrl, streamVideoId } =
        await prepareResponse.json();

      // Upload to Bunny Storage
      setStatusMessage(`Uploading ${formatFileSize(file.size)}...`);

      const response = await uploadWithProgress(
        uploadUrl,
        file,
        {
          AccessKey: accessKey,
          "Content-Type": "application/octet-stream",
        },
        (progress) => setUploadProgress(progress)
      );

      if (!response.ok && response.status !== 201) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      // Upload to Bunny Stream for HLS playback (if video ID was created)
      if (streamVideoId) {
        setUploadStatus("transcoding");
        setStatusMessage("Starting transcode for web playback...");

        // Upload to stream for transcoding
        const streamUploadUrl = `https://video.bunnycdn.com/library/${process.env.NEXT_PUBLIC_BUNNY_STREAM_LIBRARY_ID}/videos/${streamVideoId}`;
        
        // Note: For large files, this should be done server-side
        // For now, we'll just save the storage URL and trigger transcoding later
      }

      // Save to database
      setStatusMessage("Saving reference...");

      const saveResponse = await fetch("/api/refs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId,
          filename: file.name,
          storagePath,
          cdnUrl,
          streamVideoId,
        }),
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(errorData.error || "Failed to save reference");
      }

      const savedRef = await saveResponse.json();

      setUploadStatus("success");
      setStatusMessage("Reference uploaded!");

      if (onUploadComplete) {
        onUploadComplete(savedRef);
      }

      setTimeout(() => {
        setOpen(false);
        resetForm();
      }, 1500);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Upload failed");
    }
  }, [file, shotId, projectCode, shotCode, onUploadComplete, resetForm]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const isUploading = ["uploading", "transcoding"].includes(uploadStatus);

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
            <Video className="h-4 w-4 mr-2" />
            {currentRef ? "Replace Reference" : "Upload Reference"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Upload Reference Clip
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            The reference clip shows this shot in context within the edit sequence.
            This helps artists understand how their work will fit.
          </p>

          {/* File select */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".mov,.mxf,.mp4,.m4v"
            className="hidden"
            onChange={handleFileSelect}
            disabled={isUploading}
          />

          <Card
            className={cn(
              "border-dashed cursor-pointer transition-colors",
              file
                ? "border-green-500/50 bg-green-500/5"
                : "hover:border-primary/50 hover:bg-muted/30"
            )}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <CardContent className="py-6 text-center">
              {file ? (
                <div className="space-y-2">
                  <Film className="h-10 w-10 mx-auto text-green-500" />
                  <p className="text-sm font-medium truncate px-4">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
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
                  <p className="text-sm font-medium">Drop reference clip here</p>
                  <p className="text-xs text-muted-foreground">
                    ProRes, MXF, or MP4
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Progress / Status */}
          {uploadStatus !== "idle" && (
            <div className="space-y-2">
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

              <div className="flex items-center justify-center gap-2 text-sm">
                {isUploading && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>
                      {statusMessage}{" "}
                      {uploadStatus === "uploading" ? `${uploadProgress}%` : ""}
                    </span>
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
            <Button onClick={handleUpload} disabled={isUploading || !file}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {uploadStatus === "uploading" ? "Uploading..." : "Processing..."}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Reference
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
