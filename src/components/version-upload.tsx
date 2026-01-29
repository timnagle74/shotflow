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
  FileVideo,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
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

type UploadStatus = "idle" | "preparing" | "uploading-prores" | "uploading-preview" | "finalizing" | "success" | "error";

export function VersionUpload({
  shotId,
  nextVersionNumber,
  createdById,
  onUploadComplete,
  trigger,
}: VersionUploadProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [proresFile, setProresFile] = useState<FileState>({ file: null });
  const [previewFile, setPreviewFile] = useState<FileState>({ file: null });
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const proresInputRef = useRef<HTMLInputElement>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setDescription("");
    setProresFile({ file: null });
    setPreviewFile({ file: null });
    setUploadStatus("idle");
    setUploadProgress(0);
    setErrorMessage("");
    setStatusMessage("");
  }, []);

  const handleFileSelect = useCallback(
    (type: "prores" | "preview") => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (type === "prores") {
        setProresFile({ file });
      } else {
        setPreviewFile({ file });
      }
    },
    []
  );

  const removeFile = useCallback((type: "prores" | "preview") => {
    if (type === "prores") {
      setProresFile({ file: null });
      if (proresInputRef.current) proresInputRef.current.value = "";
    } else {
      setPreviewFile({ file: null });
      if (previewInputRef.current) previewInputRef.current.value = "";
    }
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
    if (!proresFile.file && !previewFile.file) {
      setErrorMessage("Please select at least one file to upload");
      return;
    }

    setUploadStatus("preparing");
    setUploadProgress(0);
    setErrorMessage("");
    setStatusMessage("Preparing upload...");

    try {
      // Step 1: Get upload URLs from API
      const prepareResponse = await fetch("/api/versions/prepare-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId,
          versionNumber: nextVersionNumber,
          description: description.trim() || undefined,
          createdById,
          hasProres: !!proresFile.file,
          hasPreview: !!previewFile.file,
          proresFilename: proresFile.file?.name,
          previewFilename: previewFile.file?.name,
        }),
      });

      if (!prepareResponse.ok) {
        const errorData = await prepareResponse.json();
        throw new Error(errorData.error || "Failed to prepare upload");
      }

      const prepareData = await prepareResponse.json();
      let storagePath: string | undefined;
      let streamVideoId: string | undefined;

      // Step 2: Upload ProRes directly to Bunny Storage
      if (proresFile.file && prepareData.storageUpload) {
        setUploadStatus("uploading-prores");
        setStatusMessage(`Uploading ProRes (${formatFileSize(proresFile.file.size)})...`);

        const response = await uploadWithProgress(
          prepareData.storageUpload.url,
          proresFile.file,
          {
            "AccessKey": prepareData.storageUpload.accessKey,
            "Content-Type": "application/octet-stream",
          },
          (progress) => setUploadProgress(progress)
        );

        if (!response.ok && response.status !== 201) {
          throw new Error(`ProRes upload failed: ${response.status}`);
        }

        storagePath = prepareData.storageUpload.path;
      }

      // Step 3: Upload preview directly to Bunny Stream
      if (previewFile.file && prepareData.streamUpload) {
        setUploadStatus("uploading-preview");
        setUploadProgress(0);
        setStatusMessage(`Uploading preview (${formatFileSize(previewFile.file.size)})...`);

        const response = await uploadWithProgress(
          prepareData.streamUpload.uploadUrl,
          previewFile.file,
          {
            "AccessKey": prepareData.streamUpload.accessKey,
          },
          (progress) => setUploadProgress(progress)
        );

        if (!response.ok && response.status !== 200) {
          console.warn(`Preview upload status: ${response.status}`);
          // Bunny Stream may return different status codes, continue anyway
        }

        streamVideoId = prepareData.streamUpload.videoId;
      }

      // Step 4: Finalize - create version record
      setUploadStatus("finalizing");
      setUploadProgress(100);
      setStatusMessage("Creating version record...");

      const finalizeResponse = await fetch("/api/versions/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId,
          versionNumber: nextVersionNumber,
          description: description.trim() || undefined,
          createdById,
          storagePath,
          streamVideoId,
        }),
      });

      if (!finalizeResponse.ok) {
        const errorData = await finalizeResponse.json();
        throw new Error(errorData.error || "Failed to finalize upload");
      }

      const result = await finalizeResponse.json();

      setUploadStatus("success");
      setStatusMessage("Upload complete!");

      // Notify parent
      if (onUploadComplete) {
        onUploadComplete(result.version);
      }

      // Close dialog after short delay
      setTimeout(() => {
        setOpen(false);
        resetForm();
      }, 1500);
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
    proresFile.file,
    previewFile.file,
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

  const isUploading = ["preparing", "uploading-prores", "uploading-preview", "finalizing"].includes(uploadStatus);

  return (
    <Dialog open={open} onOpenChange={(o) => {
      setOpen(o);
      if (!o) resetForm();
    }}>
      <DialogTrigger asChild>
        {trigger || <Button size="sm">Submit New Version</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
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

          {/* File Upload Areas */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* ProRes Upload */}
            <Card
              className={cn(
                "border-dashed cursor-pointer transition-colors",
                proresFile.file
                  ? "border-green-500/50 bg-green-500/5"
                  : "hover:border-primary/50 hover:bg-muted/30"
              )}
              onClick={() => !isUploading && proresInputRef.current?.click()}
            >
              <CardContent className="pt-4 text-center">
                <input
                  ref={proresInputRef}
                  type="file"
                  accept=".mov,.mxf"
                  className="hidden"
                  onChange={handleFileSelect("prores")}
                  disabled={isUploading}
                />
                {proresFile.file ? (
                  <div className="space-y-2">
                    <Film className="h-8 w-8 mx-auto text-green-500" />
                    <p className="text-xs font-medium truncate px-2">
                      {proresFile.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(proresFile.file.size)}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile("prores");
                      }}
                      disabled={isUploading}
                    >
                      <X className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Film className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-xs font-medium">ProRes / Master</p>
                    <p className="text-[10px] text-muted-foreground">
                      For download (.mov, .mxf)
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Preview Upload */}
            <Card
              className={cn(
                "border-dashed cursor-pointer transition-colors",
                previewFile.file
                  ? "border-blue-500/50 bg-blue-500/5"
                  : "hover:border-primary/50 hover:bg-muted/30"
              )}
              onClick={() => !isUploading && previewInputRef.current?.click()}
            >
              <CardContent className="pt-4 text-center">
                <input
                  ref={previewInputRef}
                  type="file"
                  accept=".mp4,.mov,.m4v"
                  className="hidden"
                  onChange={handleFileSelect("preview")}
                  disabled={isUploading}
                />
                {previewFile.file ? (
                  <div className="space-y-2">
                    <FileVideo className="h-8 w-8 mx-auto text-blue-500" />
                    <p className="text-xs font-medium truncate px-2">
                      {previewFile.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(previewFile.file.size)}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile("preview");
                      }}
                      disabled={isUploading}
                    >
                      <X className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <FileVideo className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-xs font-medium">Web Preview</p>
                    <p className="text-[10px] text-muted-foreground">
                      For streaming (.mp4, H.265)
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

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
                    <span>{statusMessage} {uploadStatus.includes("uploading") ? `${uploadProgress}%` : ""}</span>
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

          {/* Info badges */}
          <div className="flex flex-wrap gap-2">
            {proresFile.file && (
              <Badge variant="outline" className="text-xs">
                <Film className="h-3 w-3 mr-1" /> ProRes → Bunny Storage (direct)
              </Badge>
            )}
            {previewFile.file && (
              <Badge variant="outline" className="text-xs">
                <FileVideo className="h-3 w-3 mr-1" /> Preview → Bunny Stream
              </Badge>
            )}
          </div>

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
              disabled={
                isUploading || (!proresFile.file && !previewFile.file)
              }
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
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
