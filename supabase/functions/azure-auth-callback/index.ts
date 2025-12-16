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

    const body = await req.json();
    const { code, redirectUri, codeVerifier } = body;
    
    console.log('Callback received:', { 
      hasCode: !!code, 
      hasRedirectUri: !!redirectUri,
      codeLength: code?.length,
      hasPkce: !!codeVerifier
    });

    if (!code) {
      console.error('No authorization code provided in request');
      return new Response(JSON.stringify({ error: 'No authorization code provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate redirectUri to prevent open redirect attacks
    const ALLOWED_ORIGINS = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:8080',
      'https://bizguard.bizcuits.io',
      Deno.env.get('SUPABASE_URL'),
    ].filter(Boolean) as string[];

    // Also allow *.lovableproject.com, *.lovable.app, and Chrome extension URLs
    const ALLOWED_PATTERNS = [
      /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
      /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
      /^https:\/\/[a-z0-9]+\.chromiumapp\.org$/, // Chrome extension redirect
    ];

    let validatedBaseUrl: string;
    let isExtensionAuth = false;
    try {
      const redirectUrl = new URL(redirectUri);
      const isAllowedOrigin = ALLOWED_ORIGINS.some(origin => {
        try {
          return new URL(origin).origin === redirectUrl.origin;
        } catch {
          return false;
        }
      });
      const isAllowedPattern = ALLOWED_PATTERNS.some(pattern => pattern.test(redirectUrl.origin));
      
      // Check if this is a Chrome extension auth request
      isExtensionAuth = /\.chromiumapp\.org$/.test(redirectUrl.origin);
      
      if (!isAllowedOrigin && !isAllowedPattern) {
        console.error('Invalid redirect URI origin:', redirectUrl.origin);
        return new Response(JSON.stringify({ error: 'Invalid redirect URI' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      validatedBaseUrl = redirectUrl.origin;
    } catch (e) {
      console.error('Invalid redirect URI format:', redirectUri);
      return new Response(JSON.stringify({ error: 'Invalid redirect URI format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Auth type:', isExtensionAuth ? 'extension' : 'web');

    console.log('Exchanging code for tokens...');

    // Build token request params
    const tokenParams: Record<string, string> = {
      client_id: clientId,
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: 'openid profile email User.Read',
    };
    
    // For PKCE flow (extension with SPA redirect), don't send client_secret
    // Azure rejects client_secret for public clients (SPA platform type)
    if (codeVerifier) {
      tokenParams.code_verifier = codeVerifier;
      console.log('Using PKCE code_verifier for token exchange (public client)');
    } else {
      // Web auth uses confidential client with client_secret
      tokenParams.client_secret = clientSecret;
      console.log('Using client_secret for token exchange (confidential client)');
    }

    // Exchange code for tokens
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenParams),
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
      const errorText = await userInfoResponse.text();
      console.error('Failed to get user info:', userInfoResponse.status, errorText);
      return new Response(JSON.stringify({ error: 'Failed to get user info', details: errorText }), {
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

    // Check if user is invited (dashboard requires invitation, extension does not)
    if (!isExtensionAuth) {
      const { data: invitation, error: inviteError } = await supabase
        .from('invitations')
        .select('*')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (inviteError) {
        console.error('Error checking invitation:', inviteError);
        return new Response(JSON.stringify({ error: 'Failed to check invitation status' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!invitation) {
        console.log('User not invited:', email);
        return new Response(JSON.stringify({ 
          error: 'not_invited',
          message: 'You have not been invited to access the dashboard. Please contact an administrator.'
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('User invitation found:', email);

      // Mark invitation as used later after user creation
      var invitationToMark = invitation;
    } else {
      console.log('Extension auth - skipping invitation check');
    }

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

    // Mark invitation as used (if not already used) - only for web auth
    if (!isExtensionAuth && typeof invitationToMark !== 'undefined' && !invitationToMark.used_at) {
      await supabase
        .from('invitations')
        .update({ used_at: new Date().toISOString() })
        .eq('email', email.toLowerCase());
      console.log('Invitation marked as used for:', email);
    }

    // For extension auth, return access token directly using admin session creation
    if (isExtensionAuth) {
      // Update profile with MS ID if needed
      await supabase
        .from('profiles')
        .update({ ms_id: msId })
        .eq('id', userId);

      // Generate a magic link and verify it server-side to get an access token
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
      });

      if (linkError) {
        console.error('Error generating link for extension:', linkError);
        return new Response(JSON.stringify({ error: 'Failed to generate session' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Extract the token from the action link
      const actionLinkRaw = linkData.properties?.action_link ?? null;
      let accessToken: string | null = null;

      if (actionLinkRaw) {
        try {
          const actionUrl = new URL(actionLinkRaw);
          const token = actionUrl.searchParams.get('token');
          
          if (token) {
            // Verify the token server-side to get a session
            const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
              token_hash: token,
              type: 'magiclink',
            });
            
            if (!verifyError && verifyData?.session?.access_token) {
              accessToken = verifyData.session.access_token;
              console.log('Direct access token obtained for extension user:', email);
            } else {
              console.log('OTP verify failed:', verifyError?.message || 'No session returned');
            }
          }
        } catch (e) {
          console.error('Error extracting/verifying token:', e);
        }
      }

      console.log('Extension Azure AD authentication successful for:', email, 'Has token:', !!accessToken);

      return new Response(JSON.stringify({ 
        success: true,
        userId,
        email,
        displayName,
        // Return direct access token for extension
        authToken: accessToken,
        // Also include user data so extension can work even if token verification fails
        userData: {
          id: userId,
          email: email,
          displayName: displayName,
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate a magic link / session for the user (web auth)
    // Use validated base URL to prevent open redirect
    const dashboardUrl = `${validatedBaseUrl}/dashboard`;
    console.log('Generating magic link with redirect to:', dashboardUrl);
    
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: dashboardUrl,
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
