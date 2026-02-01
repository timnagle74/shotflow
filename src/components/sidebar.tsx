"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderKanban,
  Clapperboard,
  Upload,
  Truck,
  Users,
  Monitor,
  Film,
  Palette,
  FolderOpen,
  Database,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Shots Board", href: "/shots", icon: Clapperboard },
  { name: "Source Media", href: "/source-media", icon: Database },
  { name: "Turnover Import", href: "/turnover", icon: Upload },
  { name: "Turnovers", href: "/turnovers", icon: FolderOpen },
  { name: "Color Mgmt", href: "/color", icon: Palette },
  { name: "Deliveries", href: "/deliveries", icon: Truck },
  { name: "Client Portal", href: "/client", icon: Monitor },
  { name: "Users", href: "/users", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <Film className="h-7 w-7 text-primary" />
        <span className="text-xl font-bold tracking-tight">ShotFlow</span>
      </div>
      <nav className="space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="absolute bottom-4 left-4 right-4">
        <div className="rounded-md border border-border bg-background/50 p-3">
          <p className="text-xs text-muted-foreground">ShotFlow v0.1.0</p>
          <p className="text-xs text-muted-foreground">VFX Pipeline Manager</p>
        </div>
      </div>
    </aside>
  );
}
