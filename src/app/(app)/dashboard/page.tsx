"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { shotStatusColors, shotStatusLabels, cn } from "@/lib/utils";
import { Film, Clapperboard, CheckCircle, Clock, AlertTriangle, Users, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/use-current-user";

interface DashboardStats {
  activeProjects: number;
  totalShots: number;
  inProgress: number;
  approved: number;
  needsReview: number;
  teamMembers: number;
}

interface ProjectSummary {
  id: string;
  name: string;
  code: string;
  status: string;
  totalShots: number;
  doneShots: number;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0, totalShots: 0, inProgress: 0, approved: 0, needsReview: 0, teamMembers: 0,
  });
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [activeProjectName, setActiveProjectName] = useState<string>("");
  const [projectSummaries, setProjectSummaries] = useState<ProjectSummary[]>([]);
  const { currentUser, loading: userLoading, isArtist } = useCurrentUser();

  useEffect(() => {
    if (!userLoading) {
      fetchDashboard();
    }
  }, [userLoading, currentUser]);

  async function fetchDashboard() {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const sb = supabase as any;
      const { data: projects } = await sb.from("projects").select("*").order("created_at", { ascending: false });
      const activeProjects = (projects as any[])?.filter(p => p.status === "ACTIVE") || [];

      // Fetch shots — for artists, only their assigned shots
      let shotsQuery = sb.from("shots").select("id, status, sequence_id, assigned_to_id");
      if (isArtist && currentUser) {
        shotsQuery = shotsQuery.eq("assigned_to_id", currentUser.id);
      }
      const { data: shots } = await shotsQuery;
      const allShots = (shots || []) as any[];

      const { data: sequences } = await sb.from("sequences").select("id, project_id");
      const seqMap = new Map<string, string>();
      ((sequences || []) as any[]).forEach(s => seqMap.set(s.id, s.project_id));

      // For artists, don't show team member count
      let teamMembers = 0;
      if (!isArtist) {
        const { count: userCount } = await sb.from("users").select("id", { count: "exact", head: true });
        teamMembers = userCount || 0;
      }

      // For artists, only count projects that contain their assigned shots
      let relevantProjects = projects as any[] || [];
      if (isArtist && currentUser) {
        const projectIdsWithShots = new Set<string>();
        allShots.forEach((shot: any) => {
          const projectId = seqMap.get(shot.sequence_id);
          if (projectId) projectIdsWithShots.add(projectId);
        });
        relevantProjects = relevantProjects.filter(p => projectIdsWithShots.has(p.id));
      }
      const relevantActiveProjects = relevantProjects.filter(p => p.status === "ACTIVE");

      setStats({
        activeProjects: relevantActiveProjects.length,
        totalShots: allShots.length,
        inProgress: allShots.filter(s => s.status === "IN_PROGRESS").length,
        approved: allShots.filter(s => s.status === "APPROVED" || s.status === "FINAL").length,
        needsReview: allShots.filter(s => s.status === "INTERNAL_REVIEW" || s.status === "CLIENT_REVIEW").length,
        teamMembers,
      });

      const mainProject = relevantActiveProjects[0] || relevantProjects[0];
      if (mainProject) {
        setActiveProjectName(mainProject.name);
        const projectSeqIds = ((sequences || []) as any[]).filter(s => s.project_id === mainProject.id).map(s => s.id);
        const projectShots = allShots.filter(s => projectSeqIds.includes(s.sequence_id));
        const counts: Record<string, number> = {
          NOT_STARTED: 0, IN_PROGRESS: 0, INTERNAL_REVIEW: 0, CLIENT_REVIEW: 0, REVISIONS: 0, APPROVED: 0, FINAL: 0,
        };
        projectShots.forEach(s => { counts[s.status] = (counts[s.status] || 0) + 1; });
        setStatusCounts(counts);
      }

      const summaries: ProjectSummary[] = relevantProjects.map(project => {
        const projectSeqIds = ((sequences || []) as any[]).filter(s => s.project_id === project.id).map(s => s.id);
        const projectShots = allShots.filter(s => projectSeqIds.includes(s.sequence_id));
        const done = projectShots.filter(s => s.status === "APPROVED" || s.status === "FINAL").length;
        return {
          id: project.id,
          name: project.name,
          code: project.code,
          status: project.status,
          totalShots: projectShots.length,
          doneShots: done,
        };
      });
      setProjectSummaries(summaries);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading || userLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Build stat cards — hide "Team Members" for artists
  const statCards = [
    { label: "Active Projects", value: stats.activeProjects, icon: Film, color: "text-blue-400" },
    { label: isArtist ? "My Shots" : "Total Shots", value: stats.totalShots, icon: Clapperboard, color: "text-purple-400" },
    { label: "In Progress", value: stats.inProgress, icon: Clock, color: "text-amber-400" },
    { label: "Approved", value: stats.approved, icon: CheckCircle, color: "text-green-400" },
    { label: "Needs Review", value: stats.needsReview, icon: AlertTriangle, color: "text-orange-400" },
    ...(!isArtist ? [{ label: "Team Members", value: stats.teamMembers, icon: Users, color: "text-cyan-400" }] : []),
  ];

  const totalStatusShots = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const isEmpty = stats.activeProjects === 0 && stats.totalShots === 0 && stats.teamMembers === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          {isArtist ? "Your assigned shots overview" : "Pipeline overview across all active projects"}
        </p>
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Film className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-1">
              {isArtist ? "No shots assigned yet" : "Welcome to ShotFlow"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isArtist
                ? "Once shots are assigned to you, they\u2019ll appear here."
                : "Create a project and start adding shots to see your pipeline dashboard."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", isArtist ? "xl:grid-cols-5" : "xl:grid-cols-6")}>
            {statCards.map((stat) => (
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
            {activeProjectName && totalStatusShots > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Shot Status \u2014 {activeProjectName}</CardTitle>
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
                              style={{ width: `${totalStatusShots > 0 ? (count / totalStatusShots) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                        <span className="w-8 text-right text-sm font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Shots</span>
                    <span className="font-bold">{totalStatusShots}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 opacity-20 mb-2" />
                  <p className="text-sm">Activity feed coming soon</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Version submissions, approvals, and notes will appear here</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {projectSummaries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Projects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {projectSummaries.map((project) => {
                    const pct = project.totalShots > 0 ? Math.round((project.doneShots / project.totalShots) * 100) : 0;
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
                            <span className="text-muted-foreground">{project.totalShots} shots</span>
                            <span className="text-green-400">{pct}% complete</span>
                          </div>
                          <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-green-600 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
