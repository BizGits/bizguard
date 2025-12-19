import { useEffect, useState, useCallback } from 'react';
import { Users, Shield, AlertTriangle, Activity, TrendingUp, ArrowRight, Zap, Calendar, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { formatDistanceToNow, subDays, subMonths, format } from 'date-fns';
import { BlockingChart } from '@/components/dashboard/BlockingChart';
import { ActionPieChart } from '@/components/dashboard/ActionPieChart';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

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

interface CrossBrandAgent {
  userId: string;
  userName: string;
  blockedCount: number;
  brandsBlocked: string[];
}

type DateFilter = '7d' | '30d' | '90d';

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState<StatsCard[]>([]);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [chartEvents, setChartEvents] = useState<{ id: string; action: string; created_at: string }[]>([]);
  const [activeUsers, setActiveUsers] = useState<{ id: string; display_name: string; last_seen_at: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [crossBrandAgents, setCrossBrandAgents] = useState<CrossBrandAgent[]>([]);
  const [crossBrandFilter, setCrossBrandFilter] = useState<DateFilter>('30d');
  const [isCrossBrandLoading, setIsCrossBrandLoading] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      // Fetch events for last 7 days for charts
      const sevenDaysAgo = subDays(new Date(), 7);
      
      const { data: chartData } = await supabase
        .from('events')
        .select('id, action, created_at')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      setChartEvents(chartData || []);

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

      // Calculate week over week change
      const twoWeeksAgo = subDays(new Date(), 14);
      const { count: lastWeekBlocked } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'BLOCKED')
        .gte('created_at', twoWeeksAgo.toISOString())
        .lt('created_at', sevenDaysAgo.toISOString());

      const thisWeekBlocked = chartData?.filter(e => e.action === 'BLOCKED').length || 0;
      const weekChange = lastWeekBlocked 
        ? Math.round(((thisWeekBlocked - lastWeekBlocked) / lastWeekBlocked) * 100)
        : 0;

      setStats([
        {
          title: 'Blocked Terms (24h)',
          value: blockedCount || 0,
          icon: <AlertTriangle className="w-5 h-5 text-destructive" />,
          change: `${weekChange >= 0 ? '+' : ''}${weekChange}% vs last week`,
          changeType: weekChange > 0 ? 'negative' : weekChange < 0 ? 'positive' : 'neutral',
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
          title: 'Weekly Events',
          value: chartData?.length || 0,
          icon: <TrendingUp className="w-5 h-5 text-info" />,
        },
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  // Fetch cross-brand blocking agents
  const fetchCrossBrandAgents = useCallback(async () => {
    if (!isAdmin) return;
    
    setIsCrossBrandLoading(true);
    try {
      const days = crossBrandFilter === '7d' ? 7 : crossBrandFilter === '30d' ? 30 : 90;
      const startDate = subDays(new Date(), days);

      const { data, error } = await supabase
        .from('events')
        .select(`
          user_id,
          brand_id,
          profiles:user_id (display_name),
          brands:brand_id (name)
        `)
        .eq('action', 'BLOCKED')
        .not('brand_id', 'is', null)
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      // Group by user and count unique brands
      const userMap = new Map<string, { userName: string; brands: Set<string>; count: number }>();
      
      (data || []).forEach((event: any) => {
        const userId = event.user_id;
        const userName = event.profiles?.display_name || 'Unknown';
        const brandName = event.brands?.name;

        if (!userMap.has(userId)) {
          userMap.set(userId, { userName, brands: new Set(), count: 0 });
        }
        
        const userData = userMap.get(userId)!;
        userData.count++;
        if (brandName) {
          userData.brands.add(brandName);
        }
      });

      // Filter to only users with multiple brands blocked (cross-brand)
      const crossBrandData: CrossBrandAgent[] = Array.from(userMap.entries())
        .filter(([_, data]) => data.brands.size > 1)
        .map(([userId, data]) => ({
          userId,
          userName: data.userName,
          blockedCount: data.count,
          brandsBlocked: Array.from(data.brands),
        }))
        .sort((a, b) => b.blockedCount - a.blockedCount)
        .slice(0, 10);

      setCrossBrandAgents(crossBrandData);
    } catch (error) {
      console.error('Error fetching cross-brand agents:', error);
    } finally {
      setIsCrossBrandLoading(false);
    }
  }, [isAdmin, crossBrandFilter]);

  // Initial fetch
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Fetch cross-brand agents when filter changes
  useEffect(() => {
    fetchCrossBrandAgents();
  }, [fetchCrossBrandAgents]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
        },
        async (payload) => {
          setIsLive(true);
          
          // Fetch the complete event with relations
          const { data: newEvent } = await supabase
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
            .eq('id', payload.new.id)
            .single();

          if (newEvent) {
            // Add to recent events
            setRecentEvents(prev => [newEvent, ...prev.slice(0, 9)]);
            
            // Add to chart events
            setChartEvents(prev => [
              { id: newEvent.id, action: newEvent.action, created_at: newEvent.created_at },
              ...prev,
            ]);

            // Show toast notification
            toast({
              title: 'New Event',
              description: `${newEvent.action}: ${newEvent.term || newEvent.brands?.name || 'System event'}`,
            });
          }

          // Reset live indicator after animation
          setTimeout(() => setIsLive(false), 2000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'BLOCKED': return 'text-destructive bg-destructive/10';
      case 'TOGGLED_OFF': return 'text-warning bg-warning/10';
      case 'TOGGLED_ON': return 'text-success bg-success/10';
      case 'LOGIN': return 'text-info bg-info/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Overview of BizGuard activity</p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
            isLive 
              ? 'bg-success/20 text-success animate-pulse' 
              : 'bg-muted text-muted-foreground'
          }`}>
            <Zap className={`w-3 h-3 ${isLive ? 'animate-bounce' : ''}`} />
            {isLive ? 'Live Update' : 'Real-time'}
          </div>
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
                    {stat.change && (
                      <p className={`text-xs mt-1 ${
                        stat.changeType === 'positive' ? 'text-success' :
                        stat.changeType === 'negative' ? 'text-destructive' :
                        'text-muted-foreground'
                      }`}>
                        {stat.change}
                      </p>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-accent/50 flex items-center justify-center">
                    {stat.icon}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Blocking trends chart */}
          <Card variant="glass" className="lg:col-span-2 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Activity Trends (7 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[280px] flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <BlockingChart events={chartEvents} days={7} />
              )}
            </CardContent>
          </Card>

          {/* Action distribution pie chart */}
          <Card variant="glass" className="animate-slide-up" style={{ animationDelay: '250ms' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Action Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[200px] flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <ActionPieChart events={chartEvents} />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active agents */}
          {isAdmin && (
            <Card variant="glass" className="animate-slide-up" style={{ animationDelay: '300ms' }}>
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
          <Card variant="glass" className={`animate-slide-up ${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}`} style={{ animationDelay: '350ms' }}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                Recent Events
                {isLive && (
                  <span className="w-2 h-2 rounded-full bg-success animate-ping" />
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" asChild className="gap-1">
                <Link to="/dashboard/events">
                  View all
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet</p>
              ) : (
                <div className="space-y-3">
                  {recentEvents.slice(0, 5).map((event, index) => (
                    <div 
                      key={event.id} 
                      className={`flex items-center justify-between py-2 border-b border-border/50 last:border-0 transition-all duration-300 ${
                        index === 0 && isLive ? 'bg-success/5 -mx-2 px-2 rounded-lg' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${getActionColor(event.action)}`}>
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

        {/* Cross-Brand Blocking Agents */}
        {isAdmin && (
          <Card variant="glass" className="animate-slide-up" style={{ animationDelay: '400ms' }}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-4 h-4 text-warning" />
                Top Agents with Cross-Brand Blocks
              </CardTitle>
              <Select value={crossBrandFilter} onValueChange={(v) => setCrossBrandFilter(v as DateFilter)}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <Calendar className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {isCrossBrandLoading ? (
                <div className="h-[150px] flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : crossBrandAgents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No agents with cross-brand blocks in this period
                </p>
              ) : (
                <div className="space-y-3">
                  {crossBrandAgents.map((agent, index) => (
                    <div 
                      key={agent.userId} 
                      className="flex items-center justify-between p-3 rounded-xl bg-accent/30 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center">
                          <span className="text-xs font-bold text-warning">
                            #{index + 1}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {agent.userName}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {agent.brandsBlocked.slice(0, 3).map((brand) => (
                              <Badge key={brand} variant="secondary" className="text-xs px-1.5 py-0">
                                {brand}
                              </Badge>
                            ))}
                            {agent.brandsBlocked.length > 3 && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0">
                                +{agent.brandsBlocked.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-destructive">{agent.blockedCount}</p>
                        <p className="text-xs text-muted-foreground">blocks</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
