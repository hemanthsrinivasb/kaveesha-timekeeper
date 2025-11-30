import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { TimesheetForm } from "@/components/TimesheetForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function Timesheet() {
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
    }
  };

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
      </main>
    </div>
  );
}
