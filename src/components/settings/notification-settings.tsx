"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Plus, Trash2, Globe, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Subscription = Database["public"]["Tables"]["notification_subscriptions"]["Row"] & {
  project?: Project | null;
};

export function NotificationSettings() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Fetch current user, subscriptions, and projects
  const fetchData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);

    try {
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setLoading(false);
        return;
      }

      // Get user record
      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", authUser.id)
        .single();

      if (!userData) {
        setLoading(false);
        return;
      }

      setCurrentUserId(userData.id);

      // Fetch subscriptions with project info
      const { data: subs } = await supabase
        .from("notification_subscriptions")
        .select("*, project:projects(*)")
        .eq("user_id", userData.id)
        .order("created_at", { ascending: false });

      setSubscriptions(subs || []);

      // Fetch all active projects
      const { data: projectsData } = await supabase
        .from("projects")
        .select("*")
        .eq("status", "ACTIVE")
        .order("name");

      setProjects(projectsData || []);
    } catch (error) {
      console.error("Failed to fetch notification settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Add a new subscription
  const addSubscription = async () => {
    if (!supabase || !currentUserId) return;
    setAdding(true);

    try {
      const projectId = selectedProjectId === "all" ? null : selectedProjectId;

      // Check for existing subscription
      const existing = subscriptions.find(
        (s) => s.project_id === projectId
      );
      if (existing) {
        alert("You already have this subscription.");
        setAdding(false);
        return;
      }

      const { error } = await supabase
        .from("notification_subscriptions")
        .insert({
          user_id: currentUserId,
          project_id: projectId,
          notify_on_version_upload: true,
        });

      if (error) throw error;

      setSelectedProjectId("");
      await fetchData();
    } catch (error) {
      console.error("Failed to add subscription:", error);
      alert("Failed to add subscription. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  // Remove a subscription
  const removeSubscription = async (id: string) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from("notification_subscriptions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
    } catch (error) {
      console.error("Failed to remove subscription:", error);
      alert("Failed to remove subscription. Please try again.");
    }
  };

  // Toggle notification type
  const toggleNotification = async (id: string, field: "notify_on_version_upload", value: boolean) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from("notification_subscriptions")
        .update({ [field]: value })
        .eq("id", id);

      if (error) throw error;

      setSubscriptions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
      );
    } catch (error) {
      console.error("Failed to update subscription:", error);
    }
  };

  // Filter out already-subscribed projects
  const availableProjects = projects.filter(
    (p) => !subscriptions.some((s) => s.project_id === p.id)
  );
  const hasAllProjectsSub = subscriptions.some((s) => s.project_id === null);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!currentUserId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Please sign in to manage notification preferences.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Email Notifications
        </CardTitle>
        <CardDescription>
          Get email alerts when new versions are uploaded to your subscribed projects.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add Subscription */}
        <div className="flex gap-2">
          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
            disabled={adding}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select a project to subscribe..." />
            </SelectTrigger>
            <SelectContent>
              {!hasAllProjectsSub && (
                <SelectItem value="all">
                  <span className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    All Projects
                  </span>
                </SelectItem>
              )}
              {availableProjects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name} ({project.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={addSubscription}
            disabled={!selectedProjectId || adding}
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span className="ml-2">Subscribe</span>
          </Button>
        </div>

        {/* Current Subscriptions */}
        {subscriptions.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No subscriptions yet.</p>
            <p className="text-sm">Subscribe to projects above to receive email notifications.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Your Subscriptions</h4>
            <div className="divide-y rounded-md border">
              {subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-3 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {sub.project_id === null ? (
                      <Badge variant="secondary" className="gap-1">
                        <Globe className="h-3 w-3" />
                        All Projects
                      </Badge>
                    ) : (
                      <span className="font-medium">
                        {sub.project?.name || "Unknown Project"}
                        {sub.project?.code && (
                          <span className="text-muted-foreground ml-1">
                            ({sub.project.code})
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={sub.notify_on_version_upload ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        toggleNotification(
                          sub.id,
                          "notify_on_version_upload",
                          !sub.notify_on_version_upload
                        )
                      }
                    >
                      {sub.notify_on_version_upload ? "On" : "Off"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSubscription(sub.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          When enabled, you&apos;ll receive an email each time a new version is uploaded
          to a shot in your subscribed projects (excluding your own uploads).
        </p>
      </CardContent>
    </Card>
  );
}
