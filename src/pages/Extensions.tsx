import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Chrome, 
  CheckCircle2, 
  ExternalLink,
  Puzzle,
  Settings,
  FolderOpen,
  ToggleRight
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const EXTENSION_VERSION = '5.2.0';
const DOWNLOAD_URL = 'https://livbbxegwifbhtboyczy.supabase.co/functions/v1/extension-download';

export default function Extensions() {
  const [currentStep, setCurrentStep] = useState(0);
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = () => {
    // Trigger download from edge function
    window.open(DOWNLOAD_URL, '_blank');
    
    toast({
      title: 'Download Started',
      description: 'Extract the ZIP and follow the steps below',
    });
    
    setDownloaded(true);
    setCurrentStep(1);
  };

  const openExtensionsPage = () => {
    window.open('chrome://extensions/', '_blank');
    setCurrentStep(2);
  };

  const steps = [
    {
      number: 1,
      title: 'Download Extension',
      description: 'Click the download button to get the BizGuard extension package',
      icon: Download,
      action: handleDownload,
      actionLabel: 'Download Extension',
      completed: downloaded
    },
    {
      number: 2,
      title: 'Open Extensions Page',
      description: 'Open chrome://extensions in your browser',
      icon: Puzzle,
      action: openExtensionsPage,
      actionLabel: 'Open Extensions',
      completed: currentStep >= 2
    },
    {
      number: 3,
      title: 'Enable Developer Mode',
      description: 'Toggle "Developer mode" in the top-right corner',
      icon: ToggleRight,
      action: () => setCurrentStep(3),
      actionLabel: 'Done',
      completed: currentStep >= 3
    },
    {
      number: 4,
      title: 'Load Extension',
      description: 'Click "Load unpacked" and select the extracted folder',
      icon: FolderOpen,
      action: () => setCurrentStep(4),
      actionLabel: 'Done',
      completed: currentStep >= 4
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Extensions</h1>
            <p className="text-muted-foreground mt-1">
              Install the BizGuard browser extension
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            v{EXTENSION_VERSION}
          </Badge>
        </div>

        {/* Main Installation Card */}
        <Card variant="glass" className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b border-border/50">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                <Chrome className="w-8 h-8 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">BizGuard Extension</h2>
                <p className="text-muted-foreground">
                  Real-time brand protection for Chrome & Edge
                </p>
              </div>
            </div>
          </div>
          
          <CardContent className="p-6">
            {/* Quick Install */}
            <div className="mb-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl bg-accent/30 border border-border/50">
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">Quick Install</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Download and install in under 2 minutes
                  </p>
                </div>
                <Button 
                  size="lg"
                  onClick={handleDownload}
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Extension
                </Button>
              </div>
            </div>

            {/* Installation Steps */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Installation Steps
              </h3>
              
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div 
                    key={step.number}
                    className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 ${
                      step.completed 
                        ? 'bg-success/5 border-success/30' 
                        : currentStep === index 
                          ? 'bg-primary/5 border-primary/30' 
                          : 'bg-card border-border/50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      step.completed 
                        ? 'bg-success/20 text-success' 
                        : currentStep === index 
                          ? 'bg-primary/20 text-primary' 
                          : 'bg-muted text-muted-foreground'
                    }`}>
                      {step.completed ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <step.icon className="w-5 h-5" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Step {step.number}
                        </span>
                        {step.completed && (
                          <Badge variant="secondary" className="bg-success/20 text-success text-xs">
                            Complete
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-medium text-foreground mt-0.5">{step.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                    </div>
                    
                    {!step.completed && currentStep === index && (
                      <Button 
                        size="sm" 
                        variant={index === 0 ? 'default' : 'outline'}
                        onClick={step.action}
                      >
                        {step.actionLabel}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card variant="glass" className="animate-slide-up">
            <CardContent className="p-5">
              <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center mb-3">
                <Puzzle className="w-5 h-5 text-info" />
              </div>
              <h3 className="font-medium text-foreground">Real-time Detection</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Instantly detects cross-brand terms as you type
              </p>
            </CardContent>
          </Card>
          
          <Card variant="glass" className="animate-slide-up" style={{ animationDelay: '50ms' }}>
            <CardContent className="p-5">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center mb-3">
                <Settings className="w-5 h-5 text-success" />
              </div>
              <h3 className="font-medium text-foreground">Auto-sync</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Brands and terms sync automatically from dashboard
              </p>
            </CardContent>
          </Card>
          
          <Card variant="glass" className="animate-slide-up" style={{ animationDelay: '100ms' }}>
            <CardContent className="p-5">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center mb-3">
                <Chrome className="w-5 h-5 text-warning" />
              </div>
              <h3 className="font-medium text-foreground">Multi-platform</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Works on Zendesk, Freshdesk, Intercom & more
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Help */}
        <Card variant="glass">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-foreground">Need help?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Contact support if you have issues installing
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <ExternalLink className="w-4 h-4" />
                Get Support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
