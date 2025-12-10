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
import { Loader2, UserPlus } from "lucide-react";
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

interface UserAssignmentProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
}

export function UserAssignment({ project, open, onOpenChange, onAssigned }: UserAssignmentProps) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchProfiles();
    }
  }, [open]);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      // Fetch all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("display_name");

      if (profilesError) throw profilesError;

      // Fetch existing assignments for this project
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("project_assignments")
        .select("user_id")
        .eq("project_id", project.id);

      if (assignmentsError) throw assignmentsError;

      const assignedUserIds = new Set(assignmentsData?.map((a) => a.user_id) || []);

      // Filter out already assigned users
      const availableProfiles = (profilesData || []).filter(
        (p) => !assignedUserIds.has(p.id)
      );

      setProfiles(availableProfiles);
    } catch (error) {
      console.error("Error fetching profiles:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedUserId || !user) return;

    setSubmitting(true);
    try {
      // Create assignment
      const { error: assignError } = await supabase
        .from("project_assignments")
        .insert({
          project_id: project.id,
          user_id: selectedUserId,
          assigned_by: user.id,
        });

      if (assignError) throw assignError;

      // Get user info for notification
      const assignedProfile = profiles.find((p) => p.id === selectedUserId);

      // Create notification for the assigned user
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: selectedUserId,
          title: "Project Assignment",
          message: `You have been assigned to project "${project.name}"`,
          type: "project_assignment",
          metadata: { project_id: project.id, project_name: project.name },
        });

      if (notifError) {
        console.error("Error creating notification:", notifError);
      }

      toast.success(
        `${assignedProfile?.display_name || assignedProfile?.email} has been assigned to ${project.name}`
      );
      
      onAssigned();
      onOpenChange(false);
      setSelectedUserId("");
    } catch (error: any) {
      console.error("Error assigning user:", error);
      if (error.code === "23505") {
        toast.error("User is already assigned to this project");
      } else {
        toast.error("Failed to assign user");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Assign User to Project
          </DialogTitle>
          <DialogDescription>
            Select a user to assign to "{project.name}". They will receive a notification.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="user">Select User</Label>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                All users are already assigned to this project.
              </p>
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
            <Button
              onClick={handleAssign}
              disabled={!selectedUserId || submitting}
              className="flex-1"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Assign User"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
