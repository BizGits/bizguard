import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Key, Clock, Copy, Check, Shield, RefreshCw, Lock, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generatePassword, getTimeRemaining } from '@/lib/downloadPassword';
import { toast } from '@/hooks/use-toast';

export default function AccessPassword() {
  const [password, setPassword] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const updatePassword = async () => {
      const newPassword = await generatePassword();
      setPassword(newPassword);
    };
    updatePassword();

    const interval = setInterval(async () => {
      const remaining = getTimeRemaining();
      setTimeRemaining(remaining);
      
      if (remaining >= 179) {
        const newPassword = await generatePassword();
        setPassword(newPassword);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setTimeRemaining(getTimeRemaining());
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    toast({
      title: 'Copied!',
      description: 'Password copied to clipboard',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const getTimeColor = () => {
    if (timeRemaining <= 30) return 'text-destructive';
    if (timeRemaining <= 60) return 'text-yellow-500';
    return 'text-muted-foreground';
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in max-w-4xl">
        {/* Page header */}
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Access Password</h1>
          <p className="text-muted-foreground mt-1">
            Time-based password for extension downloads
          </p>
        </div>

        {/* Current Password Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Current Download Password
            </CardTitle>
            <CardDescription>
              Share this password with agents to download the extension without signing in
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Password Display */}
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-background border-2 border-primary/20 rounded-xl px-6 py-5 font-mono text-4xl font-bold tracking-[0.3em] text-center">
                {password || '----‑----'}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="h-14 w-14"
              >
                {copied ? (
                  <Check className="h-6 w-6 text-success" />
                ) : (
                  <Copy className="h-6 w-6" />
                )}
              </Button>
            </div>

            {/* Countdown */}
            <div className="flex items-center justify-between bg-background/50 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <RefreshCw className={`h-5 w-5 ${getTimeColor()} ${timeRemaining <= 30 ? 'animate-spin' : ''}`} />
                <div>
                  <p className="text-sm font-medium">Password refreshes in</p>
                  <p className={`text-2xl font-mono font-bold ${getTimeColor()}`}>
                    {formatTime(timeRemaining)}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-sm">
                Auto-rotating every 3 minutes
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Info className="h-5 w-5 text-primary" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">1</div>
                <p>A new password is generated every <strong className="text-foreground">3 minutes</strong> based on the current time window.</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">2</div>
                <p>Share the current password with an agent who needs to download the extension.</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">3</div>
                <p>The agent enters the password on the <strong className="text-foreground">download page</strong> to access the extension.</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">4</div>
                <p>After 3 minutes, the password expires and a new one is generated automatically.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                Security & Encryption
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="flex gap-3">
                <Lock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">SHA-256 Hashing</p>
                  <p>Passwords are generated using the SHA-256 cryptographic hash algorithm, ensuring they cannot be reversed or predicted.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Clock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Time-Based Generation</p>
                  <p>Each password is derived from the current 3-minute time window combined with a secret seed, making it deterministic but secure.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <RefreshCw className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Short-Lived Tokens</p>
                  <p>3-minute expiration limits exposure window. Even if intercepted, passwords quickly become invalid.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Usage Tips */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg">Quick Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-success mt-0.5" />
                <span>Share passwords verbally or via secure chat for best security</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-success mt-0.5" />
                <span>Wait for a fresh password if less than 30 seconds remain</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-success mt-0.5" />
                <span>The same password works for all agents during its 3-minute window</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-success mt-0.5" />
                <span>No need to track or manage passwords - they auto-rotate</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
