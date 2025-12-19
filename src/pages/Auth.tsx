import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Loader2, Download, Globe, Info, Key } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { validatePassword } from '@/lib/downloadPassword';
import logo from '@/assets/logo.png';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ALLOWED_DOMAIN = 'bizcuits.io';

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [downloadEmail, setDownloadEmail] = useState<string | null>(null);
  const [isDownloadAuthorized, setIsDownloadAuthorized] = useState(false);
  const [downloadPassword, setDownloadPassword] = useState('');
  const [isValidatingPassword, setIsValidatingPassword] = useState(false);

  // Handle Azure AD callback
  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const downloadIntent = searchParams.get('download');
    
    // Handle Azure AD errors
    if (error) {
      console.error('Azure AD error:', error, errorDescription);
      toast({
        title: 'Sign in failed',
        description: errorDescription || `Azure AD error: ${error}`,
        variant: 'destructive',
      });
      window.history.replaceState({}, '', '/auth');
      return;
    }
    
    if (code && !user) {
      handleAzureCallback(code, downloadIntent === 'true');
    }
  }, [searchParams, user]);

  // Check if user email is from allowed domain
  useEffect(() => {
    if (user?.email) {
      const emailDomain = user.email.split('@')[1]?.toLowerCase();
      if (emailDomain === ALLOWED_DOMAIN) {
        setDownloadEmail(user.email);
        setIsDownloadAuthorized(true);
      }
    }
  }, [user]);

  const handleAzureCallback = async (code: string, isDownloadIntent: boolean) => {
    setIsSigningIn(true);
    try {
      const redirectUri = `${window.location.origin}/auth`;
      
      const response = await supabase.functions.invoke('azure-auth-callback', {
        body: { code, redirectUri },
      });

      if (response.error) {
        toast({
          title: 'Sign in failed',
          description: response.error.message || 'Azure authentication failed',
          variant: 'destructive',
        });
        window.history.replaceState({}, '', '/auth');
        return;
      }

      // Check for not_invited error - but allow download if from allowed domain
      if (response.data?.error === 'not_invited') {
        // Check if email is from allowed domain for download
        if (response.data?.email) {
          const emailDomain = response.data.email.split('@')[1]?.toLowerCase();
          if (emailDomain === ALLOWED_DOMAIN && isDownloadIntent) {
            setDownloadEmail(response.data.email);
            setIsDownloadAuthorized(true);
            toast({
              title: 'Download Authorized',
              description: 'You can now download the extension.',
            });
            window.history.replaceState({}, '', '/auth');
            return;
          }
        }
        
        toast({
          title: 'Access Denied',
          description: response.data.message || 'You have not been invited to access the dashboard.',
          variant: 'destructive',
        });
        window.history.replaceState({}, '', '/auth');
        return;
      }

      if (response.data?.magicLink) {
        // Redirect to magic link to complete authentication
        window.location.href = response.data.magicLink;
      } else {
        toast({
          title: 'Sign in failed',
          description: 'Could not complete authentication',
          variant: 'destructive',
        });
        window.history.replaceState({}, '', '/auth');
      }
    } catch (error) {
      toast({
        title: 'Sign in failed',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
      window.history.replaceState({}, '', '/auth');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleMicrosoftSignIn = async (forDownload: boolean = false) => {
    setIsSigningIn(true);
    try {
      const redirectUri = `${window.location.origin}/auth${forDownload ? '?download=true' : ''}`;
      
      const response = await supabase.functions.invoke('azure-auth-init', {
        body: { redirectUri },
      });

      if (response.error) {
        toast({
          title: 'Sign in failed',
          description: response.error.message || 'Could not initiate Azure login',
          variant: 'destructive',
        });
        return;
      }

      if (response.data?.authUrl) {
        // Redirect to Azure AD
        window.location.href = response.data.authUrl;
      }
    } catch (error) {
      toast({
        title: 'Sign in failed',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleDownload = () => {
    const downloadUrl = `${SUPABASE_URL}/functions/v1/extension-download`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'bizguard-extension-v5.4.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: 'Download started',
      description: 'Your extension is downloading. Follow the steps to install.',
    });
  };

  const handlePasswordDownload = async () => {
    if (!downloadPassword.trim()) {
      toast({
        title: 'Password Required',
        description: 'Please enter the download password.',
        variant: 'destructive',
      });
      return;
    }

    setIsValidatingPassword(true);
    try {
      const isValid = await validatePassword(downloadPassword);
      if (isValid) {
        handleDownload();
        setDownloadPassword('');
      } else {
        toast({
          title: 'Invalid Password',
          description: 'The password is incorrect or has expired. Please get a new password from your dashboard admin.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsValidatingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 md:p-8">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-5xl relative z-10">
        {/* Logo Header */}
        <div className="text-center mb-8">
          <img src={logo} alt="BizGuard" className="mx-auto w-16 h-16 object-contain mb-4" />
          <h1 className="text-3xl font-bold text-slate-50">Welcome to BizGuard</h1>
          <p className="text-slate-400 mt-2">Brand protection for your team</p>
        </div>

        {/* Two Column Layout */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Card - Login */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl shadow-black/40 p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-slate-50">Management & Admin Login</h2>
              <p className="text-slate-300 text-sm mt-2">
                Sign in to access monitoring, brands, and dashboard insights.
              </p>
            </div>

            <div className="space-y-4">
              {user ? (
                <Button
                  className="w-full h-12 text-base rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:scale-[1.02] transition-all"
                  onClick={() => navigate('/dashboard')}
                >
                  Go to Dashboard
                </Button>
              ) : (
                <Button
                  className="w-full h-12 text-base rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:scale-[1.02] transition-all"
                  onClick={() => handleMicrosoftSignIn(false)}
                  disabled={isSigningIn}
                >
                  {isSigningIn ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 21 21" fill="none">
                      <path d="M0 0h10v10H0V0z" fill="#F25022"/>
                      <path d="M11 0h10v10H11V0z" fill="#7FBA00"/>
                      <path d="M0 11h10v10H0V11z" fill="#00A4EF"/>
                      <path d="M11 11h10v10H11V11z" fill="#FFB900"/>
                    </svg>
                  )}
                  Sign in with Microsoft
                </Button>
              )}
            </div>
          </div>

          {/* Right Card - Extension Install */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl shadow-black/40 p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-slate-50">Download BizGuard Extension</h2>
              <p className="text-slate-300 text-sm mt-2">
                Enter the download password from your admin to get the extension.
              </p>
            </div>

            {/* Download Section */}
            {isDownloadAuthorized || user ? (
              <>
                {/* Authorized - Show Download Button */}
                <div className="bg-success/10 border border-success/20 rounded-xl p-4 mb-4">
                  <p className="text-success text-sm text-center">
                    ✓ Authorized as {downloadEmail || user?.email}
                  </p>
                </div>
                <Button
                  className="w-full h-12 text-base rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:scale-[1.02] transition-all mb-4"
                  onClick={handleDownload}
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download Extension (v5.4)
                </Button>
              </>
            ) : (
              <>
                {/* Password-based download */}
                <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-3 justify-center text-slate-300">
                    <Key className="w-4 h-4" />
                    <p className="text-sm font-medium">Enter download password</p>
                  </div>
                  <Input
                    type="text"
                    placeholder="XXXX-XXXX"
                    value={downloadPassword}
                    onChange={(e) => setDownloadPassword(e.target.value.toUpperCase())}
                    className="text-center font-mono text-lg tracking-widest bg-slate-900/50 border-white/10 mb-3 text-white placeholder:text-slate-500"
                    maxLength={9}
                  />
                  <p className="text-xs text-slate-500 text-center">
                    Get the password from your dashboard admin
                  </p>
                </div>
                <Button
                  className="w-full h-12 text-base rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:scale-[1.02] transition-all mb-4"
                  onClick={handlePasswordDownload}
                  disabled={isValidatingPassword}
                >
                  {isValidatingPassword ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <Download className="w-5 h-5 mr-2" />
                  )}
                  Download Extension
                </Button>
              </>
            )}

            {/* Installation Steps */}
            <div className="space-y-4">
              {/* Chrome Steps */}
              <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-5 h-5 text-slate-300" />
                  <h3 className="font-medium text-slate-200">Installation Steps</h3>
                </div>
                <ol className="space-y-2 text-sm text-slate-400">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-400 font-medium">1.</span>
                    Download and unzip the file
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-400 font-medium">2.</span>
                    Open <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-xs">chrome://extensions</code> or <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-xs">edge://extensions</code>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-400 font-medium">3.</span>
                    Enable Developer mode (top-right)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-400 font-medium">4.</span>
                    Click "Load unpacked" and select the folder
                  </li>
                </ol>
              </div>

              {/* After Installing Info */}
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-slate-200 text-sm mb-1">After Installing</h4>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      Open your support platform. The BWBlock pill will appear in the bottom-left.
                      Click "Not logged in" on the pill to sign in with your Microsoft account.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 mt-6 space-y-2">
          <p>Sign in with your Bizcuits Microsoft account to access BizGuard</p>
          <Link to="/privacy-policy" className="text-slate-400 hover:text-slate-200 transition-colors underline">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
