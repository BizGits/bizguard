import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to mask user IDs for logging (show first 8 chars only)
function maskUserId(id: string): string {
  if (!id || id.length < 8) return '***';
  return id.substring(0, 8) + '...';
}

serve(async (req) => {
  console.log("Heartbeat function called, method:", req.method);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader);
    
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the user's token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth verification failed");
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("User verified:", maskUserId(user.id));

    // Parse body for optional extension info
    let body: any = {};
    try {
      body = await req.json();
      // Log only non-sensitive fields
      console.log("Heartbeat received with browser:", body.browser || 'unknown', "version:", body.extension_version || 'unknown');
    } catch {
      console.log("No body provided");
    }

    const { browser, browser_version, extension_version } = body;
    const now = new Date().toISOString();

    // Update heartbeat and extension status
    const updateData: any = {
      last_heartbeat: now,
      last_seen_at: now,
      extension_active: true,
    };

    // Only update browser info if provided
    if (browser) updateData.browser = browser;
    if (browser_version) updateData.browser_version = browser_version;
    if (extension_version) updateData.extension_version = extension_version;
    
    // Log only field names being updated, not values
    console.log("Updating profile fields:", Object.keys(updateData).join(", "));

    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update(updateData)
      .eq("id", user.id);

    if (updateError) {
      console.error("Update error occurred");
      return new Response(
        JSON.stringify({ error: "Failed to update heartbeat" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Heartbeat SUCCESS for user", maskUserId(user.id));

    return new Response(
      JSON.stringify({ 
        success: true, 
        timestamp: now,
        message: "Heartbeat recorded"
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Heartbeat error occurred");
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
