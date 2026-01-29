"use client";

import React, { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  preview?: string;
}

type UploadStatus = "idle" | "uploading" | "processing" | "success" | "error";

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

  const proresInputRef = useRef<HTMLInputElement>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setDescription("");
    setProresFile({ file: null });
    setPreviewFile({ file: null });
    setUploadStatus("idle");
    setUploadProgress(0);
    setErrorMessage("");
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

  const handleUpload = useCallback(async () => {
    if (!proresFile.file && !previewFile.file) {
      setErrorMessage("Please select at least one file to upload");
      return;
    }

    setUploadStatus("uploading");
    setUploadProgress(10);
    setErrorMessage("");

    try {
      const formData = new FormData();

      // Add metadata
      formData.append(
        "metadata",
        JSON.stringify({
          shotId,
          versionNumber: nextVersionNumber,
          description: description.trim() || undefined,
          createdById,
        })
      );

      // Add files
      if (proresFile.file) {
        formData.append("prores", proresFile.file);
      }
      if (previewFile.file) {
        formData.append("preview", previewFile.file);
      }

      setUploadProgress(30);

      // Upload using fetch with streaming (no native progress for fetch)
      // For better progress, we'd need XMLHttpRequest or a library like axios
      const response = await fetch("/api/versions/upload", {
        method: "POST",
        body: formData,
      });

      setUploadProgress(90);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const result = await response.json();

      setUploadProgress(100);
      setUploadStatus("success");

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

  const isUploading = uploadStatus === "uploading" || uploadStatus === "processing";

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
                {uploadStatus === "uploading" && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Uploading... {uploadProgress}%</span>
                  </>
                )}
                {uploadStatus === "processing" && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                )}
                {uploadStatus === "success" && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-green-500">Upload complete!</span>
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
                <Film className="h-3 w-3 mr-1" /> ProRes → Bunny Storage
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
