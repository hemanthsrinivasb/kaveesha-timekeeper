import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Shield, Search, Plus, Trash2 } from "lucide-react";
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

interface AdminAssignmentProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
}

interface AssignedAdmin {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
}

export function AdminAssignment({ project, open, onOpenChange, onAssigned }: AdminAssignmentProps) {
  const { user } = useAuth();
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [assignedAdmins, setAssignedAdmins] = useState<AssignedAdmin[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchData();
      setSearchQuery("");
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

      // Fetch current admin assignments for this project
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("project_admins")
        .select("id, user_id")
        .eq("project_id", project.id);

      if (assignmentsError) throw assignmentsError;

      // Map assignments to include profile info
      const assignedWithProfiles: AssignedAdmin[] = (assignmentsData || []).map((assignment) => {
        const profile = profilesData?.find((p) => p.id === assignment.user_id);
        return {
          id: assignment.id,
          user_id: assignment.user_id,
          display_name: profile?.display_name || null,
          email: profile?.email || null,
        };
      });

      setAllProfiles(profilesData || []);
      setAssignedAdmins(assignedWithProfiles);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (profileId: string) => {
    if (!user) return;

    setSubmitting(true);
    try {
      const { error: assignError } = await supabase.from("project_admins").insert({
        project_id: project.id,
        user_id: profileId,
        assigned_by: user.id,
      });

      if (assignError) throw assignError;

      const assignedProfile = allProfiles.find((p) => p.id === profileId);

      // Create notification for the assigned admin
      await supabase.from("notifications").insert({
        user_id: profileId,
        title: "Project Admin Assignment",
        message: `You have been assigned as an admin for project "${project.name}".`,
        type: "admin_assignment",
        metadata: { project_id: project.id, project_name: project.name },
      });

      toast.success(
        `${assignedProfile?.display_name || assignedProfile?.email} added as admin for ${project.name}`
      );

      fetchData();
      onAssigned();
    } catch (error: any) {
      console.error("Error assigning admin:", error);
      if (error.code === "23505") {
        toast.error("This user is already an admin for this project");
      } else {
        toast.error("Failed to assign admin");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (assignmentId: string, adminName: string) => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("project_admins")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;

      toast.success(`Removed ${adminName} from project admins`);
      fetchData();
      onAssigned();
    } catch (error) {
      console.error("Error removing admin:", error);
      toast.error("Failed to remove admin");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter out already assigned admins from available list
  const assignedUserIds = assignedAdmins.map((a) => a.user_id);
  const availableProfiles = allProfiles.filter(
    (p) =>
      !assignedUserIds.includes(p.id) &&
      (searchQuery === "" ||
        p.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredAssignedAdmins = assignedAdmins.filter(
    (a) =>
      searchQuery === "" ||
      a.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Assign Project Admins
          </DialogTitle>
          <DialogDescription>
            Assign multiple admins to "{project.name}". Project admins have management access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Assigned Admins */}
              <div>
                <Label className="text-sm font-medium">
                  Assigned Admins ({filteredAssignedAdmins.length})
                </Label>
                <ScrollArea className="h-32 mt-2 rounded-md border">
                  {filteredAssignedAdmins.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 text-center">
                      No admins assigned yet
                    </p>
                  ) : (
                    <div className="p-2 space-y-1">
                      {filteredAssignedAdmins.map((admin) => (
                        <div
                          key={admin.id}
                          className="flex items-center justify-between p-2 rounded-md bg-primary/5 border border-primary/10"
                        >
                          <span className="text-sm truncate flex-1">
                            {admin.display_name || admin.email || "Unknown"}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() =>
                              handleRemove(admin.id, admin.display_name || admin.email || "Admin")
                            }
                            disabled={submitting}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Available Users */}
              <div>
                <Label className="text-sm font-medium">
                  Available Users ({availableProfiles.length})
                </Label>
                <ScrollArea className="h-40 mt-2 rounded-md border">
                  {availableProfiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 text-center">
                      {searchQuery ? "No matching users found" : "All users are already assigned"}
                    </p>
                  ) : (
                    <div className="p-2 space-y-1">
                      {availableProfiles.slice(0, 50).map((profile) => (
                        <div
                          key={profile.id}
                          className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors"
                        >
                          <span className="text-sm truncate flex-1">
                            {profile.display_name || profile.email || "Unknown"}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
                            onClick={() => handleAssign(profile.id)}
                            disabled={submitting}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
