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

interface Project {
  id: string;
  name: string;
  description: string | null;
}

interface ProjectSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function ProjectSelect({ value, onValueChange, disabled }: ProjectSelectProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, description")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setProjects(data || []);
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
        <span className="ml-2 text-sm text-muted-foreground">Loading projects...</span>
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="w-full bg-background">
        <SelectValue placeholder="Select a project" />
      </SelectTrigger>
      <SelectContent className="bg-popover z-50">
        {projects.length === 0 ? (
          <div className="p-2 text-sm text-muted-foreground">No projects available</div>
        ) : (
          projects.map((project) => (
            <SelectItem key={project.id} value={project.name}>
              <div className="flex flex-col">
                <span>{project.name}</span>
                {project.description && (
                  <span className="text-xs text-muted-foreground">{project.description}</span>
                )}
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}