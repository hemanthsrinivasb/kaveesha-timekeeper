import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { StatsCard } from "@/components/StatsCard";
import { Clock, Briefcase, TrendingUp, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

interface TimesheetStats {
  totalHours: number;
  totalProjects: number;
  thisWeekHours: number;
  totalEntries: number;
}

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

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchRecentEntries();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      const { data: timesheets, error } = await supabase
        .from("timesheets")
        .select("*");

      if (error) throw error;

      if (timesheets) {
        const totalHours = timesheets.reduce(
          (sum, entry) => sum + Number(entry.hours),
          0
        );
        const uniqueProjects = new Set(timesheets.map((entry) => entry.project))
          .size;

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const thisWeekEntries = timesheets.filter(
          (entry) => new Date(entry.start_date) >= weekAgo
        );
        const thisWeekHours = thisWeekEntries.reduce(
          (sum, entry) => sum + Number(entry.hours),
          0
        );

        setStats({
          totalHours,
          totalProjects: uniqueProjects,
          thisWeekHours,
          totalEntries: timesheets.length,
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchRecentEntries = async () => {
    try {
      const { data, error } = await supabase
        .from("timesheets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentEntries(data || []);
    } catch (error) {
      console.error("Error fetching recent entries:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
          <StatsCard
            title="Total Hours"
            value={stats.totalHours.toFixed(1)}
            icon={Clock}
            description="All time"
          />
          <StatsCard
            title="Projects"
            value={stats.totalProjects}
            icon={Briefcase}
            description="Unique projects"
          />
          <StatsCard
            title="This Week"
            value={stats.thisWeekHours.toFixed(1)}
            icon={TrendingUp}
            description="Hours logged"
          />
          <StatsCard
            title="Total Entries"
            value={stats.totalEntries}
            icon={Calendar}
            description="Timesheet records"
          />
        </div>

        {/* Recent Entries */}
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle>Recent Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {recentEntries.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No timesheet entries yet. Start by creating one!
              </p>
            ) : (
              <div className="space-y-4">
                {recentEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:shadow-glow transition-all"
                  >
                    <div>
                      <p className="font-medium">{entry.project}</p>
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
      </main>
    </div>
  );
}
