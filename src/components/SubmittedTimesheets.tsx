import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, CheckCircle, XCircle, Clock, FileText } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";

type TimesheetStatus = "pending" | "approved" | "rejected";

interface TimesheetEntry {
  id: string;
  project: string;
  description: string | null;
  hours: number;
  start_date: string;
  status: TimesheetStatus;
  review_notes: string | null;
}

export const SubmittedTimesheets = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Get current week range (Mon-Sat)
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  useEffect(() => {
    if (user) {
      fetchSubmittedTimesheets();
    }
  }, [user]);

  const fetchSubmittedTimesheets = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch user's submitted timesheets for this week
      const { data, error } = await supabase
        .from("timesheets")
        .select("*")
        .eq("user_id", user.id)
        .gte("start_date", format(weekStart, "yyyy-MM-dd"))
        .lte("start_date", format(weekEnd, "yyyy-MM-dd"))
        .order("start_date", { ascending: true });

      if (error) throw error;
      setEntries((data || []) as TimesheetEntry[]);
    } catch (error) {
      console.error("Error fetching submitted timesheets:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: TimesheetStatus) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  // Group entries by project
  const groupedByProject = entries.reduce((acc, entry) => {
    if (!acc[entry.project]) {
      acc[entry.project] = [];
    }
    acc[entry.project].push(entry);
    return acc;
  }, {} as Record<string, TimesheetEntry[]>);

  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0);
  const approvedCount = entries.filter(e => e.status === "approved").length;
  const rejectedCount = entries.filter(e => e.status === "rejected").length;
  const pendingCount = entries.filter(e => e.status === "pending").length;

  if (loading) {
    return (
      <Card className="mt-6">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Submitted Timesheets (This Week)
          </CardTitle>
          <CardDescription>
            Week of {format(weekStart, "dd MMM")} - {format(weekEnd, "dd MMM yyyy")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            No timesheets submitted for this week yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" />
          Submitted Timesheets (This Week)
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-3">
          <span>Week of {format(weekStart, "dd MMM")} - {format(weekEnd, "dd MMM yyyy")}</span>
          <span className="text-primary font-medium">{totalHours.toFixed(1)} hours total</span>
          {pendingCount > 0 && (
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
              {pendingCount} pending
            </Badge>
          )}
          {approvedCount > 0 && (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
              {approvedCount} approved
            </Badge>
          )}
          {rejectedCount > 0 && (
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
              {rejectedCount} rejected
            </Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(groupedByProject).map(([project, projectEntries]) => (
            <div key={project} className="border border-border rounded-lg p-4">
              <h4 className="font-semibold mb-3">{project}</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-right p-2">Hours</th>
                      <th className="text-center p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectEntries.map((entry) => (
                      <tr key={entry.id} className="border-b last:border-0">
                        <td className="p-2">
                          {format(new Date(entry.start_date), "EEE, dd MMM")}
                        </td>
                        <td className="p-2 text-muted-foreground max-w-[200px] truncate" title={entry.description || ""}>
                          {entry.description || "-"}
                        </td>
                        <td className="p-2 text-right font-medium">
                          {Number(entry.hours).toFixed(1)}h
                        </td>
                        <td className="p-2 text-center">
                          {getStatusBadge(entry.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Show review notes for rejected entries */}
              {projectEntries.some(e => e.status === "rejected" && e.review_notes) && (
                <div className="mt-3 p-3 bg-destructive/5 rounded-md border border-destructive/20">
                  <p className="text-sm text-destructive font-medium">Rejection Notes:</p>
                  {projectEntries
                    .filter(e => e.status === "rejected" && e.review_notes)
                    .map(e => (
                      <p key={e.id} className="text-sm text-muted-foreground mt-1">
                        {format(new Date(e.start_date), "dd MMM")}: {e.review_notes}
                      </p>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
