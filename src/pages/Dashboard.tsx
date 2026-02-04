import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { StatsCard } from "@/components/StatsCard";
import { Clock, Briefcase, TrendingUp, Calendar, FolderKanban, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

interface TimesheetStats {
  totalHours: number;
  totalProjects: number;
  thisWeekHours: number;
  totalEntries: number;
}

interface AssignedProject {
  id: string;
  name: string;
  description: string | null;
  assigned_at: string;
}

type TimesheetStatus = "pending" | "approved" | "rejected";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [stats, setStats] = useState<TimesheetStats>({
    totalHours: 0,
    totalProjects: 0,
    thisWeekHours: 0,
    totalEntries: 0,
  });
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [assignedProjects, setAssignedProjects] = useState<AssignedProject[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user && role !== undefined) {
      fetchStats();
      fetchRecentEntries();
      if (role !== 'admin') {
        fetchAssignedProjects();
      }
    }
  }, [user, role]);

  const fetchAssignedProjects = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("project_assignments")
        .select(`
          id,
          assigned_at,
          project_id,
          projects (
            id,
            name,
            description
          )
        `)
        .eq("user_id", user.id);

      if (error) throw error;

      const projects = (data || []).map((assignment: any) => ({
        id: assignment.projects?.id || assignment.project_id,
        name: assignment.projects?.name || "Unknown Project",
        description: assignment.projects?.description,
        assigned_at: assignment.assigned_at,
      }));

      setAssignedProjects(projects);
    } catch (error) {
      console.error("Error fetching assigned projects:", error);
    }
  };

  const fetchStats = async () => {
    try {
      // Use server-side RPC function for accurate stats (avoids 1000 row limit)
      const { data, error } = await supabase.rpc("get_dashboard_stats");

      if (error) throw error;

      if (data) {
        const statsData = data as Record<string, unknown>;
        setStats({
          totalHours: Number(statsData.total_hours) || 0,
          totalProjects: Number(statsData.total_projects) || 0,
          thisWeekHours: Number(statsData.this_week_hours) || 0,
          totalEntries: Number(statsData.total_entries) || 0,
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchRecentEntries = async () => {
    try {
      let query = supabase
        .from("timesheets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (role !== 'admin' && user) {
        query = query.eq('user_id', user.id);
      }
      
      const { data, error } = await query;

      if (error) throw error;
      setRecentEntries(data || []);
    } catch (error) {
      console.error("Error fetching recent entries:", error);
    }
  };

  const getStatusBadge = (status: TimesheetStatus) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 text-xs">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground animate-pulse">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold mb-2 gradient-text">Welcome Back!</h1>
          <p className="text-muted-foreground">
            {role === "admin"
              ? "Admin Dashboard - Manage all timesheets and view analytics"
              : "Here's an overview of your timesheet activity"}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <StatsCard
              title="Total Hours"
              value={stats.totalHours.toFixed(1)}
              icon={Clock}
              description="All time"
            />
          </div>
          <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <StatsCard
              title="Projects"
              value={stats.totalProjects}
              icon={Briefcase}
              description="Unique projects"
            />
          </div>
          <div className="animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <StatsCard
              title="This Week"
              value={stats.thisWeekHours.toFixed(1)}
              icon={TrendingUp}
              description="Hours logged"
            />
          </div>
          <div className="animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <StatsCard
              title="Total Entries"
              value={stats.totalEntries}
              icon={Calendar}
              description="Timesheet records"
            />
          </div>
        </div>

        {/* User's Assigned Projects Section - Only for non-admin users */}
        {role !== "admin" && (
          <Card className="mb-8 animate-slide-up" style={{ animationDelay: '0.5s' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-primary" />
                My Assigned Projects
              </CardTitle>
              <CardDescription>
                Projects you have been assigned to by the admin
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assignedProjects.length === 0 ? (
                <div className="text-center py-8">
                  <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">
                    No projects assigned yet. Contact your admin to get assigned to projects.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {assignedProjects.map((project, index) => (
                    <div
                      key={project.id}
                      className={`p-4 rounded-lg border border-border bg-card hover:shadow-glow hover-lift transition-all row-animate stagger-${Math.min(index + 1, 5)}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-foreground">{project.name}</h3>
                        <Badge variant="secondary" className="text-xs">Active</Badge>
                      </div>
                      {project.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Assigned: {new Date(project.assigned_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Entries */}
        <Card className="animate-slide-up" style={{ animationDelay: role !== "admin" ? '0.6s' : '0.5s' }}>
          <CardHeader>
            <CardTitle>Recent Entries</CardTitle>
            <CardDescription>
              {role === "admin" ? "Latest timesheet entries from all users" : "Your recent timesheet submissions"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentEntries.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">
                  No timesheet entries yet. Start by creating one!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentEntries.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between p-4 rounded-lg border border-border hover:shadow-glow hover-lift transition-all row-animate stagger-${Math.min(index + 1, 5)}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{entry.project}</p>
                        {getStatusBadge(entry.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {entry.name} • {entry.employee_id}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">
                        {parseFloat(entry.hours).toFixed(1)}h
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(entry.start_date).toLocaleDateString()} - {new Date(entry.end_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Kaveesha Engineers Inda PVT. LTD. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}