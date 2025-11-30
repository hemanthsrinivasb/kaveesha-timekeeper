import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Download, FileSpreadsheet, FileText, Search } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Reports() {
  const navigate = useNavigate();
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [filteredTimesheets, setFilteredTimesheets] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    checkUser();
    fetchTimesheets();
  }, []);

  useEffect(() => {
    filterTimesheets();
  }, [searchTerm, startDate, endDate, timesheets]);

  const checkUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
    }
  };

  const fetchTimesheets = async () => {
    try {
      const { data, error } = await supabase
        .from("timesheets")
        .select("*")
        .order("date", { ascending: false });

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

    if (startDate) {
      filtered = filtered.filter((entry) => entry.date >= startDate);
    }

    if (endDate) {
      filtered = filtered.filter((entry) => entry.date <= endDate);
    }

    setFilteredTimesheets(filtered);
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredTimesheets.map((entry) => ({
        Date: new Date(entry.date).toLocaleDateString(),
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
      head: [["Date", "Name", "Employee ID", "Project", "Hours"]],
      body: filteredTimesheets.map((entry) => [
        new Date(entry.date).toLocaleDateString(),
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
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input
                type="date"
                placeholder="End Date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={exportToExcel} className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Export to Excel
              </Button>
              <Button onClick={exportToPDF} variant="secondary" className="gap-2">
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
                      <th className="text-left p-3 font-semibold">Date</th>
                      <th className="text-left p-3 font-semibold">Name</th>
                      <th className="text-left p-3 font-semibold">Employee ID</th>
                      <th className="text-left p-3 font-semibold">Project</th>
                      <th className="text-right p-3 font-semibold">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTimesheets.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b border-border hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-3">
                          {new Date(entry.date).toLocaleDateString()}
                        </td>
                        <td className="p-3">{entry.name}</td>
                        <td className="p-3">{entry.employee_id}</td>
                        <td className="p-3">{entry.project}</td>
                        <td className="p-3 text-right font-semibold text-primary">
                          {parseFloat(entry.hours).toFixed(1)}h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
