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
import { Loader2, Crown, Search, Trash2, Plus } from "lucide-react";
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

interface AssignedHOD {
  id: string;
  user_id: string;
  profile: Profile;
}

export function HODAssignment({ project, open, onOpenChange, onAssigned }: HODAssignmentProps) {
  const { user } = useAuth();
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [assignedHODs, setAssignedHODs] = useState<AssignedHOD[]>([]);
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

      // Fetch existing HOD assignments for this project
      const { data: hodsData, error: hodsError } = await supabase
        .from("project_hods")
        .select("id, user_id")
        .eq("project_id", project.id);

      if (hodsError) throw hodsError;

      setAllProfiles(profilesData || []);

      // Map assignments with profile info
      const assignedWithProfiles = (hodsData || []).map((hod) => {
        const profile = profilesData?.find((p) => p.id === hod.user_id);
        return {
          id: hod.id,
          user_id: hod.user_id,
          profile: profile || { id: hod.user_id, email: null, display_name: "Unknown User" },
        };
      });

      setAssignedHODs(assignedWithProfiles);
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
        .from("project_hods")
        .insert({
          project_id: project.id,
          user_id: profileId,
          assigned_by: user.id,
        });

      if (assignError) throw assignError;

      const assignedProfile = allProfiles.find((p) => p.id === profileId);

      // Create notification for the assigned HOD
      await supabase.from("notifications").insert({
        user_id: profileId,
        title: "Head of Department Assignment",
        message: `You have been assigned as Head of Department for project "${project.name}". You can now approve/reject timesheets for this project.`,
        type: "hod_assignment",
        metadata: { project_id: project.id, project_name: project.name },
      });

      toast.success(
        `${assignedProfile?.display_name || assignedProfile?.email} is now HOD for ${project.name}`
      );

      fetchData();
      onAssigned();
    } catch (error: any) {
      console.error("Error assigning HOD:", error);
      if (error.code === "23505") {
        toast.error("User is already assigned as HOD for this project");
      } else {
        toast.error("Failed to assign Head of Department");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (assignmentId: string, userId: string) => {
    setRemovingUserId(userId);
    try {
      const { error } = await supabase
        .from("project_hods")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;

      toast.success("HOD removed from project");
      fetchData();
      onAssigned();
    } catch (error) {
      console.error("Error removing HOD:", error);
      toast.error("Failed to remove HOD");
    } finally {
      setRemovingUserId(null);
    }
  };

  const assignedHODIds = new Set(assignedHODs.map((a) => a.user_id));

  const availableProfiles = allProfiles.filter(
    (p) =>
      !assignedHODIds.has(p.id) &&
      (searchQuery === "" ||
        p.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredAssignedHODs = assignedHODs.filter(
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
            <Crown className="h-5 w-5 text-primary" />
            Manage HODs - {project.name}
          </DialogTitle>
          <DialogDescription>
            Add or remove Heads of Department for this project. HODs can approve/reject timesheets.
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
              {/* Assigned HODs Section */}
              <div>
                <Label className="text-sm font-medium">
                  Assigned HODs ({assignedHODs.length})
                </Label>
                <ScrollArea className="h-40 mt-2 rounded-md border">
                  {filteredAssignedHODs.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 text-center">
                      {assignedHODs.length === 0
                        ? "No HODs assigned yet"
                        : "No matching HODs found"}
                    </p>
                  ) : (
                    <div className="p-2 space-y-1">
                      {filteredAssignedHODs.map((assigned) => (
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
                        : "All users are already assigned as HODs"}
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