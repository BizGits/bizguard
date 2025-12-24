import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to mask user IDs for logging (show first 8 chars only)
function maskUserId(id: string): string {
  if (!id || id.length < 8) return '***';
  return id.substring(0, 8) + '...';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ 
        valid: false,
        error: 'No authorization token provided',
        mode: 'unauthenticated'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Create Supabase client with the user's token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Try to get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.log('Token validation failed');
      return new Response(JSON.stringify({ 
        valid: false,
        error: userError?.message || 'Invalid token',
        mode: 'limited'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, display_name, extension_active, last_heartbeat')
      .eq('id', user.id)
      .single();

    // Get user role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    console.log('Token validated for user:', maskUserId(user.id));

    return new Response(JSON.stringify({ 
      valid: true,
      mode: 'connected',
      user: {
        id: user.id,
        email: user.email,
        displayName: profile?.display_name || user.user_metadata?.full_name || user.email,
        role: roleData?.role || 'MANAGEMENT',
        extensionActive: profile?.extension_active ?? false,
        lastHeartbeat: profile?.last_heartbeat,
      },
      tokenExpiresAt: user.app_metadata?.exp || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in /me endpoint');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      valid: false,
      error: errorMessage,
      mode: 'error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
