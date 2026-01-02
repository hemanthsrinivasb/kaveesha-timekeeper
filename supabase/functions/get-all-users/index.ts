import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Get the auth token from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with user's token to check if they're admin
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callingUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !callingUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if calling user is admin
    const { data: roleData } = await supabaseUser.rpc("has_role", {
      _user_id: callingUser.id,
      _role: "admin",
    });

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to get all users
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get all profiles with their assignments
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select(`
        id,
        email,
        display_name,
        employee_id,
        password_changed_at,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (profilesError) {
      return new Response(JSON.stringify({ error: profilesError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all project assignments
    const { data: assignments, error: assignmentsError } = await supabaseAdmin
      .from("project_assignments")
      .select(`
        user_id,
        project_id,
        projects (
          name
        )
      `);

    if (assignmentsError) {
      return new Response(JSON.stringify({ error: assignmentsError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all user roles
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");

    if (rolesError) {
      return new Response(JSON.stringify({ error: rolesError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map assignments to users
    const userProjects: Record<string, string[]> = {};
    for (const assignment of assignments || []) {
      if (!userProjects[assignment.user_id]) {
        userProjects[assignment.user_id] = [];
      }
      const projects = assignment.projects as unknown as { name: string } | null;
      if (projects?.name) {
        userProjects[assignment.user_id].push(projects.name);
      }
    }

    // Map roles to users
    const userRoles: Record<string, string> = {};
    for (const role of roles || []) {
      userRoles[role.user_id] = role.role;
    }

    // Combine data
    const users = profiles?.map((profile) => ({
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name,
      employeeId: profile.employee_id,
      passwordChangedAt: profile.password_changed_at,
      createdAt: profile.created_at,
      projects: userProjects[profile.id] || [],
      role: userRoles[profile.id] || "user",
    }));

    return new Response(JSON.stringify({ users }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
