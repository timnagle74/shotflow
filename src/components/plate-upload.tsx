"use client";

import React, { useState, useCallback, useRef } from "react";
import * as tus from "tus-js-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Plus,
  CheckCircle,
  AlertCircle,
  Loader2,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlateFile {
  id: string;
  file: File;
  description: string;
}

interface PlateUploadProps {
  shotId: string;
  projectCode: string;
  shotCode: string;
  onUploadComplete?: (plates: any[]) => void;
  trigger?: React.ReactNode;
}

type UploadStatus = "idle" | "uploading" | "success" | "error";

export function PlateUpload({
  shotId,
  projectCode,
  shotCode,
  onUploadComplete,
  trigger,
}: PlateUploadProps) {
  const [open, setOpen] = useState(false);
  const [plates, setPlates] = useState<PlateFile[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentUpload, setCurrentUpload] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setPlates([]);
    setUploadStatus("idle");
    setUploadProgress(0);
    setErrorMessage("");
    setCurrentUpload("");
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPlates = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      description: "",
    }));
    setPlates((prev) => [...prev, ...newPlates]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const removePlate = useCallback((id: string) => {
    setPlates((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updateDescription = useCallback((id: string, description: string) => {
    setPlates((prev) =>
      prev.map((p) => (p.id === id ? { ...p, description } : p))
    );
  }, []);

  const handleUpload = useCallback(async () => {
    if (plates.length === 0) {
      setErrorMessage("Please add at least one plate");
      return;
    }

    setUploadStatus("uploading");
    setUploadProgress(0);
    setErrorMessage("");

    const uploadedPlates: any[] = [];

    try {
      for (let i = 0; i < plates.length; i++) {
        const plate = plates[i];
        setCurrentUpload(`Preparing ${plate.file.name} (${i + 1}/${plates.length})`);

        // Get TUS upload credentials from API
        const prepareResponse = await fetch("/api/plates/prepare-upload", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shotId,
            projectCode,
            shotCode,
            filename: plate.file.name,
            description: plate.description,
            sortOrder: i,
          }),
        });

        if (!prepareResponse.ok) {
          const errorData = await prepareResponse.json();
          throw new Error(errorData.error || `Failed to prepare upload: ${prepareResponse.status}`);
        }

        const { plate: plateRecord, tusUpload, videoId } = await prepareResponse.json();

        if (!tusUpload) {
          throw new Error("No upload credentials received - video files only");
        }

        setCurrentUpload(`Uploading ${plate.file.name} (${i + 1}/${plates.length})`);

        // Upload using TUS (direct to Bunny Stream)
        await new Promise<void>((resolve, reject) => {
          const upload = new tus.Upload(plate.file, {
            endpoint: tusUpload.url,
            headers: {
              'AuthorizationSignature': tusUpload.authSignature,
              'AuthorizationExpire': String(tusUpload.expiresAt),
              'VideoId': tusUpload.videoId,
              'LibraryId': tusUpload.libraryId,
            },
            metadata: {
              filename: plate.file.name,
              filetype: plate.file.type || 'video/quicktime',
            },
            onError: (error) => {
              console.error("TUS upload error:", error);
              reject(new Error(`Upload failed: ${error.message}`));
            },
            onProgress: (bytesUploaded, bytesTotal) => {
              const fileProgress = bytesUploaded / bytesTotal;
              const overallProgress = ((i + fileProgress) / plates.length) * 100;
              setUploadProgress(Math.round(overallProgress));
            },
            onSuccess: () => {
              console.log("TUS upload complete for:", plate.file.name);
              resolve();
            },
          });
          upload.start();
        });

        uploadedPlates.push(plateRecord);
      }

      setUploadStatus("success");
      setCurrentUpload("All plates uploaded!");

      if (onUploadComplete) {
        onUploadComplete(uploadedPlates);
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
  }, [plates, shotId, projectCode, shotCode, onUploadComplete, resetForm]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const isUploading = uploadStatus === "uploading";

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
            <Plus className="h-4 w-4 mr-2" />
            Add Plates
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            Upload Source Plates
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Add files button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".mov,.mxf,.mp4,.m4v"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            disabled={isUploading}
          />

          {/* Plate list */}
          {plates.length > 0 && (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {plates.map((plate, idx) => (
                <Card key={plate.id} className="border-muted">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <GripVertical className="h-5 w-5 text-muted-foreground shrink-0 mt-1 cursor-grab" />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <Film className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">
                            {plate.file.name}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatFileSize(plate.file.size)}
                          </span>
                        </div>
                        <Input
                          placeholder="Description (e.g., Clean plate, Hero plate, BG element)"
                          value={plate.description}
                          onChange={(e) =>
                            updateDescription(plate.id, e.target.value)
                          }
                          disabled={isUploading}
                          className="h-8 text-sm"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => removePlate(plate.id)}
                        disabled={isUploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Drop zone / Add more button */}
          <Card
            className={cn(
              "border-dashed cursor-pointer transition-colors",
              "hover:border-primary/50 hover:bg-muted/30"
            )}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <CardContent className="py-6 text-center">
              <Plus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">
                {plates.length === 0 ? "Add plate files" : "Add more plates"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Video files: MOV, MP4, MXF, M4V
              </p>
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
                    <span>{currentUpload}</span>
                  </>
                )}
                {uploadStatus === "success" && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-green-500">{currentUpload}</span>
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
              disabled={isUploading || plates.length === 0}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {plates.length} Plate{plates.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
