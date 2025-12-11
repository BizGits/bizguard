import { useEffect, useState } from 'react';
import { Users, Shield, AlertTriangle, Activity } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';

interface StatsCard {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}

interface RecentEvent {
  id: string;
  action: string;
  term?: string;
  url?: string;
  created_at: string;
  profiles?: { display_name: string };
  brands?: { name: string };
}

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState<StatsCard[]>([]);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [activeUsers, setActiveUsers] = useState<{ id: string; display_name: string; last_seen_at: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch events count for last 24h
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const { count: blockedCount } = await supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('action', 'BLOCKED')
          .gte('created_at', yesterday.toISOString());

        // Fetch active users (last 10 mins)
        const tenMinsAgo = new Date();
        tenMinsAgo.setMinutes(tenMinsAgo.getMinutes() - 10);
        
        if (isAdmin) {
          const { data: activeUsersData } = await supabase
            .from('profiles')
            .select('id, display_name, last_seen_at')
            .gte('last_seen_at', tenMinsAgo.toISOString());
          
          setActiveUsers(activeUsersData || []);
        }

        // Fetch brands count
        const { count: brandsCount } = await supabase
          .from('brands')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        // Fetch recent events
        const { data: eventsData } = await supabase
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
          .limit(10);

        setRecentEvents(eventsData || []);

        setStats([
          {
            title: 'Blocked Terms (24h)',
            value: blockedCount || 0,
            icon: <AlertTriangle className="w-5 h-5 text-warning" />,
          },
          {
            title: 'Active Agents',
            value: activeUsers.length,
            icon: <Activity className="w-5 h-5 text-success" />,
          },
          {
            title: 'Protected Brands',
            value: brandsCount || 0,
            icon: <Shield className="w-5 h-5 text-primary" />,
          },
          {
            title: 'Total Events',
            value: eventsData?.length || 0,
            icon: <Users className="w-5 h-5 text-info" />,
          },
        ]);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [isAdmin]);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'BLOCKED': return 'text-destructive';
      case 'TOGGLED_OFF': return 'text-warning';
      case 'TOGGLED_ON': return 'text-success';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Page header */}
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of BWBlock activity</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card 
              key={stat.title} 
              variant="glass" 
              className="animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-semibold text-foreground mt-2">
                      {isLoading ? '—' : stat.value}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-accent/50 flex items-center justify-center">
                    {stat.icon}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active agents */}
          {isAdmin && (
            <Card variant="glass" className="animate-slide-up" style={{ animationDelay: '200ms' }}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  Active Agents
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active agents</p>
                ) : (
                  <div className="space-y-3">
                    {activeUsers.map((user) => (
                      <div key={user.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                          <span className="text-xs font-medium">
                            {user.display_name?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {user.display_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(user.last_seen_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recent events */}
          <Card variant="glass" className={`animate-slide-up ${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}`} style={{ animationDelay: '250ms' }}>
            <CardHeader>
              <CardTitle className="text-base">Recent Events</CardTitle>
            </CardHeader>
            <CardContent>
              {recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet</p>
              ) : (
                <div className="space-y-3">
                  {recentEvents.slice(0, 5).map((event) => (
                    <div 
                      key={event.id} 
                      className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full bg-accent ${getActionColor(event.action)}`}>
                          {event.action}
                        </span>
                        <div>
                          <p className="text-sm text-foreground">
                            {event.term || event.brands?.name || 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {event.profiles?.display_name || 'Unknown user'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
