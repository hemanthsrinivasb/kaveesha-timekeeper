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

interface TimesheetEntry {
  id: string;
  name: string;
  employee_id: string;
  project: string;
  hours: number;
  start_date: string;
  end_date: string;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [timesheets, setTimesheets] = useState<TimesheetEntry[]>([]);
  const [projectData, setProjectData] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [employeeData, setEmployeeData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalHours: 0,
    totalEmployees: 0,
    totalProjects: 0,
    avgHoursPerDay: 0,
  });

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
      fetchTimesheets();
    }
  }, [user, role]);

  const fetchTimesheets = async () => {
    try {
      const { data, error } = await supabase
        .from("timesheets")
        .select("*")
        .order("start_date", { ascending: false });

      if (error) throw error;
      
      if (data) {
        setTimesheets(data);
        processAnalytics(data);
      }
    } catch (error) {
      console.error("Error fetching timesheets:", error);
      toast.error("Failed to load analytics data");
    }
  };

  const processAnalytics = (data: TimesheetEntry[]) => {
    // Calculate stats
    const totalHours = data.reduce((sum, entry) => sum + Number(entry.hours), 0);
    const uniqueEmployees = new Set(data.map((entry) => entry.employee_id)).size;
    const uniqueProjects = new Set(data.map((entry) => entry.project)).size;
    const avgHoursPerDay = data.length > 0 ? totalHours / data.length : 0;

    setStats({
      totalHours,
      totalEmployees: uniqueEmployees,
      totalProjects: uniqueProjects,
      avgHoursPerDay,
    });

    // Project distribution data
    const projectHours: { [key: string]: number } = {};
    data.forEach((entry) => {
      projectHours[entry.project] = (projectHours[entry.project] || 0) + Number(entry.hours);
    });
    setProjectData(
      Object.entries(projectHours).map(([name, value]) => ({ name, value: Number(value.toFixed(1)) }))
    );

    // Weekly trend data (last 8 weeks)
    const weeklyHours: { [key: string]: number } = {};
    const today = new Date();
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - i * 7);
      const weekKey = `Week ${8 - i}`;
      weeklyHours[weekKey] = 0;
    }

    data.forEach((entry) => {
      const entryDate = new Date(entry.start_date);
      const weeksAgo = Math.floor((today.getTime() - entryDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (weeksAgo >= 0 && weeksAgo < 8) {
        const weekKey = `Week ${8 - weeksAgo}`;
        weeklyHours[weekKey] = (weeklyHours[weekKey] || 0) + Number(entry.hours);
      }
    });
    setWeeklyData(
      Object.entries(weeklyHours).map(([week, hours]) => ({ week, hours: Number(hours.toFixed(1)) }))
    );

    // Employee productivity data
    const employeeHours: { [key: string]: { name: string; hours: number; entries: number } } = {};
    data.forEach((entry) => {
      if (!employeeHours[entry.employee_id]) {
        employeeHours[entry.employee_id] = { name: entry.name, hours: 0, entries: 0 };
      }
      employeeHours[entry.employee_id].hours += Number(entry.hours);
      employeeHours[entry.employee_id].entries += 1;
    });
    setEmployeeData(
      Object.entries(employeeHours)
        .map(([id, data]) => ({
          name: data.name,
          hours: Number(data.hours.toFixed(1)),
          entries: data.entries,
        }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 10)
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
            value={stats.totalHours.toFixed(1)}
            icon={Clock}
            description="All time logged"
          />
          <StatsCard
            title="Employees"
            value={stats.totalEmployees}
            icon={Users}
            description="Active team members"
          />
          <StatsCard
            title="Projects"
            value={stats.totalProjects}
            icon={Briefcase}
            description="Active projects"
          />
          <StatsCard
            title="Avg Hours/Entry"
            value={stats.avgHoursPerDay.toFixed(1)}
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
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={projectData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}h`}
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
      </main>
    </div>
  );
}
