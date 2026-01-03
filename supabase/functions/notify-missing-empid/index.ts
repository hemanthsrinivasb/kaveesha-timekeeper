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

    // Use service role to get all users without employee_id
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get all profiles without employee_id
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, email, employee_id")
      .or("employee_id.is.null,employee_id.eq.");

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      return new Response(JSON.stringify({ error: profilesError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${profiles?.length || 0} users without employee_id`);

    // Filter out users who already have a pending notification for this
    const usersToNotify = profiles?.filter(p => !p.employee_id || p.employee_id.trim() === "") || [];
    
    if (usersToNotify.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "All users have Employee ID configured",
        notified: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for existing unread notifications of this type
    const { data: existingNotifications } = await supabaseAdmin
      .from("notifications")
      .select("user_id")
      .eq("type", "empid_setup")
      .eq("is_read", false);

    const usersWithExistingNotification = new Set(existingNotifications?.map(n => n.user_id) || []);

    // Create notifications for users who don't already have one
    const notificationsToInsert = usersToNotify
      .filter(u => !usersWithExistingNotification.has(u.id))
      .map(user => ({
        user_id: user.id,
        title: "Employee ID Required",
        message: "Please setup your Employee ID to complete your profile.",
        type: "empid_setup",
        is_read: false,
        metadata: { action: "setup_empid" }
      }));

    if (notificationsToInsert.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "All applicable users already have pending notifications",
        notified: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertError } = await supabaseAdmin
      .from("notifications")
      .insert(notificationsToInsert);

    if (insertError) {
      console.error("Error inserting notifications:", insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Sent notifications to ${notificationsToInsert.length} users`);

    return new Response(JSON.stringify({ 
      success: true,
      message: `Notifications sent to ${notificationsToInsert.length} users`,
      notified: notificationsToInsert.length,
      skipped: usersToNotify.length - notificationsToInsert.length
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-missing-empid:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
