import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, FolderOpen, UserPlus, Crown, Search } from "lucide-react";
import { UserAssignment } from "@/components/UserAssignment";
import { HODAssignment } from "@/components/HODAssignment";

interface Project {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export default function Projects() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [hodDialogOpen, setHodDialogOpen] = useState(false);
  const [selectedProjectForAssignment, setSelectedProjectForAssignment] = useState<Project | null>(null);
  const [selectedProjectForHod, setSelectedProjectForHod] = useState<Project | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
    if (!loading && user && role !== "admin") {
      navigate("/");
      toast.error("Access denied. Admin only.");
    }
  }, [user, role, loading, navigate]);

  useEffect(() => {
    if (user && role === "admin") {
      fetchProjects();
    }
  }, [user, role]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("name");

      if (error) throw error;
      setProjects(data || []);
      setFilteredProjects(data || []);
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast.error("Failed to load projects");
    } finally {
      setLoadingProjects(false);
    }
  };

  // Real-time search filtering
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredProjects(projects);
    } else {
      const lowerSearch = searchTerm.toLowerCase();
      setFilteredProjects(
        projects.filter((p) =>
          p.name.toLowerCase().includes(lowerSearch) ||
          (p.description && p.description.toLowerCase().includes(lowerSearch))
        )
      );
    }
  }, [searchTerm, projects]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setIsActive(true);
    setEditingProject(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (project: Project) => {
    setEditingProject(project);
    setName(project.name);
    setDescription(project.description || "");
    setIsActive(project.is_active);
    setDialogOpen(true);
  };

  const openAssignDialog = (project: Project) => {
    setSelectedProjectForAssignment(project);
    setAssignDialogOpen(true);
  };

  const openHodDialog = (project: Project) => {
    setSelectedProjectForHod(project);
    setHodDialogOpen(true);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Project name is required");
      return;
    }

    setSubmitting(true);
    try {
      if (editingProject) {
        const { error } = await supabase
          .from("projects")
          .update({ name: name.trim(), description: description.trim() || null, is_active: isActive })
          .eq("id", editingProject.id);

        if (error) throw error;
        toast.success("Project updated successfully");
      } else {
        const { error } = await supabase
          .from("projects")
          .insert([{ name: name.trim(), description: description.trim() || null, is_active: isActive }]);

        if (error) throw error;
        toast.success("Project created successfully");
      }

      setDialogOpen(false);
      resetForm();
      fetchProjects();
    } catch (error: any) {
      console.error("Error saving project:", error);
      if (error.code === "23505") {
        toast.error("A project with this name already exists");
      } else {
        toast.error("Failed to save project");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (project: Project) => {
    if (!confirm(`Are you sure you want to delete "${project.name}"?`)) return;

    try {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", project.id);

      if (error) throw error;
      toast.success("Project deleted successfully");
      fetchProjects();
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Failed to delete project");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground animate-pulse">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="animate-fade-in">
            <h1 className="text-4xl font-bold mb-2 gradient-text">Project Management</h1>
            <p className="text-muted-foreground">
              Create and manage projects for timesheet entries (Admin Only)
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Project
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card">
              <DialogHeader>
                <DialogTitle>{editingProject ? "Edit Project" : "Create New Project"}</DialogTitle>
                <DialogDescription>
                  {editingProject
                    ? "Update the project details below."
                    : "Add a new project for timesheet entries."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Project Alpha"
                    required
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the project..."
                    rows={3}
                    maxLength={500}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Active Project</Label>
                  <Switch
                    id="is_active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : editingProject ? (
                      "Update Project"
                    ) : (
                      "Create Project"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="animate-slide-up">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  All Projects
                </CardTitle>
                <CardDescription>
                  {filteredProjects.length} of {projects.length} project{projects.length !== 1 ? "s" : ""} shown
                </CardDescription>
              </div>
              {/* Search Bar */}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingProjects ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {projects.length === 0 
                  ? "No projects found. Create your first project above."
                  : "No projects match your search."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">{project.name}</TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {project.description || "-"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              project.is_active
                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {project.is_active ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(project.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openHodDialog(project)}
                              title="Assign Head of Department"
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                            >
                              <Crown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openAssignDialog(project)}
                              title="Assign users"
                              className="text-primary hover:text-primary"
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(project)}
                              title="Edit project"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(project)}
                              className="text-destructive hover:text-destructive"
                              title="Delete project"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Assignment Dialog */}
        {selectedProjectForAssignment && (
          <UserAssignment
            project={selectedProjectForAssignment}
            open={assignDialogOpen}
            onOpenChange={setAssignDialogOpen}
            onAssigned={fetchProjects}
          />
        )}

        {/* HOD Assignment Dialog */}
        {selectedProjectForHod && (
          <HODAssignment
            project={selectedProjectForHod}
            open={hodDialogOpen}
            onOpenChange={setHodDialogOpen}
            onAssigned={fetchProjects}
          />
        )}


        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Kaveesha Engineers Inda PVT. LTD. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}