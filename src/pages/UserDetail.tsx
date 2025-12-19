import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { format, formatDistanceToNow, subDays } from 'date-fns';
import {
  ArrowLeft,
  Download,
  Shield,
  User as UserIcon,
  Mail,
  Clock,
  Chrome,
  Globe,
  Power,
  PowerOff,
  Monitor,
  Calendar,
  AlertTriangle,
  ToggleLeft,
  LogIn,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  last_seen_at: string;
  extension_active: boolean | null;
  browser: string | null;
  browser_version: string | null;
  extension_version: string | null;
  created_at: string;
}

interface UserEvent {
  id: string;
  action: string;
  term: string | null;
  url: string | null;
  created_at: string;
  brands: { name: string } | null;
}

type DateFilter = '7d' | '30d' | '90d' | 'all';

const ACTION_COLORS: Record<string, string> = {
  BLOCKED: 'bg-destructive/10 text-destructive',
  TOGGLED_OFF: 'bg-warning/10 text-warning',
  TOGGLED_ON: 'bg-success/10 text-success',
  LOGIN: 'bg-info/10 text-info',
  LOGOUT: 'bg-muted text-muted-foreground',
  BRAND_CREATED: 'bg-success/10 text-success',
  BRAND_DELETED: 'bg-destructive/10 text-destructive',
  BRAND_RESTORED: 'bg-info/10 text-info',
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  BLOCKED: <AlertTriangle className="w-4 h-4" />,
  TOGGLED_OFF: <ToggleLeft className="w-4 h-4" />,
  TOGGLED_ON: <Power className="w-4 h-4" />,
  LOGIN: <LogIn className="w-4 h-4" />,
  LOGOUT: <PowerOff className="w-4 h-4" />,
};

const getBrowserIcon = (browser: string | null) => {
  if (!browser) return <Globe className="w-5 h-5" />;
  const b = browser.toLowerCase();
  if (b.includes('chrome')) return <Chrome className="w-5 h-5" />;
  if (b.includes('edge')) return <Monitor className="w-5 h-5" />;
  return <Globe className="w-5 h-5" />;
};

export default function UserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('30d');

  useEffect(() => {
    if (!authLoading && userId) {
      fetchUserData();
    }
  }, [authLoading, userId, dateFilter]);

  const fetchUserData = async () => {
    if (!userId) return;
    setIsLoading(true);

    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profileData) {
        toast({
          title: 'User not found',
          description: 'The requested user could not be found.',
          variant: 'destructive',
        });
        navigate('/dashboard/users');
        return;
      }

      setUser(profileData);

      // Fetch events with date filter
      let query = supabase
        .from('events')
        .select(`
          id,
          action,
          term,
          url,
          created_at,
          brands:brand_id (name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (dateFilter !== 'all') {
        const days = dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : 90;
        const startDate = subDays(new Date(), days);
        query = query.gte('created_at', startDate.toISOString());
      }

      const { data: eventsData, error: eventsError } = await query.limit(500);

      if (eventsError) throw eventsError;
      setEvents(eventsData || []);
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load user data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const stats = useMemo(() => {
    const blocked = events.filter(e => e.action === 'BLOCKED').length;
    const toggledOff = events.filter(e => e.action === 'TOGGLED_OFF').length;
    const toggledOn = events.filter(e => e.action === 'TOGGLED_ON').length;
    const logins = events.filter(e => e.action === 'LOGIN').length;
    return { blocked, toggledOff, toggledOn, logins };
  }, [events]);

  const chartData = useMemo(() => {
    const days = dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : dateFilter === '90d' ? 90 : 30;
    const dayMap = new Map<string, number>();
    
    events.forEach(event => {
      if (event.action === 'BLOCKED') {
        const dateKey = format(new Date(event.created_at), 'yyyy-MM-dd');
        dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + 1);
      }
    });

    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateKey = format(date, 'yyyy-MM-dd');
      result.push({
        date: format(date, dateFilter === '7d' ? 'EEE' : 'MMM d'),
        blocks: dayMap.get(dateKey) || 0,
      });
    }
    return result;
  }, [events, dateFilter]);

  const exportToCSV = () => {
    if (events.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There are no events to export.',
        variant: 'destructive',
      });
      return;
    }

    const headers = ['Date', 'Time', 'Action', 'Term/Brand', 'URL'];
    const rows = events.map(event => [
      format(new Date(event.created_at), 'yyyy-MM-dd'),
      format(new Date(event.created_at), 'HH:mm:ss'),
      event.action,
      event.term || event.brands?.name || '',
      event.url || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${user?.display_name || 'user'}-events-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Export complete',
      description: `Downloaded ${events.length} event records`,
    });
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">User not found</p>
          <Button variant="outline" onClick={() => navigate('/dashboard/users')} className="mt-4">
            Back to Users
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const isUserOnline = (lastSeen: string) => {
    const tenMinsAgo = new Date();
    tenMinsAgo.setMinutes(tenMinsAgo.getMinutes() - 10);
    return new Date(lastSeen) >= tenMinsAgo;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/users')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-semibold text-foreground">{user.display_name}</h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              {user.email}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
              <SelectTrigger className="w-36">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportToCSV} className="gap-2">
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* User Info Card */}
        <Card variant="glass">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center">
                    <UserIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-card ${
                    isUserOnline(user.last_seen_at) ? 'bg-success' : 'bg-muted'
                  }`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium text-foreground">
                    {isUserOnline(user.last_seen_at) ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-accent/50">
                {getBrowserIcon(user.browser)}
                <div>
                  <p className="text-sm font-medium text-foreground">{user.browser || 'Unknown'}</p>
                  {user.browser_version && (
                    <p className="text-xs text-muted-foreground">v{user.browser_version}</p>
                  )}
                </div>
              </div>

              <div className={`flex items-center gap-3 px-4 py-2 rounded-xl ${
                user.extension_active ? 'bg-success/10' : 'bg-muted'
              }`}>
                {user.extension_active ? (
                  <Power className="w-5 h-5 text-success" />
                ) : (
                  <PowerOff className="w-5 h-5 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Extension {user.extension_active ? 'Active' : 'Inactive'}
                  </p>
                  {user.extension_version && (
                    <p className="text-xs text-muted-foreground">v{user.extension_version}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                Last seen {formatDistanceToNow(new Date(user.last_seen_at), { addSuffix: true })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card variant="glass">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{stats.blocked}</p>
                  <p className="text-xs text-muted-foreground">Blocked</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                  <ToggleLeft className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{stats.toggledOff}</p>
                  <p className="text-xs text-muted-foreground">Toggled Off</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                  <Power className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{stats.toggledOn}</p>
                  <p className="text-xs text-muted-foreground">Toggled On</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
                  <LogIn className="w-5 h-5 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{stats.logins}</p>
                  <p className="text-xs text-muted-foreground">Logins</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        {dateFilter !== 'all' && (
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="text-base">Blocking Activity</CardTitle>
              <CardDescription>Daily blocked events over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="blocksGradientUser" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="blocks" 
                    name="Blocks"
                    stroke="hsl(0, 72%, 51%)" 
                    strokeWidth={2}
                    fill="url(#blocksGradientUser)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Events List */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-base">Event History ({events.length})</CardTitle>
            <CardDescription>All recorded extension events</CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No events in this period</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {events.map((event) => (
                  <div 
                    key={event.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-accent/30 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${ACTION_COLORS[event.action] || 'bg-muted'}`}>
                        {ACTION_ICONS[event.action] || <Shield className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${ACTION_COLORS[event.action] || ''}`}>
                            {event.action}
                          </Badge>
                          {(event.term || event.brands?.name) && (
                            <span className="text-sm text-foreground font-medium">
                              {event.term || event.brands?.name}
                            </span>
                          )}
                        </div>
                        {event.url && (
                          <p className="text-xs text-muted-foreground truncate max-w-[300px] mt-0.5">
                            {event.url}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.created_at), 'MMM d, yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.created_at), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
