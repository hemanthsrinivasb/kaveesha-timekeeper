import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { FileSpreadsheet, FileText, Search, Trash2, CheckCircle, XCircle, Clock, Pencil } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TimesheetStatus = "pending" | "approved" | "rejected";

export default function Reports() {
  const navigate = useNavigate();
  const { user, role, isHod, hodProjects, loading } = useAuth();
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [filteredTimesheets, setFilteredTimesheets] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [allProjects, setAllProjects] = useState<string[]>([]);
  const [allDepartments, setAllDepartments] = useState<string[]>([]);
  const [employeeDepartments, setEmployeeDepartments] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editHours, setEditHours] = useState("");

  const isAdmin = role === "admin";
  const canAccessReports = isAdmin || isHod;

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
    if (!loading && user && !canAccessReports) {
      toast.error("Access denied. Admin or HOD only.");
      navigate("/");
    }
  }, [user, role, isHod, loading, navigate, canAccessReports]);

  useEffect(() => {
    if (user && canAccessReports) {
      fetchTimesheets();
      fetchAllProjects();
      fetchDepartments();
    }
  }, [user, role, isHod]);

  useEffect(() => {
    filterTimesheets();
  }, [searchTerm, filterStartDate, filterEndDate, filterStatus, filterProject, filterDepartment, timesheets, employeeDepartments]);

  const fetchAllProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setAllProjects(data?.map((p) => p.name) || []);
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  };

  const fetchTimesheets = async () => {
    try {
      // Calculate date range for last 60 days (2 months) as default
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split('T')[0];

      let query = supabase
        .from("timesheets")
        .select("*")
        .gte("start_date", sixtyDaysAgoStr) // Fetch last 60 days (2 months) by default
        .order("start_date", { ascending: false });

      // For HOD (non-admin), only fetch timesheets for their projects
      if (!isAdmin && isHod && hodProjects.length > 0) {
        query = query.in("project", hodProjects);
      }

      // Remove any implicit limits by explicitly setting a high limit
      // Supabase default is 1000 rows, this ensures we get all matching records
      const { data, error, count } = await query.limit(10000);

      if (error) throw error;
      
      console.log(`Fetched ${data?.length || 0} timesheet entries`);
      setTimesheets(data || []);
      setFilteredTimesheets(data || []);
    } catch (error) {
      console.error("Error fetching timesheets:", error);
      toast.error("Failed to load timesheets");
    }
  };

  const filterTimesheets = () => {
    let filtered = [...timesheets];

    if (searchTerm) {
      filtered = filtered.filter(
        (entry) =>
          entry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.project.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStartDate) {
      filtered = filtered.filter((entry) => entry.start_date >= filterStartDate);
    }

    if (filterEndDate) {
      filtered = filtered.filter((entry) => entry.end_date <= filterEndDate);
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((entry) => entry.status === filterStatus);
    }

    if (filterProject !== "all") {
      filtered = filtered.filter((entry) => entry.project === filterProject);
    }

    setFilteredTimesheets(filtered);
  };

  const handleStatusChange = async (id: string, userId: string, newStatus: TimesheetStatus, projectName: string) => {
    if (!user) return;
    
    setProcessingId(id);
    try {
      // Update timesheet status
      const { error: updateError } = await supabase
        .from("timesheets")
        .update({
          status: newStatus,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // Create notification for user
      const reviewerType = isAdmin ? "Admin" : "HOD";
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: userId,
          title: `Timesheet ${newStatus === "approved" ? "Approved" : "Rejected"}`,
          message: `Your timesheet for "${projectName}" has been ${newStatus} by ${reviewerType}.`,
          type: `timesheet_${newStatus}`,
          metadata: { timesheet_id: id, status: newStatus },
        });

      if (notifError) {
        console.error("Error creating notification:", notifError);
      }

      toast.success(`Timesheet ${newStatus} successfully`);
      fetchTimesheets();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update timesheet status");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    
    try {
      const { error } = await supabase.from("timesheets").delete().eq("id", id);
      if (error) throw error;
      toast.success("Entry deleted successfully");
      fetchTimesheets();
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast.error("Failed to delete entry");
    }
  };

  const openEditDialog = (entry: any) => {
    setEditingEntry(entry);
    setEditDescription(entry.description || "");
    setEditHours(parseFloat(entry.hours).toString());
  };

  const handleUpdateDescription = async () => {
    if (!editingEntry) return;
    
    setProcessingId(editingEntry.id);
    try {
      const updatePayload: Record<string, any> = { description: editDescription.trim() || null };
      // Allow hours editing only for pending entries
      if (editingEntry.status === "pending" && editHours) {
        const parsedHours = parseFloat(editHours);
        if (!isNaN(parsedHours) && parsedHours >= 0) {
          updatePayload.hours = parsedHours;
        }
      }
      const { error } = await supabase
        .from("timesheets")
        .update(updatePayload)
        .eq("id", editingEntry.id);

      if (error) throw error;
      
      toast.success("Description updated successfully");
      setEditingEntry(null);
      fetchTimesheets();
    } catch (error) {
      console.error("Error updating description:", error);
      toast.error("Failed to update description");
    } finally {
      setProcessingId(null);
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

  const exportToExcel = () => {
    const safeData = filteredTimesheets.map((entry) => ({
      "Start Date": entry.start_date ? new Date(entry.start_date).toLocaleDateString() : "N/A",
      "End Date": entry.end_date ? new Date(entry.end_date).toLocaleDateString() : "N/A",
      Name: entry.name || "Unknown",
      "Employee ID": entry.employee_id || "N/A",
      Project: entry.project || "N/A",
      Description: entry.description || "",
      Hours: !isNaN(parseFloat(entry.hours)) ? parseFloat(entry.hours).toFixed(2) : "0.00",
      Status: entry.status ? entry.status.charAt(0).toUpperCase() + entry.status.slice(1) : "Pending",
    }));
    if (safeData.length === 0) {
      toast.info("No data to export");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(safeData);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Timesheets");
    XLSX.writeFile(workbook, `Timesheet_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Excel file downloaded successfully!");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Timesheet Report", 14, 20);
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

    if (filteredTimesheets.length === 0) {
      toast.info("No data to export");
      return;
    }
    autoTable(doc, {
      startY: 40,
      head: [["Start Date", "End Date", "Name", "Employee ID", "Project", "Description", "Hours", "Status"]],
      body: filteredTimesheets.map((entry) => [
        entry.start_date ? new Date(entry.start_date).toLocaleDateString() : "N/A",
        entry.end_date ? new Date(entry.end_date).toLocaleDateString() : "N/A",
        entry.name || "Unknown",
        entry.employee_id || "N/A",
        entry.project || "N/A",
        entry.description || "",
        !isNaN(parseFloat(entry.hours)) ? parseFloat(entry.hours).toFixed(2) : "0.00",
        entry.status ? entry.status.charAt(0).toUpperCase() + entry.status.slice(1) : "Pending",
      ]),
      theme: "grid",
      headStyles: { fillColor: [220, 38, 38] },
    });

    doc.save(`Timesheet_Report_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF file downloaded successfully!");
  };

  // Get projects to show in filter - for HOD, only their projects; for admin, all projects
  const filterableProjects = isAdmin ? allProjects : hodProjects;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground animate-pulse">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (!canAccessReports) {
    return null;
  }

  const pendingCount = timesheets.filter(t => t.status === "pending").length;

  // Consolidated approval summary: group pending entries by employee
  const pendingByEmployee = timesheets
    .filter(t => t.status === "pending")
    .reduce((acc, t) => {
      const key = t.employee_id;
      if (!acc[key]) {
        acc[key] = { name: t.name, employee_id: t.employee_id, count: 0, hours: 0 };
      }
      acc[key].count += 1;
      acc[key].hours += parseFloat(t.hours) || 0;
      return acc;
    }, {} as Record<string, { name: string; employee_id: string; count: number; hours: number }>);
  const pendingEmployees = Object.values(pendingByEmployee).sort((a: any, b: any) => b.count - a.count) as Array<{ name: string; employee_id: string; count: number; hours: number }>;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold mb-2 gradient-text">Reports & Approvals</h1>
          <p className="text-muted-foreground">
            View, approve/reject, filter, and export timesheet data
            {!isAdmin && isHod && (
              <span className="ml-2 text-amber-600">(Showing timesheets for your projects)</span>
            )}
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                {pendingCount} pending approval
              </span>
            )}
          </p>
        </div>

        <Card className="mb-6 shadow-glow animate-slide-up">
          <CardHeader>
            <CardTitle>Filters & Export</CardTitle>
            <CardDescription>
              Search, filter by project/status, then export to Excel or PDF
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, ID, or project..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Input
                type="date"
                placeholder="Start Date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
              />
              <Input
                type="date"
                placeholder="End Date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
              />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {filterableProjects.map((project) => (
                    <SelectItem key={project} value={project}>
                      {project}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={exportToExcel} className="gap-2 btn-press hover:shadow-lg transition-all duration-200">
                <FileSpreadsheet className="h-4 w-4" />
                Export to Excel
              </Button>
              <Button onClick={exportToPDF} variant="secondary" className="gap-2 btn-press hover:shadow-lg transition-all duration-200">
                <FileText className="h-4 w-4" />
                Export to PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Consolidated Approval Summary */}
        {pendingEmployees.length > 0 && (
          <Card className="mb-6 animate-slide-up">
            <CardHeader>
              <CardTitle>Pending Approval Summary</CardTitle>
              <CardDescription>
                Employees with pending timesheet entries requiring approval
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 font-semibold">Employee</th>
                      <th className="text-left p-2 font-semibold">Employee ID</th>
                      <th className="text-right p-2 font-semibold">Pending Entries</th>
                      <th className="text-right p-2 font-semibold">Pending Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingEmployees.map((emp) => (
                      <tr key={emp.employee_id} className="border-b border-border hover:bg-muted/50">
                        <td className="p-2 font-medium">{emp.name}</td>
                        <td className="p-2 text-muted-foreground">{emp.employee_id}</td>
                        <td className="p-2 text-right">
                          <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
                            {emp.count}
                          </Badge>
                        </td>
                        <td className="p-2 text-right font-medium">{emp.hours.toFixed(1)}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle>Timesheet Entries ({filteredTimesheets.length})</CardTitle>
            <CardDescription>
              Click approve or reject to update timesheet status. Users will be notified.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredTimesheets.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No entries found matching your filters
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 font-semibold">Dates</th>
                      <th className="text-left p-3 font-semibold">Employee</th>
                      <th className="text-left p-3 font-semibold">Project</th>
                      <th className="text-left p-3 font-semibold max-w-[200px]">Description</th>
                      <th className="text-right p-3 font-semibold">Hours</th>
                      <th className="text-center p-3 font-semibold">Status</th>
                      <th className="text-center p-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTimesheets.map((entry, index) => (
                      <tr
                        key={entry.id}
                        className={`border-b border-border hover:bg-muted/50 transition-all duration-200 row-animate stagger-${Math.min(index % 5 + 1, 5)}`}
                      >
                        <td className="p-3">
                          <div className="text-sm">
                            {new Date(entry.start_date).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            to {new Date(entry.end_date).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{entry.name}</div>
                          <div className="text-xs text-muted-foreground">{entry.employee_id}</div>
                        </td>
                        <td className="p-3">{entry.project}</td>
                        <td className="p-3 max-w-[200px]">
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-muted-foreground line-clamp-2 flex-1" title={entry.description || ""}>
                              {entry.description || "-"}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(entry)}
                              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-primary"
                              title="Edit description"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="p-3 text-right font-semibold text-primary">
                          {parseFloat(entry.hours).toFixed(1)}h
                        </td>
                        <td className="p-3 text-center">
                          {getStatusBadge(entry.status)}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-center gap-1">
                            {entry.status === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStatusChange(entry.id, entry.user_id, "approved", entry.project)}
                                  disabled={processingId === entry.id}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-500/10 h-8 px-2"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStatusChange(entry.id, entry.user_id, "rejected", entry.project)}
                                  disabled={processingId === entry.id}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(entry.id)}
                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Description Dialog */}
        <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Timesheet Entry</DialogTitle>
              <DialogDescription>
                Update description{editingEntry?.status === "pending" ? " and hours" : ""} for this entry.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {editingEntry && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">{editingEntry.name}</span> - {editingEntry.project} ({new Date(editingEntry.start_date).toLocaleDateString()})
                </div>
              )}
              {/* Hours field - only editable for pending entries */}
              {editingEntry?.status === "pending" && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Hours</label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={editHours}
                    onChange={(e) => setEditHours(e.target.value)}
                    placeholder="Enter hours..."
                  />
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1 block">Description</label>
                <Textarea
                  placeholder="Enter task description..."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingEntry(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateDescription} disabled={processingId === editingEntry?.id}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} KAVEESHA ENGINEERS INDIA PRIVATE LIMITED. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
