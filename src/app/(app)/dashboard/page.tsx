"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShotStatusBadge } from "@/components/status-badge";
import { mockProjects, mockShots, mockVersions, mockNotes, mockUsers, getStatusCounts } from "@/lib/mock-data";
import { shotStatusColors, shotStatusLabels, cn } from "@/lib/utils";
import { Film, Clapperboard, CheckCircle, Clock, AlertTriangle, Users } from "lucide-react";

export default function DashboardPage() {
  const activeProject = mockProjects[0];
  const statusCounts = getStatusCounts(activeProject.id);
  const totalShots = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const stats = [
    { label: "Active Projects", value: mockProjects.filter(p => p.status === "ACTIVE").length, icon: Film, color: "text-blue-400" },
    { label: "Total Shots", value: mockShots.length, icon: Clapperboard, color: "text-purple-400" },
    { label: "In Progress", value: mockShots.filter(s => s.status === "IN_PROGRESS").length, icon: Clock, color: "text-amber-400" },
    { label: "Approved", value: mockShots.filter(s => s.status === "APPROVED" || s.status === "FINAL").length, icon: CheckCircle, color: "text-green-400" },
    { label: "Needs Review", value: mockShots.filter(s => s.status === "INTERNAL_REVIEW" || s.status === "CLIENT_REVIEW").length, icon: AlertTriangle, color: "text-orange-400" },
    { label: "Team Members", value: mockUsers.length, icon: Users, color: "text-cyan-400" },
  ];

  const recentActivity = [
    { text: "Alex Rivera submitted v003 for SEQ010_0010", time: "2 hours ago", type: "version" },
    { text: "Sarah Chen approved SEQ030_0020 — Final", time: "4 hours ago", type: "approval" },
    { text: "Casey Brooks started work on SEQ010_0020", time: "6 hours ago", type: "status" },
    { text: "Jordan Mills left note on SEQ020_0020 v002", time: "1 day ago", type: "note" },
    { text: "Tim Hampton created project Iron Citadel", time: "2 days ago", type: "project" },
    { text: "Sarah Chen moved SEQ010_0030 to Internal Review", time: "2 days ago", type: "status" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Pipeline overview across all active projects</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <stat.icon className={cn("h-5 w-5", stat.color)} />
                <span className="text-2xl font-bold">{stat.value}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Shot Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Shot Status — {activeProject.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center gap-3">
                  <div className="w-32 text-sm text-muted-foreground">
                    {shotStatusLabels[status]}
                  </div>
                  <div className="flex-1">
                    <div className="h-6 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", shotStatusColors[status])}
                        style={{ width: `${totalShots > 0 ? (count / totalShots) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-8 text-right text-sm font-medium">{count}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Shots</span>
              <span className="font-bold">{totalShots}</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={cn(
                    "mt-1 h-2 w-2 rounded-full shrink-0",
                    activity.type === "approval" ? "bg-green-500" :
                    activity.type === "version" ? "bg-blue-500" :
                    activity.type === "note" ? "bg-purple-500" :
                    activity.type === "project" ? "bg-amber-500" : "bg-zinc-500"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{activity.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {mockProjects.map((project) => {
              const counts = getStatusCounts(project.id);
              const total = Object.values(counts).reduce((a, b) => a + b, 0);
              const done = (counts.APPROVED || 0) + (counts.FINAL || 0);
              return (
                <Card key={project.id} className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{project.name}</h3>
                      <Badge variant={project.status === "ACTIVE" ? "default" : "secondary"} className="text-xs">
                        {project.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">Code: {project.code}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{total} shots</span>
                      <span className="text-green-400">{total > 0 ? Math.round((done / total) * 100) : 0}% complete</span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-green-600 transition-all" style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
