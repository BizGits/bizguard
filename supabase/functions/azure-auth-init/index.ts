import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const tenantId = Deno.env.get('AZURE_AD_TENANT_ID');
    
    console.log('Azure AD Config:', { 
      clientId: clientId?.substring(0, 8) + '...', 
      tenantId: tenantId?.substring(0, 8) + '...',
      tenantIdFull: tenantId // Log full tenant to debug
    });
    
    if (!clientId || !tenantId) {
      console.error('Missing Azure AD configuration');
      return new Response(JSON.stringify({ error: 'Azure AD not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { redirectUri, codeChallenge } = await req.json();
    
    // Generate a random state for CSRF protection
    const state = crypto.randomUUID();
    
    // Build Azure AD authorization URL
    const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'openid profile email User.Read');
    authUrl.searchParams.set('response_mode', 'query');
    authUrl.searchParams.set('state', state);
    
    // Add PKCE parameters if provided (required for extensions/SPAs)
    if (codeChallenge) {
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      console.log('PKCE enabled with code_challenge');
    }

    console.log('Generated Azure AD auth URL for redirect');

    return new Response(JSON.stringify({ 
      authUrl: authUrl.toString(),
      state 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in azure-auth-init:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
