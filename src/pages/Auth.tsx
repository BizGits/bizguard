import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader2, Code } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

const DEV_CODE = 'Dev1234';

export default function Auth() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showDevMode, setShowDevMode] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [isDevSigningIn, setIsDevSigningIn] = useState(false);

  useEffect(() => {
    if (user && !isLoading) {
      navigate('/dashboard');
    }
  }, [user, isLoading, navigate]);

  const handleMicrosoftSignIn = async () => {
    setIsSigningIn(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email profile openid',
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        toast({
          title: 'Sign in failed',
          description: error.message,
          variant: 'destructive',
        });
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

  const handleDevSignIn = async () => {
    if (devCode !== DEV_CODE) {
      toast({
        title: 'Invalid code',
        description: 'The dev code is incorrect',
        variant: 'destructive',
      });
      return;
    }

    setIsDevSigningIn(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: 'dev@bwblock.local',
        password: DEV_CODE,
      });

      if (error) {
        // If user doesn't exist, create them
        if (error.message.includes('Invalid login credentials')) {
          const { error: signUpError } = await supabase.auth.signUp({
            email: 'dev@bwblock.local',
            password: DEV_CODE,
            options: {
              data: {
                full_name: 'Dev User',
              },
            },
          });

          if (signUpError) {
            toast({
              title: 'Dev sign in failed',
              description: signUpError.message,
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Dev account created',
              description: 'Signing you in...',
            });
          }
        } else {
          toast({
            title: 'Dev sign in failed',
            description: error.message,
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Dev sign in failed',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsDevSigningIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-dark flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-dark flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-info/10 rounded-full blur-3xl" />
      </div>

      <Card variant="glass" className="w-full max-w-md animate-scale-in relative z-10">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-glow mb-4">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Welcome to BWBlock</CardTitle>
          <CardDescription className="text-muted-foreground">
            Brand protection for your team
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <div className="space-y-3">
            <Button
              className="w-full h-12 text-base"
              onClick={handleMicrosoftSignIn}
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
          </div>

          {/* Dev Mode Toggle */}
          <div className="pt-4 border-t border-border/50">
            <button
              onClick={() => setShowDevMode(!showDevMode)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
            >
              <Code className="w-3 h-3" />
              Dev Mode
            </button>

            {showDevMode && (
              <div className="mt-4 space-y-3 animate-fade-in">
                <Input
                  type="password"
                  placeholder="Enter dev code"
                  value={devCode}
                  onChange={(e) => setDevCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDevSignIn()}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleDevSignIn}
                  disabled={isDevSigningIn || !devCode}
                >
                  {isDevSigningIn ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Sign in as Dev
                </Button>
              </div>
            )}
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Sign in with your Bizcuits Microsoft account to access BWBlock
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}