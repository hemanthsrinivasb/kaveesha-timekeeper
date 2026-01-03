import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Crown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
}

interface Project {
  id: string;
  name: string;
}

interface HODAssignmentProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
}

export function HODAssignment({ project, open, onOpenChange, onAssigned }: HODAssignmentProps) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentHod, setCurrentHod] = useState<Profile | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, project.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, display_name")
        .order("display_name");

      if (profilesError) throw profilesError;

      // Fetch current HOD for this project
      const { data: hodData, error: hodError } = await supabase
        .from("project_hods")
        .select("user_id")
        .eq("project_id", project.id)
        .maybeSingle();

      if (hodError) throw hodError;

      setProfiles(profilesData || []);
      
      if (hodData) {
        const hod = profilesData?.find(p => p.id === hodData.user_id);
        setCurrentHod(hod || null);
        setSelectedUserId(hodData.user_id);
      } else {
        setCurrentHod(null);
        setSelectedUserId("");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedUserId || !user) return;

    setSubmitting(true);
    try {
      // Delete existing HOD assignment if any
      await supabase
        .from("project_hods")
        .delete()
        .eq("project_id", project.id);

      // Create new assignment
      const { error: assignError } = await supabase
        .from("project_hods")
        .insert({
          project_id: project.id,
          user_id: selectedUserId,
          assigned_by: user.id,
        });

      if (assignError) throw assignError;

      // Get user info for notification
      const assignedProfile = profiles.find((p) => p.id === selectedUserId);

      // Create notification for the assigned HOD
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: selectedUserId,
          title: "Head of Department Assignment",
          message: `You have been assigned as Head of Department for project "${project.name}". You can now approve/reject timesheets for this project.`,
          type: "hod_assignment",
          metadata: { project_id: project.id, project_name: project.name },
        });

      if (notifError) {
        console.error("Error creating notification:", notifError);
      }

      toast.success(
        `${assignedProfile?.display_name || assignedProfile?.email} is now HOD for ${project.name}`
      );
      
      onAssigned();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error assigning HOD:", error);
      toast.error("Failed to assign Head of Department");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveHod = async () => {
    if (!currentHod) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("project_hods")
        .delete()
        .eq("project_id", project.id);

      if (error) throw error;

      toast.success(`Removed HOD from ${project.name}`);
      setCurrentHod(null);
      setSelectedUserId("");
      onAssigned();
    } catch (error) {
      console.error("Error removing HOD:", error);
      toast.error("Failed to remove HOD");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Assign Head of Department
          </DialogTitle>
          <DialogDescription>
            Assign a Head of Department for "{project.name}". The HOD can approve/reject timesheets for this project.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          {currentHod && (
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-sm font-medium">Current HOD:</p>
              <p className="text-primary font-semibold">
                {currentHod.display_name || currentHod.email}
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="hod">Select New HOD</Label>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.display_name || profile.email || "Unknown User"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            {currentHod && (
              <Button
                variant="destructive"
                onClick={handleRemoveHod}
                disabled={submitting}
              >
                Remove HOD
              </Button>
            )}
            <Button
              onClick={handleAssign}
              disabled={!selectedUserId || submitting}
              className="flex-1"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Assign HOD"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
