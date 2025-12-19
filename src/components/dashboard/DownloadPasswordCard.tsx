import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Key, Clock, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generatePassword, getTimeRemaining, getCurrentTimeWindow } from '@/lib/downloadPassword';
import { toast } from '@/hooks/use-toast';

export function DownloadPasswordCard() {
  const [password, setPassword] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  // Update password when time window changes
  useEffect(() => {
    const updatePassword = async () => {
      const newPassword = await generatePassword();
      setPassword(newPassword);
    };
    updatePassword();

    // Check for window change every second
    const interval = setInterval(async () => {
      const remaining = getTimeRemaining();
      setTimeRemaining(remaining);
      
      // If we're at the start of a new window, regenerate password
      if (remaining >= 179) {
        const newPassword = await generatePassword();
        setPassword(newPassword);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Initial time remaining
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
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Key className="h-4 w-4 text-primary" />
          Extension Download Password
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Share this password with agents so they can download the extension without signing in.
        </p>
        
        {/* Password Display */}
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-background border rounded-lg px-4 py-3 font-mono text-2xl font-bold tracking-widest text-center">
            {password || '----‑----'}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            className="h-12 w-12"
          >
            {copied ? (
              <Check className="h-5 w-5 text-success" />
            ) : (
              <Copy className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Countdown */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Clock className={`h-4 w-4 ${getTimeColor()}`} />
            <span className={getTimeColor()}>
              Refreshes in <span className="font-mono font-bold">{formatTime(timeRemaining)}</span>
            </span>
          </div>
          <Badge variant="outline" className="text-xs">
            Auto-rotating
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
