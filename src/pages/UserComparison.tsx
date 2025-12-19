import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { format, subDays } from 'date-fns';
import {
  ArrowLeft,
  Download,
  User as UserIcon,
  Calendar,
  AlertTriangle,
  ToggleLeft,
  Power,
  LogIn,
  ArrowLeftRight,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface UserProfile {
  id: string;
  email: string;
  display_name: string;
}

interface UserEvent {
  id: string;
  action: string;
  created_at: string;
}

interface UserStats {
  blocked: number;
  toggledOff: number;
  toggledOn: number;
  logins: number;
}

type DateFilter = '7d' | '30d' | '90d';

export default function UserComparison() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, isLoading: authLoading } = useAuth();
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [user1Id, setUser1Id] = useState<string>(searchParams.get('user1') || '');
  const [user2Id, setUser2Id] = useState<string>(searchParams.get('user2') || '');
  const [user1Events, setUser1Events] = useState<UserEvent[]>([]);
  const [user2Events, setUser2Events] = useState<UserEvent[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>('30d');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      fetchUsers();
    }
  }, [authLoading]);

  useEffect(() => {
    if (user1Id && user2Id) {
      fetchComparisonData();
      setSearchParams({ user1: user1Id, user2: user2Id });
    }
  }, [user1Id, user2Id, dateFilter]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .order('display_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchComparisonData = async () => {
    if (!user1Id || !user2Id) return;
    setIsLoading(true);

    try {
      const days = dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : 90;
      const startDate = subDays(new Date(), days);

      const [res1, res2] = await Promise.all([
        supabase
          .from('events')
          .select('id, action, created_at')
          .eq('user_id', user1Id)
          .gte('created_at', startDate.toISOString()),
        supabase
          .from('events')
          .select('id, action, created_at')
          .eq('user_id', user2Id)
          .gte('created_at', startDate.toISOString()),
      ]);

      if (res1.error) throw res1.error;
      if (res2.error) throw res2.error;

      setUser1Events(res1.data || []);
      setUser2Events(res2.data || []);
    } catch (error) {
      console.error('Error fetching comparison data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load comparison data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (events: UserEvent[]): UserStats => ({
    blocked: events.filter(e => e.action === 'BLOCKED').length,
    toggledOff: events.filter(e => e.action === 'TOGGLED_OFF').length,
    toggledOn: events.filter(e => e.action === 'TOGGLED_ON').length,
    logins: events.filter(e => e.action === 'LOGIN').length,
  });

  const user1Stats = useMemo(() => calculateStats(user1Events), [user1Events]);
  const user2Stats = useMemo(() => calculateStats(user2Events), [user2Events]);

  const user1 = users.find(u => u.id === user1Id);
  const user2 = users.find(u => u.id === user2Id);

  const comparisonChartData = useMemo(() => [
    { metric: 'Blocked', user1: user1Stats.blocked, user2: user2Stats.blocked },
    { metric: 'Toggled Off', user1: user1Stats.toggledOff, user2: user2Stats.toggledOff },
    { metric: 'Toggled On', user1: user1Stats.toggledOn, user2: user2Stats.toggledOn },
    { metric: 'Logins', user1: user1Stats.logins, user2: user2Stats.logins },
  ], [user1Stats, user2Stats]);

  const trendChartData = useMemo(() => {
    const days = dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : 90;
    const dayMap1 = new Map<string, number>();
    const dayMap2 = new Map<string, number>();

    user1Events.forEach(event => {
      if (event.action === 'BLOCKED') {
        const dateKey = format(new Date(event.created_at), 'yyyy-MM-dd');
        dayMap1.set(dateKey, (dayMap1.get(dateKey) || 0) + 1);
      }
    });

    user2Events.forEach(event => {
      if (event.action === 'BLOCKED') {
        const dateKey = format(new Date(event.created_at), 'yyyy-MM-dd');
        dayMap2.set(dateKey, (dayMap2.get(dateKey) || 0) + 1);
      }
    });

    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateKey = format(date, 'yyyy-MM-dd');
      result.push({
        date: format(date, dateFilter === '7d' ? 'EEE' : 'MMM d'),
        user1: dayMap1.get(dateKey) || 0,
        user2: dayMap2.get(dateKey) || 0,
      });
    }
    return result;
  }, [user1Events, user2Events, dateFilter]);

  const exportComparison = () => {
    if (!user1 || !user2) return;

    const headers = ['Metric', user1.display_name, user2.display_name, 'Difference'];
    const rows = [
      ['Blocked', user1Stats.blocked, user2Stats.blocked, user1Stats.blocked - user2Stats.blocked],
      ['Toggled Off', user1Stats.toggledOff, user2Stats.toggledOff, user1Stats.toggledOff - user2Stats.toggledOff],
      ['Toggled On', user1Stats.toggledOn, user2Stats.toggledOn, user1Stats.toggledOn - user2Stats.toggledOn],
      ['Logins', user1Stats.logins, user2Stats.logins, user1Stats.logins - user2Stats.logins],
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `user-comparison-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: 'Export complete', description: 'Comparison data downloaded' });
  };

  const StatCard = ({ 
    icon: Icon, 
    label, 
    value1, 
    value2, 
    colorClass 
  }: { 
    icon: React.ElementType; 
    label: string; 
    value1: number; 
    value2: number; 
    colorClass: string;
  }) => {
    const diff = value1 - value2;
    return (
      <Card variant="glass">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl ${colorClass} flex items-center justify-center`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">{label}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <p className="text-2xl font-semibold text-foreground">{value1}</p>
              <p className="text-xs text-muted-foreground truncate">{user1?.display_name || 'User 1'}</p>
            </div>
            <div className="px-3">
              <Badge variant={diff === 0 ? 'secondary' : diff > 0 ? 'default' : 'outline'}>
                {diff > 0 ? '+' : ''}{diff}
              </Badge>
            </div>
            <div className="text-center flex-1">
              <p className="text-2xl font-semibold text-foreground">{value2}</p>
              <p className="text-xs text-muted-foreground truncate">{user2?.display_name || 'User 2'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/users')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-semibold text-foreground flex items-center gap-3">
              <ArrowLeftRight className="w-8 h-8" />
              User Comparison
            </h1>
            <p className="text-muted-foreground mt-1">Compare activity between two users</p>
          </div>
          {user1Id && user2Id && (
            <Button variant="outline" onClick={exportComparison} className="gap-2">
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          )}
        </div>

        {/* User Selection */}
        <Card variant="glass">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1 w-full">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">First User</label>
                <Select value={user1Id} onValueChange={setUser1Id}>
                  <SelectTrigger className="w-full">
                    <UserIcon className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Select user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter(u => u.id !== user2Id).map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.display_name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ArrowLeftRight className="w-6 h-6 text-muted-foreground shrink-0" />

              <div className="flex-1 w-full">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Second User</label>
                <Select value={user2Id} onValueChange={setUser2Id}>
                  <SelectTrigger className="w-full">
                    <UserIcon className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Select user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter(u => u.id !== user1Id).map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.display_name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="shrink-0">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Period</label>
                <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
                  <SelectTrigger className="w-36">
                    <Calendar className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {user1Id && user2Id && !isLoading && (
          <>
            {/* Stats Comparison */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={AlertTriangle}
                label="Blocked"
                value1={user1Stats.blocked}
                value2={user2Stats.blocked}
                colorClass="bg-destructive/10 text-destructive"
              />
              <StatCard
                icon={ToggleLeft}
                label="Toggled Off"
                value1={user1Stats.toggledOff}
                value2={user2Stats.toggledOff}
                colorClass="bg-warning/10 text-warning"
              />
              <StatCard
                icon={Power}
                label="Toggled On"
                value1={user1Stats.toggledOn}
                value2={user2Stats.toggledOn}
                colorClass="bg-success/10 text-success"
              />
              <StatCard
                icon={LogIn}
                label="Logins"
                value1={user1Stats.logins}
                value2={user2Stats.logins}
                colorClass="bg-info/10 text-info"
              />
            </div>

            {/* Comparison Bar Chart */}
            <Card variant="glass">
              <CardHeader>
                <CardTitle className="text-base">Activity Comparison</CardTitle>
                <CardDescription>Side-by-side metrics comparison</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={comparisonChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis 
                      dataKey="metric" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
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
                    <Legend />
                    <Bar 
                      dataKey="user1" 
                      name={user1?.display_name || 'User 1'} 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar 
                      dataKey="user2" 
                      name={user2?.display_name || 'User 2'} 
                      fill="hsl(var(--secondary))" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Blocking Trend Comparison */}
            <Card variant="glass">
              <CardHeader>
                <CardTitle className="text-base">Blocking Trend Comparison</CardTitle>
                <CardDescription>Daily blocked events over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={trendChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
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
                    <Legend />
                    <Bar 
                      dataKey="user1" 
                      name={user1?.display_name || 'User 1'} 
                      fill="hsl(var(--primary))" 
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar 
                      dataKey="user2" 
                      name={user2?.display_name || 'User 2'} 
                      fill="hsl(var(--secondary))" 
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}

        {user1Id && user2Id && isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {(!user1Id || !user2Id) && (
          <Card variant="glass">
            <CardContent className="p-12 text-center">
              <ArrowLeftRight className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Select two users above to compare their activity</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
