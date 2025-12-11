import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Fetching active brands with terms...");

    // Fetch active brands with their terms
    const { data: brands, error } = await supabase
      .from("brands")
      .select(`
        id,
        name,
        slug,
        is_active,
        brand_terms (
          id,
          term
        )
      `)
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error fetching brands:", error);
      throw error;
    }

    // Transform data to flatten terms array
    const response = brands?.map((brand) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      isActive: brand.is_active,
      terms: brand.brand_terms?.map((t: { term: string }) => t.term) || [],
    })) || [];

    console.log(`Returning ${response.length} active brands`);

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60" // Cache for 1 minute
        } 
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in brands function:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
