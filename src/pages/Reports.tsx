import { useEffect, useState, useMemo } from 'react';
import { Download, FileText, Calendar, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, eachWeekOfInterval } from 'date-fns';
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
  LineChart,
  Line,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Event {
  id: string;
  action: string;
  term: string | null;
  url: string | null;
  created_at: string;
  profiles?: { display_name: string } | null;
  brands?: { name: string } | null;
}

interface ReportData {
  totalBlocked: number;
  totalToggled: number;
  totalLogins: number;
  topTerms: { term: string; count: number }[];
  topUsers: { user: string; count: number }[];
  dailyData: { date: string; blocked: number; toggled: number }[];
  weeklyComparison: { current: number; previous: number; change: number };
}

type ReportPeriod = 'week' | 'month' | '3months';

export default function Reports() {
  const { isAdmin } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<ReportPeriod>('month');

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'week':
        return { start: startOfWeek(now), end: endOfWeek(now), label: 'This Week' };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now), label: 'This Month' };
      case '3months':
        return { start: subMonths(now, 3), end: now, label: 'Last 3 Months' };
    }
  }, [period]);

  useEffect(() => {
    fetchEvents();
  }, [dateRange]);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
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
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const reportData = useMemo<ReportData>(() => {
    const blocked = events.filter(e => e.action === 'BLOCKED');
    const toggled = events.filter(e => e.action === 'TOGGLED_ON' || e.action === 'TOGGLED_OFF');
    const logins = events.filter(e => e.action === 'LOGIN');

    // Top terms
    const termCounts = new Map<string, number>();
    blocked.forEach(e => {
      if (e.term) {
        termCounts.set(e.term, (termCounts.get(e.term) || 0) + 1);
      }
    });
    const topTerms = Array.from(termCounts.entries())
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top users
    const userCounts = new Map<string, number>();
    events.forEach(e => {
      const user = e.profiles?.display_name || 'Unknown';
      userCounts.set(user, (userCounts.get(user) || 0) + 1);
    });
    const topUsers = Array.from(userCounts.entries())
      .map(([user, count]) => ({ user, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Daily data
    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    const dailyData = days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayEvents = events.filter(e => e.created_at.startsWith(dayStr));
      return {
        date: format(day, 'MMM d'),
        blocked: dayEvents.filter(e => e.action === 'BLOCKED').length,
        toggled: dayEvents.filter(e => e.action === 'TOGGLED_ON' || e.action === 'TOGGLED_OFF').length,
      };
    });

    // Weekly comparison
    const now = new Date();
    const thisWeekStart = startOfWeek(now);
    const lastWeekStart = subDays(thisWeekStart, 7);
    const thisWeekBlocked = events.filter(e => 
      new Date(e.created_at) >= thisWeekStart && e.action === 'BLOCKED'
    ).length;
    const lastWeekBlocked = events.filter(e => 
      new Date(e.created_at) >= lastWeekStart && 
      new Date(e.created_at) < thisWeekStart && 
      e.action === 'BLOCKED'
    ).length;
    const change = lastWeekBlocked ? Math.round(((thisWeekBlocked - lastWeekBlocked) / lastWeekBlocked) * 100) : 0;

    return {
      totalBlocked: blocked.length,
      totalToggled: toggled.length,
      totalLogins: logins.length,
      topTerms,
      topUsers,
      dailyData,
      weeklyComparison: { current: thisWeekBlocked, previous: lastWeekBlocked, change },
    };
  }, [events, dateRange]);

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(24);
    doc.setTextColor(34, 34, 34);
    doc.text('BizGuard Report', 20, 25);
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`${dateRange.label} - Generated ${format(new Date(), 'MMM d, yyyy')}`, 20, 35);
    
    // Summary stats
    doc.setFontSize(14);
    doc.setTextColor(34, 34, 34);
    doc.text('Summary', 20, 55);
    
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text(`Total Blocked: ${reportData.totalBlocked}`, 20, 65);
    doc.text(`Total Toggled: ${reportData.totalToggled}`, 20, 72);
    doc.text(`Total Logins: ${reportData.totalLogins}`, 20, 79);
    doc.text(`Week-over-Week Change: ${reportData.weeklyComparison.change >= 0 ? '+' : ''}${reportData.weeklyComparison.change}%`, 20, 86);

    // Top blocked terms table
    if (reportData.topTerms.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(34, 34, 34);
      doc.text('Top Blocked Terms', 20, 105);
      
      autoTable(doc, {
        startY: 110,
        head: [['Term', 'Count']],
        body: reportData.topTerms.map(t => [t.term, t.count.toString()]),
        theme: 'grid',
        headStyles: { fillColor: [34, 197, 94], textColor: 255 },
        styles: { fontSize: 10 },
        margin: { left: 20, right: 20 },
      });
    }

    // Top users table
    const finalY = (doc as any).lastAutoTable?.finalY || 150;
    if (reportData.topUsers.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(34, 34, 34);
      doc.text('Most Active Users', 20, finalY + 20);
      
      autoTable(doc, {
        startY: finalY + 25,
        head: [['User', 'Events']],
        body: reportData.topUsers.map(u => [u.user, u.count.toString()]),
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        styles: { fontSize: 10 },
        margin: { left: 20, right: 20 },
      });
    }

    // Footer
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `BizGuard v5 | Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    doc.save(`bizguard-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Reports</h1>
            <p className="text-muted-foreground mt-1">
              View summaries and export reports
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
              <SelectTrigger className="w-40 bg-card">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="3months">Last 3 Months</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={generatePDF} className="gap-2">
              <Download className="w-4 h-4" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card variant="glass" className="animate-slide-up">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Blocked Terms</p>
                  <p className="text-3xl font-semibold text-foreground mt-1">
                    {isLoading ? '—' : reportData.totalBlocked}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass" className="animate-slide-up" style={{ animationDelay: '50ms' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Toggle Events</p>
                  <p className="text-3xl font-semibold text-foreground mt-1">
                    {isLoading ? '—' : reportData.totalToggled}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-warning/10 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass" className="animate-slide-up" style={{ animationDelay: '100ms' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">User Logins</p>
                  <p className="text-3xl font-semibold text-foreground mt-1">
                    {isLoading ? '—' : reportData.totalLogins}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-info/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-info" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass" className="animate-slide-up" style={{ animationDelay: '150ms' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Week Change</p>
                  <p className={`text-3xl font-semibold mt-1 ${
                    reportData.weeklyComparison.change > 0 ? 'text-destructive' :
                    reportData.weeklyComparison.change < 0 ? 'text-success' :
                    'text-foreground'
                  }`}>
                    {isLoading ? '—' : `${reportData.weeklyComparison.change >= 0 ? '+' : ''}${reportData.weeklyComparison.change}%`}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  reportData.weeklyComparison.change > 0 ? 'bg-destructive/10' : 'bg-success/10'
                }`}>
                  {reportData.weeklyComparison.change > 0 ? (
                    <TrendingUp className="w-6 h-6 text-destructive" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-success" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily activity chart */}
          <Card variant="glass" className="animate-slide-up" style={{ animationDelay: '200ms' }}>
            <CardHeader>
              <CardTitle className="text-base">Daily Activity</CardTitle>
              <CardDescription>Blocked and toggled events per day</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[250px] flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={reportData.dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px -4px hsl(var(--foreground) / 0.1)',
                      }}
                    />
                    <Bar dataKey="blocked" name="Blocked" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="toggled" name="Toggled" fill="hsl(142, 76%, 46%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Trend line chart */}
          <Card variant="glass" className="animate-slide-up" style={{ animationDelay: '250ms' }}>
            <CardHeader>
              <CardTitle className="text-base">Blocking Trend</CardTitle>
              <CardDescription>Daily blocked events over time</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[250px] flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={reportData.dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px -4px hsl(var(--foreground) / 0.1)',
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="blocked" 
                      name="Blocked"
                      stroke="hsl(0, 72%, 51%)" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(0, 72%, 51%)', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top blocked terms */}
          <Card variant="glass" className="animate-slide-up" style={{ animationDelay: '300ms' }}>
            <CardHeader>
              <CardTitle className="text-base">Top Blocked Terms</CardTitle>
              <CardDescription>Most frequently blocked search terms</CardDescription>
            </CardHeader>
            <CardContent>
              {reportData.topTerms.length === 0 ? (
                <p className="text-sm text-muted-foreground">No blocked terms in this period</p>
              ) : (
                <div className="space-y-3">
                  {reportData.topTerms.map((item, index) => (
                    <div key={item.term} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-destructive/20 text-destructive text-xs font-medium flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-foreground">{item.term}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{item.count} blocks</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top users */}
          <Card variant="glass" className="animate-slide-up" style={{ animationDelay: '350ms' }}>
            <CardHeader>
              <CardTitle className="text-base">Most Active Users</CardTitle>
              <CardDescription>Users with most events</CardDescription>
            </CardHeader>
            <CardContent>
              {reportData.topUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No user activity in this period</p>
              ) : (
                <div className="space-y-3">
                  {reportData.topUsers.map((item, index) => (
                    <div key={item.user} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-medium flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-foreground">{item.user}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{item.count} events</span>
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
