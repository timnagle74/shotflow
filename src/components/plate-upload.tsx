"use client";

import React, { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
        setCurrentUpload(`Uploading ${plate.file.name} (${i + 1}/${plates.length})`);

        // Get upload URL
        const prepareResponse = await fetch("/api/plates/prepare-upload", {
          method: "POST",
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
          throw new Error(errorData.error || "Failed to prepare upload");
        }

        const { uploadUrl, storagePath, cdnUrl } = await prepareResponse.json();

        // Upload to Bunny Storage using signed URL (no raw key needed)
        const response = await uploadWithProgress(
          uploadUrl,
          plate.file,
          {
            "Content-Type": "application/octet-stream",
          },
          (progress) => {
            const overallProgress = ((i + progress / 100) / plates.length) * 100;
            setUploadProgress(Math.round(overallProgress));
          }
        );

        if (!response.ok && response.status !== 201) {
          throw new Error(`Upload failed: ${response.status}`);
        }

        // Save to database
        const saveResponse = await fetch("/api/plates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shotId,
            filename: plate.file.name,
            description: plate.description,
            storagePath,
            cdnUrl,
            fileSize: plate.file.size,
            sortOrder: i,
          }),
        });

        if (!saveResponse.ok) {
          const errorData = await saveResponse.json();
          throw new Error(errorData.error || "Failed to save plate");
        }

        const savedPlate = await saveResponse.json();
        uploadedPlates.push(savedPlate);
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
            accept=".mov,.mxf,.mp4,.m4v,.exr,.dpx,.tiff,.tif"
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
                ProRes, MXF, EXR, DPX, or TIFF
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
