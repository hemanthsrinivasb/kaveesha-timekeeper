import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { StatsCard } from "@/components/StatsCard";
import { Clock, Users, Briefcase, TrendingUp } from "lucide-react";

interface Stats {
  total_hours: number;
  total_employees: number;
  total_projects: number;
  avg_hours_per_entry: number;
  total_entries: number;
}

interface ProjectData {
  name: string;
  value: number;
}

interface EmployeeData {
  name: string;
  hours: number;
  entries: number;
}

interface WeeklyData {
  week: string;
  hours: number;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [stats, setStats] = useState<Stats>({
    total_hours: 0,
    total_employees: 0,
    total_projects: 0,
    avg_hours_per_entry: 0,
    total_entries: 0,
  });
  const [projectData, setProjectData] = useState<ProjectData[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [employeeData, setEmployeeData] = useState<EmployeeData[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
    if (!loading && user && role !== "admin") {
      navigate("/");
      toast.error("Access denied. Admin only.");
    }
  }, [user, role, loading, navigate]);

  useEffect(() => {
    if (user && role === "admin") {
      fetchAnalytics();
    }
  }, [user, role]);

  const fetchAnalytics = async () => {
    setLoadingData(true);
    try {
      // Fetch all analytics data in parallel using server-side RPC functions
      const [statsResult, projectsResult, weeklyResult, employeesResult] = await Promise.all([
        supabase.rpc("get_analytics_stats"),
        supabase.rpc("get_project_distribution"),
        supabase.rpc("get_weekly_trend"),
        supabase.rpc("get_employee_productivity"),
      ]);

      if (statsResult.error) throw statsResult.error;
      if (projectsResult.error) throw projectsResult.error;
      if (weeklyResult.error) throw weeklyResult.error;
      if (employeesResult.error) throw employeesResult.error;

      // Set stats from server (cast to appropriate types)
      if (statsResult.data) {
        const data = statsResult.data as Record<string, unknown>;
        setStats({
          total_hours: Number(data.total_hours) || 0,
          total_employees: Number(data.total_employees) || 0,
          total_projects: Number(data.total_projects) || 0,
          avg_hours_per_entry: Number(data.avg_hours_per_entry) || 0,
          total_entries: Number(data.total_entries) || 0,
        });
      }

      // Set chart data (cast through unknown for type safety)
      setProjectData((projectsResult.data as unknown as ProjectData[]) || []);
      setWeeklyData((weeklyResult.data as unknown as WeeklyData[]) || []);
      setEmployeeData((employeesResult.data as unknown as EmployeeData[]) || []);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast.error("Failed to load analytics data");
    } finally {
      setLoadingData(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground animate-pulse">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold mb-2 gradient-text">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Advanced insights and visualizations (Admin Only)
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Hours"
            value={stats.total_hours.toFixed(1)}
            icon={Clock}
            description="All time logged"
          />
          <StatsCard
            title="Employees"
            value={stats.total_employees}
            icon={Users}
            description="Active team members"
          />
          <StatsCard
            title="Projects"
            value={stats.total_projects}
            icon={Briefcase}
            description="Active projects"
          />
          <StatsCard
            title="Avg Hours/Entry"
            value={stats.avg_hours_per_entry.toFixed(1)}
            icon={TrendingUp}
            description="Per timesheet entry"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Weekly Trend */}
          <Card className="animate-slide-up">
            <CardHeader>
              <CardTitle>Weekly Hours Trend</CardTitle>
              <CardDescription>Hours logged over the last 8 weeks</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="week" className="text-muted-foreground" fontSize={12} />
                  <YAxis className="text-muted-foreground" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="hours"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Project Distribution */}
          <Card className="animate-slide-up">
            <CardHeader>
              <CardTitle>Hours by Project</CardTitle>
              <CardDescription>Distribution of hours across projects</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={projectData}
                    cx="50%"
                    cy="45%"
                    outerRadius={80}
                    innerRadius={30}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                    paddingAngle={2}
                    label={({ name, value, percent }) => 
                      percent > 0.05 ? `${name.length > 10 ? name.substring(0, 10) + '...' : name}` : ''
                    }
                    labelLine={false}
                  >
                    {projectData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number, name: string) => [`${value}h`, name]}
                  />
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    wrapperStyle={{ paddingTop: 20 }}
                    formatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Employee Productivity */}
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle>Top Employees by Hours</CardTitle>
            <CardDescription>Employee productivity ranking</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={employeeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" className="text-muted-foreground" fontSize={12} />
                <YAxis dataKey="name" type="category" width={120} className="text-muted-foreground" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar dataKey="hours" fill="hsl(var(--primary))" name="Total Hours" radius={[0, 4, 4, 0]} />
                <Bar dataKey="entries" fill="hsl(var(--secondary))" name="Entries" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
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