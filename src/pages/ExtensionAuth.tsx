import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, Shield } from "lucide-react";

const ExtensionAuth = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Initializing authentication...");

  useEffect(() => {
    const handleAuth = async () => {
      const action = searchParams.get("action");
      
      if (action === "init") {
        // Start the Azure OAuth flow
        setMessage("Redirecting to Microsoft login...");
        
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/azure-auth-init`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                redirectUri: `${window.location.origin}/extension-auth?action=callback`,
                codeChallenge: null, // Web flow doesn't need PKCE
              }),
            }
          );

          if (!response.ok) {
            throw new Error("Failed to initialize authentication");
          }

          const { authUrl } = await response.json();
          
          // Store extension ID for later use
          const extensionId = searchParams.get("extensionId");
          if (extensionId) {
            sessionStorage.setItem("extensionAuthId", extensionId);
          }
          
          // Redirect to Azure
          window.location.href = authUrl;
        } catch (error) {
          console.error("Auth init error:", error);
          setStatus("error");
          setMessage("Failed to start authentication");
        }
      } else if (action === "callback") {
        // Handle the OAuth callback
        setMessage("Completing authentication...");
        
        const code = searchParams.get("code");
        const error = searchParams.get("error");
        
        if (error) {
          setStatus("error");
          setMessage(searchParams.get("error_description") || "Authentication failed");
          return;
        }
        
        if (!code) {
          setStatus("error");
          setMessage("No authorization code received");
          return;
        }

        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/azure-auth-callback`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                code,
                redirectUri: `${window.location.origin}/extension-auth?action=callback`,
              }),
            }
          );

          const data = await response.json();

          if (!response.ok || data.error) {
            throw new Error(data.message || data.error || "Authentication failed");
          }

          // Send the auth data back to the extension
          const authData = {
            success: true,
            authToken: data.authToken,
            userData: data.userData || {
              id: data.userId,
              email: data.email,
              displayName: data.displayName,
            },
          };

          // Try to communicate with extension via postMessage
          // The extension popup should be listening
          setStatus("success");
          setMessage("Authentication successful! You can close this window.");

          // Store auth data in localStorage for the extension to retrieve
          localStorage.setItem("bizguard_extension_auth", JSON.stringify(authData));
          
          // Also try broadcasting via BroadcastChannel
          try {
            const channel = new BroadcastChannel("bizguard_auth");
            channel.postMessage(authData);
            channel.close();
          } catch (e) {
            console.log("BroadcastChannel not supported");
          }

          // Auto-close after a short delay
          setTimeout(() => {
            window.close();
          }, 2000);
        } catch (error: any) {
          console.error("Auth callback error:", error);
          setStatus("error");
          setMessage(error.message || "Authentication failed");
          
          // Store error for extension
          localStorage.setItem(
            "bizguard_extension_auth",
            JSON.stringify({ success: false, error: error.message })
          );
        }
      } else {
        setStatus("error");
        setMessage("Invalid authentication request");
      }
    };

    handleAuth();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="glass-card p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-slate-100 mb-4">
          BizGuard Extension
        </h1>

        <div className="flex flex-col items-center gap-4">
          {status === "loading" && (
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          )}
          {status === "success" && (
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          )}
          {status === "error" && <XCircle className="w-8 h-8 text-red-500" />}

          <p
            className={`text-sm ${
              status === "error"
                ? "text-red-400"
                : status === "success"
                ? "text-green-400"
                : "text-slate-400"
            }`}
          >
            {message}
          </p>

          {status === "success" && (
            <p className="text-xs text-slate-500 mt-2">
              This window will close automatically...
            </p>
          )}

          {status === "error" && (
            <button
              onClick={() => window.close()}
              className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors"
            >
              Close Window
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExtensionAuth;
