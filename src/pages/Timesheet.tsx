import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { TimesheetForm } from "@/components/TimesheetForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function Timesheet() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground animate-pulse">Loading timesheet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8 animate-fade-in">
            <h1 className="text-4xl font-bold mb-2 gradient-text">Add Timesheet Entry</h1>
            <p className="text-muted-foreground">
              Record your work hours and project details
            </p>
          </div>

          <Card className="shadow-glow animate-slide-up">
            <CardHeader>
              <CardTitle>Timesheet Details</CardTitle>
              <CardDescription>
                Fill in all the required information about your work
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TimesheetForm onSuccess={() => navigate("/")} />
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Kaveesha Engineers Inda PVT. LTD. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
