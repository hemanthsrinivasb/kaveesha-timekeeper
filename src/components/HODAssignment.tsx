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
import { Loader2, Crown, Search, Check } from "lucide-react";
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
  const [currentHodId, setCurrentHodId] = useState<string | null>(null);
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

      // Fetch current HOD for this project
      const { data: hodData, error: hodError } = await supabase
        .from("project_hods")
        .select("user_id")
        .eq("project_id", project.id)
        .maybeSingle();

      if (hodError) throw hodError;

      setProfiles(profilesData || []);
      setCurrentHodId(hodData?.user_id || null);
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
      // Delete existing HOD assignment if any
      await supabase.from("project_hods").delete().eq("project_id", project.id);

      // Create new assignment
      const { error: assignError } = await supabase.from("project_hods").insert({
        project_id: project.id,
        user_id: profileId,
        assigned_by: user.id,
      });

      if (assignError) throw assignError;

      const assignedProfile = profiles.find((p) => p.id === profileId);

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

      setCurrentHodId(profileId);
      onAssigned();
    } catch (error: any) {
      console.error("Error assigning HOD:", error);
      toast.error("Failed to assign Head of Department");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveHod = async () => {
    if (!currentHodId) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("project_hods")
        .delete()
        .eq("project_id", project.id);

      if (error) throw error;

      toast.success(`Removed HOD from ${project.name}`);
      setCurrentHodId(null);
      onAssigned();
    } catch (error) {
      console.error("Error removing HOD:", error);
      toast.error("Failed to remove HOD");
    } finally {
      setSubmitting(false);
    }
  };

  const currentHodProfile = profiles.find((p) => p.id === currentHodId);

  const filteredProfiles = profiles.filter(
    (p) =>
      searchQuery === "" ||
      p.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Assign Head of Department
          </DialogTitle>
          <DialogDescription>
            Assign a HOD for "{project.name}". The HOD can approve/reject timesheets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Current HOD */}
          {currentHodProfile && (
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current HOD:</p>
                <p className="text-primary font-semibold">
                  {currentHodProfile.display_name || currentHodProfile.email}
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemoveHod}
                disabled={submitting}
              >
                Remove
              </Button>
            </div>
          )}

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
            <div>
              <Label className="text-sm font-medium">Select HOD</Label>
              <ScrollArea className="h-56 mt-2 rounded-md border">
                {filteredProfiles.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">
                    No matching users found
                  </p>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredProfiles.slice(0, 50).map((profile) => (
                      <div
                        key={profile.id}
                        className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                          currentHodId === profile.id
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => {
                          if (currentHodId !== profile.id && !submitting) {
                            handleAssign(profile.id);
                          }
                        }}
                      >
                        <span className="text-sm truncate flex-1">
                          {profile.display_name || profile.email || "Unknown"}
                        </span>
                        {currentHodId === profile.id && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
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