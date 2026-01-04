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
import { Loader2, UserPlus, Search, Trash2, Plus } from "lucide-react";
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

interface AssignedUser {
  id: string;
  user_id: string;
  profile: Profile;
}

export function UserAssignment({ project, open, onOpenChange, onAssigned }: UserAssignmentProps) {
  const { user } = useAuth();
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

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

      // Fetch existing assignments for this project
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("project_assignments")
        .select("id, user_id")
        .eq("project_id", project.id);

      if (assignmentsError) throw assignmentsError;

      setAllProfiles(profilesData || []);

      // Map assignments with profile info
      const assignedWithProfiles = (assignmentsData || []).map((assignment) => {
        const profile = profilesData?.find((p) => p.id === assignment.user_id);
        return {
          id: assignment.id,
          user_id: assignment.user_id,
          profile: profile || { id: assignment.user_id, email: null, display_name: "Unknown User" },
        };
      });

      setAssignedUsers(assignedWithProfiles);
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
      const { error: assignError } = await supabase
        .from("project_assignments")
        .insert({
          project_id: project.id,
          user_id: profileId,
          assigned_by: user.id,
        });

      if (assignError) throw assignError;

      const assignedProfile = allProfiles.find((p) => p.id === profileId);

      // Create notification for the assigned user
      await supabase.from("notifications").insert({
        user_id: profileId,
        title: "Project Assignment",
        message: `You have been assigned to project "${project.name}"`,
        type: "project_assignment",
        metadata: { project_id: project.id, project_name: project.name },
      });

      toast.success(
        `${assignedProfile?.display_name || assignedProfile?.email} has been assigned`
      );

      fetchData();
      onAssigned();
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

  const handleRemove = async (assignmentId: string, userId: string) => {
    setRemovingUserId(userId);
    try {
      const { error } = await supabase
        .from("project_assignments")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;

      toast.success("User removed from project");
      fetchData();
      onAssigned();
    } catch (error) {
      console.error("Error removing user:", error);
      toast.error("Failed to remove user");
    } finally {
      setRemovingUserId(null);
    }
  };

  const assignedUserIds = new Set(assignedUsers.map((a) => a.user_id));

  const availableProfiles = allProfiles.filter(
    (p) =>
      !assignedUserIds.has(p.id) &&
      (searchQuery === "" ||
        p.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredAssignedUsers = assignedUsers.filter(
    (a) =>
      searchQuery === "" ||
      a.profile.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.profile.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Manage Users - {project.name}
          </DialogTitle>
          <DialogDescription>
            Add or remove users from this project
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
              {/* Assigned Users Section */}
              <div>
                <Label className="text-sm font-medium">
                  Assigned Users ({assignedUsers.length})
                </Label>
                <ScrollArea className="h-40 mt-2 rounded-md border">
                  {filteredAssignedUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 text-center">
                      {assignedUsers.length === 0
                        ? "No users assigned yet"
                        : "No matching users found"}
                    </p>
                  ) : (
                    <div className="p-2 space-y-1">
                      {filteredAssignedUsers.map((assigned) => (
                        <div
                          key={assigned.id}
                          className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
                        >
                          <span className="text-sm truncate flex-1">
                            {assigned.profile.display_name || assigned.profile.email || "Unknown"}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemove(assigned.id, assigned.user_id)}
                            disabled={removingUserId === assigned.user_id}
                          >
                            {removingUserId === assigned.user_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Available Users Section */}
              <div>
                <Label className="text-sm font-medium">
                  Available Users ({availableProfiles.length})
                </Label>
                <ScrollArea className="h-40 mt-2 rounded-md border">
                  {availableProfiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 text-center">
                      {searchQuery
                        ? "No matching users found"
                        : "All users are already assigned"}
                    </p>
                  ) : (
                    <div className="p-2 space-y-1">
                      {availableProfiles.slice(0, 50).map((profile) => (
                        <div
                          key={profile.id}
                          className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
                        >
                          <span className="text-sm truncate flex-1">
                            {profile.display_name || profile.email || "Unknown"}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                            onClick={() => handleAssign(profile.id)}
                            disabled={submitting}
                          >
                            {submitting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
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