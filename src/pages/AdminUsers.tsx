import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Search, Pencil, Trash2, Loader2, Users, Shield, Bell, ShieldPlus, ShieldMinus, IdCard } from "lucide-react";
import { format } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface User {
  id: string;
  email: string;
  displayName: string;
  employeeId: string;
  passwordChangedAt: string | null;
  createdAt: string;
  projects: string[];
  role: string;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const { user, role, loading, session } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [allProjects, setAllProjects] = useState<string[]>([]);
  const [sendingNotifications, setSendingNotifications] = useState(false);

  // Edit password state
  const [editPasswordOpen, setEditPasswordOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Delete user state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  // Role management state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleAction, setRoleAction] = useState<"promote" | "demote">("promote");
  const [updatingRole, setUpdatingRole] = useState(false);

  // Edit employee ID state
  const [editEmpIdOpen, setEditEmpIdOpen] = useState(false);
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [updatingEmpId, setUpdatingEmpId] = useState(false);

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
    if (user && role === "admin" && session) {
      fetchUsers();
      fetchAllProjectsFromDB();
    }
  }, [user, role, session]);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, projectFilter]);

  const fetchAllProjectsFromDB = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setAllProjects(data?.map((p) => p.name) || []);
    } catch (error: any) {
      console.error("Error fetching projects:", error);
    }
  };

  const fetchUsers = async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-all-users", {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setUsers(data.users || []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error(error.message || "Failed to load users");
    } finally {
      setLoadingData(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.displayName?.toLowerCase().includes(query) ||
          u.email?.toLowerCase().includes(query) ||
          u.employeeId?.toLowerCase().includes(query)
      );
    }

    // Project filter
    if (projectFilter !== "all") {
      filtered = filtered.filter((u) => u.projects.includes(projectFilter));
    }

    setFilteredUsers(filtered);
  };

  const handleEditPassword = (user: User) => {
    setSelectedUser(user);
    setNewPassword("");
    setEditPasswordOpen(true);
  };

  const handleUpdatePassword = async () => {
    if (!selectedUser || !newPassword) return;

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setUpdatingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-update-password", {
        body: { userId: selectedUser.id, newPassword },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success("Password updated successfully");
      setEditPasswordOpen(false);
      fetchUsers(); // Refresh to get updated password_changed_at
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast.error(error.message || "Failed to update password");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!selectedUser) return;

    setDeletingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { userId: selectedUser.id },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success("User deleted successfully");
      setDeleteDialogOpen(false);
      setUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Failed to delete user");
    } finally {
      setDeletingUser(false);
    }
  };

  const handleNotifyMissingEmpId = async () => {
    setSendingNotifications(true);
    try {
      const { data, error } = await supabase.functions.invoke("notify-missing-empid", {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(data.message || "Notifications sent successfully");
    } catch (error: any) {
      console.error("Error sending notifications:", error);
      toast.error(error.message || "Failed to send notifications");
    } finally {
      setSendingNotifications(false);
    }
  };

  // Role management handlers
  const handleRoleChange = (targetUser: User, action: "promote" | "demote") => {
    setSelectedUser(targetUser);
    setRoleAction(action);
    setRoleDialogOpen(true);
  };

  const confirmRoleChange = async () => {
    if (!selectedUser) return;

    const newRole = roleAction === "promote" ? "admin" : "user";
    
    setUpdatingRole(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-update-role", {
        body: { userId: selectedUser.id, newRole },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const actionText = roleAction === "promote" ? "is now an admin" : "is no longer an admin";
      toast.success(`${selectedUser.displayName || selectedUser.email} ${actionText}`);
      setRoleDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast.error(error.message || "Failed to update role");
    } finally {
      setUpdatingRole(false);
    }
  };

  // Edit Employee ID handlers
  const handleEditEmpId = (targetUser: User) => {
    setSelectedUser(targetUser);
    setNewEmployeeId(targetUser.employeeId || "");
    setEditEmpIdOpen(true);
  };

  const handleUpdateEmpId = async () => {
    if (!selectedUser) return;

    setUpdatingEmpId(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-update-employee-id", {
        body: { userId: selectedUser.id, employeeId: newEmployeeId },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success("Employee ID updated successfully");
      setEditEmpIdOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error("Error updating employee ID:", error);
      toast.error(error.message || "Failed to update employee ID");
    } finally {
      setUpdatingEmpId(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground animate-pulse">Loading users...</p>
        </div>
      </div>
    );
  }

  if (role !== "admin") {
    return null;
  }

  const usersWithoutEmpId = users.filter((u) => !u.employeeId || u.employeeId.trim() === "").length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-in flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2 gradient-text">User Management</h1>
            <p className="text-muted-foreground">
              Manage all registered users (Admin Only)
            </p>
          </div>
          {usersWithoutEmpId > 0 && (
            <Button
              onClick={handleNotifyMissingEmpId}
              disabled={sendingNotifications}
              className="gap-2"
            >
              {sendingNotifications ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              Notify Users Without EmpId ({usersWithoutEmpId})
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{users.length}</p>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">
                    {users.filter((u) => u.role === "admin").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Admins</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">
                    {users.filter((u) => u.role === "user").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Regular Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Search & Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or employee ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Filter by project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {allProjects.map((project) => (
                    <SelectItem key={project} value={project}>
                      {project}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>
              Showing {filteredUsers.length} of {users.length} users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Projects</TableHead>
                    <TableHead>Password Changed</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.employeeId || "-"}
                        </TableCell>
                        <TableCell>{u.displayName || "-"}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {u.projects.length > 0 ? (
                              u.projects.map((p) => (
                                <Badge key={p} variant="secondary" className="text-xs">
                                  {p}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-sm">None</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {u.passwordChangedAt
                            ? format(new Date(u.passwordChangedAt), "MMM d, yyyy HH:mm")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.role === "admin" ? "default" : "outline"}>
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <TooltipProvider>
                              {/* Make Admin / Remove Admin Button */}
                              {u.role !== "admin" ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleRoleChange(u, "promote")}
                                      disabled={u.id === user?.id}
                                    >
                                      <ShieldPlus className="h-4 w-4 text-primary" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Make Admin</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : u.id !== user?.id ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleRoleChange(u, "demote")}
                                    >
                                      <ShieldMinus className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Remove Admin</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : null}
                              
                              {/* Edit Employee ID Button */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditEmpId(u)}
                                  >
                                    <IdCard className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Edit Employee ID</p>
                                </TooltipContent>
                              </Tooltip>

                              {/* Edit Password Button */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditPassword(u)}
                                  >
                                    <Pencil className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Edit Password</p>
                                </TooltipContent>
                              </Tooltip>

                              {/* Delete Button */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteUser(u)}
                                    disabled={u.id === user?.id}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Delete User</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} KAVEESHA ENGINEERS INDIA PRIVATE LIMITED. All rights reserved.</p>
        </footer>
      </main>

      {/* Edit Password Dialog */}
      <Dialog open={editPasswordOpen} onOpenChange={setEditPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.displayName || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">New Password</label>
              <Input
                type="password"
                placeholder="Enter new password (min 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPasswordOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePassword} disabled={updatingPassword || !newPassword}>
              {updatingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee ID Dialog */}
      <Dialog open={editEmpIdOpen} onOpenChange={setEditEmpIdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee ID</DialogTitle>
            <DialogDescription>
              Update employee ID for {selectedUser?.displayName || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Employee ID</label>
              <Input
                placeholder="Enter employee ID"
                value={newEmployeeId}
                onChange={(e) => setNewEmployeeId(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEmpIdOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateEmpId} disabled={updatingEmpId}>
              {updatingEmpId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Employee ID"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedUser?.displayName || selectedUser?.email}?
              This action cannot be undone. All user data including timesheets will be permanently
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingUser}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              disabled={deletingUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingUser ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete User"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Role Change Confirmation Dialog */}
      <AlertDialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {roleAction === "promote" ? "Make User Admin" : "Remove Admin Role"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {roleAction === "promote" 
                ? `Are you sure you want to make ${selectedUser?.displayName || selectedUser?.email} an admin? Admins have full access to manage users, projects, and all timesheets.`
                : `Are you sure you want to remove admin privileges from ${selectedUser?.displayName || selectedUser?.email}? They will become a regular user.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updatingRole}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRoleChange}
              disabled={updatingRole}
              className={roleAction === "demote" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {updatingRole ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : roleAction === "promote" ? (
                "Make Admin"
              ) : (
                "Remove Admin"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
