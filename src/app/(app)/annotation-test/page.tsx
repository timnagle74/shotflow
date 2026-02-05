"use client";

import { useState, useEffect } from "react";
import { AnnotatedPlayer } from "@/components/annotated-player";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface Version {
  id: string;
  version_number: number;
  status: string;
  bunny_video_id?: string;
  shot?: {
    id: string;
    shot_code: string;
    sequence?: {
      code: string;
    };
  };
}

export default function AnnotationTestPage() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch versions with video
  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const res = await fetch("/api/versions?hasVideo=true&limit=20");
        if (res.ok) {
          const data = await res.json();
          setVersions(data);
          // Auto-select first version with video
          const withVideo = data.find((v: Version) => v.bunny_video_id);
          if (withVideo) {
            setSelectedVersion(withVideo);
          }
        }
      } catch (err) {
        console.error("Failed to fetch versions:", err);
      }
      setLoading(false);
    };
    fetchVersions();
  }, []);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Frame Annotation Test</h1>
        <p className="text-muted-foreground">
          Draw notes on specific frames. Notes are saved and display during playback.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Version</CardTitle>
          <CardDescription>Choose a version with video to test annotations</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading versions...
            </div>
          ) : versions.length === 0 ? (
            <p className="text-muted-foreground">No versions with video found</p>
          ) : (
            <Select
              value={selectedVersion?.id || ""}
              onValueChange={(id) => {
                const version = versions.find(v => v.id === id);
                setSelectedVersion(version || null);
              }}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select a version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((version) => (
                  <SelectItem key={version.id} value={version.id}>
                    <div className="flex items-center gap-2">
                      <span>
                        {version.shot?.sequence?.code}_{version.shot?.shot_code} v{version.version_number}
                      </span>
                      {version.bunny_video_id && (
                        <Badge variant="outline" className="text-xs">has video</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {selectedVersion && selectedVersion.bunny_video_id && (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedVersion.shot?.sequence?.code}_{selectedVersion.shot?.shot_code} v{selectedVersion.version_number}
            </CardTitle>
            <CardDescription>
              Click "Add Note" to draw on the current frame. Use transport controls for frame-accurate navigation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnnotatedPlayer
              versionId={selectedVersion.id}
              videoId={selectedVersion.bunny_video_id}
              fps={24}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium mb-2">Drawing Tools</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Pen</strong> - Freehand drawing</li>
                <li>• <strong>Arrow</strong> - Point to areas of interest</li>
                <li>• <strong>Rectangle/Circle</strong> - Highlight regions</li>
                <li>• <strong>Text</strong> - Add labels</li>
                <li>• <strong>Select</strong> - Move/resize objects</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Navigation</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>◀ / ▶</strong> - Step 1 frame</li>
                <li>• <strong>⏮ / ⏭</strong> - Jump 10 frames</li>
                <li>• Notes display automatically on their frame</li>
                <li>• Click notes in the list to jump to that frame</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
