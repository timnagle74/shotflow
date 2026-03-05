"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Film, Palette, Shield, Database } from "lucide-react";
import { NotificationSettings } from "@/components/settings/notification-settings";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your ShotFlow workspace</p>
      </div>

      {/* Notification Settings - Fully Functional */}
      <NotificationSettings />

      {/* Other Settings Cards - Placeholders */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:border-primary/30 transition-colors cursor-pointer opacity-60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Film className="h-5 w-5 text-primary" />
              Project Defaults
              <Badge variant="outline" className="ml-auto text-xs">Coming Soon</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Frame rates, resolution, naming conventions, and delivery specs.
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/30 transition-colors cursor-pointer opacity-60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              Color Pipeline
              <Badge variant="outline" className="ml-auto text-xs">Coming Soon</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Default color spaces, LUT paths, and CDL workflows.
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/30 transition-colors cursor-pointer opacity-60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Storage
              <Badge variant="outline" className="ml-auto text-xs">Coming Soon</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              CDN configuration, upload limits, and media storage settings.
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/30 transition-colors cursor-pointer opacity-60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Security
              <Badge variant="outline" className="ml-auto text-xs">Coming Soon</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Authentication, review link expiry, and access controls.
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/30 transition-colors cursor-pointer opacity-60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Integrations
              <Badge variant="outline" className="ml-auto text-xs">Coming Soon</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Frame.io, ftrack, ShotGrid, and other pipeline connections.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">ShotFlow Version</p>
            <p className="text-xs text-muted-foreground">v0.1.0 — VFX Pipeline Manager</p>
          </div>
          <Badge variant="secondary">Development</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
