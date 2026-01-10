import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Project {
  id: string;
  name: string;
  description: string | null;
}

interface ProjectSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  showAllProjects?: boolean; // For admin usage
}

export function ProjectSelect({ value, onValueChange, disabled, showAllProjects = false }: ProjectSelectProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, role } = useAuth();

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user, role, showAllProjects]);

  const fetchProjects = async () => {
    if (!user) return;
    
    try {
      // Only show all projects when explicitly requested (for admin management pages)
      if (showAllProjects) {
        const { data, error } = await supabase
          .from("projects")
          .select("id, name, description")
          .eq("is_active", true)
          .order("name");

        if (error) throw error;
        setProjects(data || []);
      } else {
        // All users (including admins) see only their assigned projects for timesheet filling
        // Regular users - show only assigned projects
        const { data, error } = await supabase
          .from("project_assignments")
          .select(`
            project_id,
            projects (
              id,
              name,
              description
            )
          `)
          .eq("user_id", user.id);

        if (error) throw error;

        const assignedProjects = (data || [])
          .filter((assignment: any) => assignment.projects)
          .map((assignment: any) => ({
            id: assignment.projects.id,
            name: assignment.projects.name,
            description: assignment.projects.description,
          }));

        setProjects(assignedProjects);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center h-10 px-3 border rounded-md bg-background">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="w-full bg-background min-w-[180px]">
        <SelectValue placeholder="Select a project" />
      </SelectTrigger>
      <SelectContent className="bg-popover z-50 max-h-[300px]">
        {projects.length === 0 ? (
          <div className="p-2 text-sm text-muted-foreground">
            {role === 'admin' ? 'No projects available' : 'No projects assigned to you'}
          </div>
        ) : (
          projects.map((project) => (
            <SelectItem key={project.id} value={project.name}>
              <div className="flex flex-col max-w-[300px]">
                <span className="truncate font-medium">{project.name}</span>
                {project.description && (
                  <span className="text-xs text-muted-foreground truncate">{project.description}</span>
                )}
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
