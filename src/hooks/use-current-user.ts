"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { createBrowserSupabaseClient } from "@/lib/supabase-auth";

export interface CurrentUser {
  id: string;          // public.users.id
  authId: string;      // auth.users.id
  name: string;
  email: string;
  role: string;
  canViewAllShots: boolean;
}

interface UseCurrentUserResult {
  currentUser: CurrentUser | null;
  loading: boolean;
  isArtist: boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  isProducer: boolean;
  isCoordinator: boolean;
  /** Returns true if the user should see all shots (non-artist, or artist with can_view_all_shots) */
  canSeeAllShots: boolean;
}

export function useCurrentUser(): UseCurrentUserResult {
  const { user, isLoading: authLoading } = useAuth();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserProfile() {
      if (authLoading) return;
      if (!user) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error } = await (supabase as any)
          .from("users")
          .select("id, auth_id, name, email, role, can_view_all_shots")
          .eq("auth_id", user.id)
          .single();

        if (error || !data) {
          console.error("Failed to fetch user profile:", error);
          setCurrentUser(null);
        } else {
          setCurrentUser({
            id: data.id,
            authId: data.auth_id,
            name: data.name,
            email: data.email,
            role: data.role,
            canViewAllShots: data.can_view_all_shots ?? false,
          });
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    }

    fetchUserProfile();
  }, [user, authLoading]);

  const role = currentUser?.role || "";
  const isArtist = role === "ARTIST" || role === "VFX_EDITOR";
  const isAdmin = role === "ADMIN";
  const isSupervisor = role === "SUPERVISOR";
  const isProducer = role === "PRODUCER";
  const isCoordinator = role === "COORDINATOR";
  const isVfxEditor = role === "VFX_EDITOR";
  const canSeeAllShots = !isArtist || (currentUser?.canViewAllShots ?? false);

  return {
    currentUser,
    loading: loading || authLoading,
    isArtist,
    isAdmin,
    isSupervisor,
    isProducer,
    isCoordinator,
    canSeeAllShots,
  };
}
