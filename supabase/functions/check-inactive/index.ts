import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Running check for inactive extensions...");

    // Call the database function to mark inactive extensions
    const { error } = await supabaseClient.rpc("mark_inactive_extensions");

    if (error) {
      console.error("Error marking inactive extensions:", error);
      return new Response(
        JSON.stringify({ error: "Failed to check inactive extensions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get count of now-inactive extensions for logging
    const { count } = await supabaseClient
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("extension_active", false);

    console.log(`Inactive extensions check complete. Total inactive: ${count}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Inactive extensions check completed",
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
