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
  Settings,
  Building2,
  Eye,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    label: "PIPELINE",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Turnovers", href: "/turnovers", icon: FolderOpen },
      { name: "Shots Board", href: "/shots", icon: Clapperboard },
      { name: "Reviews", href: "/reviews", icon: Eye },
      { name: "Deliveries", href: "/deliveries", icon: Truck },
    ],
  },
  {
    label: "MANAGE",
    items: [
      { name: "Projects", href: "/projects", icon: FolderKanban },
      { name: "Source Media", href: "/source-media", icon: Database },
      { name: "Color Management", href: "/color", icon: Palette },
    ],
  },
  {
    label: "ADMIN",
    items: [
      { name: "Team & Users", href: "/users", icon: Users },
      { name: "Vendor Portal", href: "/vendor", icon: Building2 },
      { name: "Client Portal", href: "/client", icon: Monitor },
    ],
  },
];

const bottomNav: NavItem[] = [
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/turnovers") {
      return pathname?.startsWith("/turnovers") || pathname?.startsWith("/turnover");
    }
    return pathname?.startsWith(href);
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card flex flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <Film className="h-7 w-7 text-primary" />
        <span className="text-xl font-bold tracking-tight">ShotFlow</span>
      </div>

      {/* Navigation sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border px-3 py-3 space-y-1">
        {bottomNav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
        <div className="rounded-md bg-background/50 px-3 py-2 mt-2">
          <p className="text-[10px] text-muted-foreground">ShotFlow v0.1.0</p>
        </div>
      </div>
    </aside>
  );
}
