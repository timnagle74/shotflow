"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AuthRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Check localStorage for saved redirect destination
    const redirectTo = localStorage.getItem("authRedirectTo");
    
    // Clear it after reading
    localStorage.removeItem("authRedirectTo");
    
    // Redirect to the saved destination or dashboard
    const destination = redirectTo || "/dashboard";
    router.replace(destination);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
