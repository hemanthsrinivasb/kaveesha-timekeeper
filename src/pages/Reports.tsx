import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Download, FileSpreadsheet, FileText, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useAuth } from "@/hooks/useAuth";

export default function Reports() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [filteredTimesheets, setFilteredTimesheets] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
    if (!loading && user && role !== "admin") {
      toast.error("Access denied. Admin only.");
      navigate("/");
    }
  }, [user, role, loading, navigate]);

  useEffect(() => {
    if (user && role === "admin") {
      fetchTimesheets();
    }
  }, [user, role]);

  useEffect(() => {
    filterTimesheets();
  }, [searchTerm, filterStartDate, filterEndDate, timesheets]);

  const fetchTimesheets = async () => {
    try {
      const { data, error } = await supabase
        .from("timesheets")
        .select("*")
        .order("start_date", { ascending: false });

      if (error) throw error;
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

    setFilteredTimesheets(filtered);
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

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredTimesheets.map((entry) => ({
        "Start Date": new Date(entry.start_date).toLocaleDateString(),
        "End Date": new Date(entry.end_date).toLocaleDateString(),
        Name: entry.name,
        "Employee ID": entry.employee_id,
        Project: entry.project,
        Hours: parseFloat(entry.hours).toFixed(2),
      }))
    );

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

    autoTable(doc, {
      startY: 40,
      head: [["Start Date", "End Date", "Name", "Employee ID", "Project", "Hours"]],
      body: filteredTimesheets.map((entry) => [
        new Date(entry.start_date).toLocaleDateString(),
        new Date(entry.end_date).toLocaleDateString(),
        entry.name,
        entry.employee_id,
        entry.project,
        parseFloat(entry.hours).toFixed(2),
      ]),
      theme: "grid",
      headStyles: { fillColor: [126, 58, 242] },
    });

    doc.save(`Timesheet_Report_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF file downloaded successfully!");
  };

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

  if (role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold mb-2 gradient-text">Reports</h1>
          <p className="text-muted-foreground">
            View, filter, and export timesheet data
          </p>
        </div>

        <Card className="mb-6 shadow-glow animate-slide-up">
          <CardHeader>
            <CardTitle>Filters & Export</CardTitle>
            <CardDescription>
              Search and filter entries, then export to Excel or PDF
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle>Timesheet Entries ({filteredTimesheets.length})</CardTitle>
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
                      <th className="text-left p-3 font-semibold">Start Date</th>
                      <th className="text-left p-3 font-semibold">End Date</th>
                      <th className="text-left p-3 font-semibold">Name</th>
                      <th className="text-left p-3 font-semibold">Employee ID</th>
                      <th className="text-left p-3 font-semibold">Project</th>
                      <th className="text-right p-3 font-semibold">Hours</th>
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
                          {new Date(entry.start_date).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          {new Date(entry.end_date).toLocaleDateString()}
                        </td>
                        <td className="p-3 font-medium">{entry.name}</td>
                        <td className="p-3">{entry.employee_id}</td>
                        <td className="p-3">{entry.project}</td>
                        <td className="p-3 text-right font-semibold text-primary">
                          {parseFloat(entry.hours).toFixed(1)}h
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(entry.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 btn-press transition-all duration-200 hover:scale-110"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
