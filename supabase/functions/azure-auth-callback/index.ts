import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get('AZURE_AD_CLIENT_ID');
    const clientSecret = Deno.env.get('AZURE_AD_CLIENT_SECRET');
    const tenantId = Deno.env.get('AZURE_AD_TENANT_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!clientId || !clientSecret || !tenantId) {
      console.error('Missing Azure AD configuration');
      return new Response(JSON.stringify({ error: 'Azure AD not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { code, redirectUri } = await req.json();

    if (!code) {
      return new Response(JSON.stringify({ error: 'No authorization code provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Exchanging code for tokens...');

    // Exchange code for tokens
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'openid profile email',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return new Response(JSON.stringify({ error: 'Token exchange failed', details: errorData }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokens = await tokenResponse.json();
    console.log('Token exchange successful');

    // Get user info from Microsoft Graph
    const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error('Failed to get user info');
      return new Response(JSON.stringify({ error: 'Failed to get user info' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userInfo = await userInfoResponse.json();
    console.log('User info retrieved:', userInfo.mail || userInfo.userPrincipalName);

    const email = userInfo.mail || userInfo.userPrincipalName;
    const displayName = userInfo.displayName || email;
    const msId = userInfo.id;

    // Create Supabase admin client
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if user exists by email
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return new Response(JSON.stringify({ error: 'Failed to check existing users' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let userId: string;
    const existingUser = existingUsers.users.find(u => u.email === email);

    if (existingUser) {
      // User exists, use their ID
      userId = existingUser.id;
      console.log('Existing user found:', userId);
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        email_confirm: true,
        user_metadata: {
          full_name: displayName,
          sub: msId,
          provider: 'azure',
        },
      });

      if (createError) {
        console.error('Error creating user:', createError);
        return new Response(JSON.stringify({ error: 'Failed to create user' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      userId = newUser.user.id;
      console.log('New user created:', userId);
    }

    // Generate a magic link / session for the user
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: redirectUri.replace('/auth/azure/callback', '/dashboard'),
      },
    });

    if (sessionError) {
      console.error('Error generating session:', sessionError);
      return new Response(JSON.stringify({ error: 'Failed to generate session' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update profile with MS ID if needed
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ ms_id: msId })
      .eq('id', userId);

    if (profileError) {
      console.log('Profile update note:', profileError.message);
    }

    console.log('Azure AD authentication successful for:', email);

    return new Response(JSON.stringify({ 
      success: true,
      email,
      magicLink: sessionData.properties?.action_link,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in azure-auth-callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
