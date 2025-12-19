import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

interface Notification {
  id: string;
  action: string;
  term: string | null;
  url: string | null;
  created_at: string;
  profiles: { display_name: string } | null;
  brands: { name: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  BLOCKED: 'Site blocked',
  TOGGLED_OFF: 'Protection disabled',
  TOGGLED_ON: 'Protection enabled',
  LOGIN: 'User logged in',
  LOGOUT: 'User logged out',
  BRAND_CREATED: 'Brand created',
  BRAND_DELETED: 'Brand deleted',
  BRAND_RESTORED: 'Brand restored',
};

const ACTION_COLORS: Record<string, string> = {
  BLOCKED: 'bg-destructive',
  TOGGLED_OFF: 'bg-warning',
  TOGGLED_ON: 'bg-success',
  LOGIN: 'bg-info',
  LOGOUT: 'bg-muted',
  BRAND_CREATED: 'bg-success',
  BRAND_DELETED: 'bg-destructive',
  BRAND_RESTORED: 'bg-info',
};

// Simple notification sound using Web Audio API
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.log('Audio not available');
  }
};

export function NotificationBell() {
  const { isAdmin } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const isFirstLoad = useRef(true);
  const [lastReadTime, setLastReadTime] = useState<Date>(() => {
    const stored = localStorage.getItem('lastNotificationRead');
    return stored ? new Date(stored) : new Date();
  });

  const fetchNotifications = useCallback(async (playSound = false) => {
    const { data, error } = await supabase
      .from('events')
      .select(`
        id,
        action,
        term,
        url,
        created_at,
        profiles:user_id (display_name),
        brands:brand_id (name)
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setNotifications(data as Notification[]);
      const newCount = data.filter(
        (n) => new Date(n.created_at) > lastReadTime
      ).length;
      setUnreadCount(newCount);
      
      // Play sound only for new events (not on initial load)
      if (playSound && newCount > 0) {
        playNotificationSound();
      }
    }
  }, [lastReadTime]);

  useEffect(() => {
    fetchNotifications(false);
    isFirstLoad.current = false;

    // Real-time subscription
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
        },
        () => {
          fetchNotifications(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      const now = new Date();
      setLastReadTime(now);
      localStorage.setItem('lastNotificationRead', now.toISOString());
      setUnreadCount(0);
    }
  };

  const getNotificationText = (notification: Notification) => {
    const userName = notification.profiles?.display_name || 'Unknown';
    const brandName = notification.brands?.name;
    const action = ACTION_LABELS[notification.action] || notification.action;

    if (brandName) {
      return `${userName} - ${action}: ${brandName}`;
    }
    if (notification.term) {
      return `${userName} - ${action}: "${notification.term}"`;
    }
    return `${userName} - ${action}`;
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0" 
        align="end"
        sideOffset={8}
      >
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Notifications</h4>
            {notifications.length > 0 && (
              <Link 
                to="/dashboard/events" 
                className="text-xs text-primary hover:underline"
                onClick={() => setIsOpen(false)}
              >
                View all
              </Link>
            )}
          </div>
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No notifications yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-3 hover:bg-accent/50 transition-colors",
                    new Date(notification.created_at) > lastReadTime && "bg-accent/30"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full mt-2 flex-shrink-0",
                        ACTION_COLORS[notification.action] || 'bg-muted'
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground line-clamp-2">
                        {getNotificationText(notification)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
