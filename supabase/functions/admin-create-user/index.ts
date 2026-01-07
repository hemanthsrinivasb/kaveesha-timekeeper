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
      console.log("Auth error:", userError);
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
      console.log("User is not admin:", callingUser.id);
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { firstName, lastName, employeeId, email, password } = await req.json();

    // Validation
    if (!firstName || !lastName || !employeeId || !email || !password) {
      return new Response(JSON.stringify({ error: "All fields are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if employee ID already exists
    const { data: existingEmpId, error: empIdCheckError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (empIdCheckError) {
      console.log("Error checking employee ID:", empIdCheckError);
      return new Response(JSON.stringify({ error: "Failed to validate employee ID" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingEmpId) {
      return new Response(JSON.stringify({ error: "Employee ID already exists" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user via admin API
    const displayName = firstName;
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        display_name: displayName,
        employee_id: employeeId,
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (createError) {
      console.log("Error creating user:", createError);
      if (createError.message.includes("already been registered")) {
        return new Response(JSON.stringify({ error: "Email already registered" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update profile with employee_id and display_name
    if (newUser.user) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          display_name: displayName,
          employee_id: employeeId,
        })
        .eq("id", newUser.user.id);

      if (profileError) {
        console.log("Error updating profile:", profileError);
        // Don't fail the whole operation, user is created
      }
    }

    console.log("User created successfully:", newUser.user?.id);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "User created successfully",
      userId: newUser.user?.id 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in admin-create-user:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
