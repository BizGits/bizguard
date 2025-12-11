import { useEffect, useState } from 'react';
import { Search, Calendar, Filter, X, Download } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { formatDistanceToNow, format, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface Event {
  id: string;
  action: string;
  term: string | null;
  url: string | null;
  created_at: string;
  profiles?: { display_name: string } | null;
  brands?: { name: string } | null;
}

type DateRange = {
  from: Date | undefined;
  to?: Date | undefined;
};

const ACTION_COLORS: Record<string, string> = {
  BLOCKED: 'bg-destructive/20 text-destructive border-destructive/30',
  TOGGLED_OFF: 'bg-warning/20 text-warning border-warning/30',
  TOGGLED_ON: 'bg-success/20 text-success border-success/30',
  LOGIN: 'bg-info/20 text-info border-info/30',
  LOGOUT: 'bg-muted text-muted-foreground border-border',
};

export default function Events() {
  const { isAdmin } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  useEffect(() => {
    fetchEvents();
  }, [isAdmin, dateRange]);

  useEffect(() => {
    filterEvents();
  }, [events, searchQuery, actionFilter]);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      let query = supabase
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
        .order('created_at', { ascending: false });

      if (dateRange.from) {
        query = query.gte('created_at', startOfDay(dateRange.from).toISOString());
      }
      if (dateRange.to) {
        query = query.lte('created_at', endOfDay(dateRange.to).toISOString());
      }

      const { data, error } = await query.limit(500);

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterEvents = () => {
    let filtered = [...events];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (event) =>
          event.term?.toLowerCase().includes(query) ||
          event.url?.toLowerCase().includes(query) ||
          event.profiles?.display_name?.toLowerCase().includes(query) ||
          event.brands?.name?.toLowerCase().includes(query)
      );
    }

    if (actionFilter !== 'all') {
      filtered = filtered.filter((event) => event.action === actionFilter);
    }

    setFilteredEvents(filtered);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setActionFilter('all');
    setDateRange({ from: subDays(new Date(), 7), to: new Date() });
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Action', 'User', 'Brand', 'Term', 'URL'];
    const rows = filteredEvents.map((event) => [
      format(new Date(event.created_at), 'yyyy-MM-dd HH:mm:ss'),
      event.action,
      event.profiles?.display_name || 'Unknown',
      event.brands?.name || '-',
      event.term || '-',
      event.url || '-',
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bizguard-events-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Activity Log</h1>
            <p className="text-muted-foreground mt-1">
              View and filter all blocking events
            </p>
          </div>
          <Button variant="outline" onClick={exportToCSV} className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card variant="glass">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by term, URL, user, or brand..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background/50"
                />
              </div>

              {/* Action filter */}
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-full lg:w-48 bg-background/50">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                  <SelectItem value="TOGGLED_ON">Toggled On</SelectItem>
                  <SelectItem value="TOGGLED_OFF">Toggled Off</SelectItem>
                  <SelectItem value="LOGIN">Login</SelectItem>
                  <SelectItem value="LOGOUT">Logout</SelectItem>
                </SelectContent>
              </Select>

              {/* Date range picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full lg:w-auto gap-2 bg-background/50">
                    <Calendar className="w-4 h-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d')}
                        </>
                      ) : (
                        format(dateRange.from, 'MMM d, yyyy')
                      )
                    ) : (
                      'Pick dates'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={dateRange}
                    onSelect={(range) => setDateRange(range || { from: undefined })}
                    numberOfMonths={2}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              {/* Clear filters */}
              {(searchQuery || actionFilter !== 'all') && (
                <Button variant="ghost" size="icon" onClick={clearFilters}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredEvents.length} of {events.length} events
          </p>
        </div>

        {/* Events list */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-base">Events</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No events found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your filters
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredEvents.map((event, index) => (
                  <div
                    key={event.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-accent/20 hover:bg-accent/30 transition-colors animate-slide-up gap-3"
                    style={{ animationDelay: `${Math.min(index * 20, 200)}ms` }}
                  >
                    <div className="flex items-start sm:items-center gap-4">
                      <span
                        className={cn(
                          'text-xs font-medium px-3 py-1.5 rounded-full border whitespace-nowrap',
                          ACTION_COLORS[event.action] || 'bg-accent text-foreground'
                        )}
                      >
                        {event.action}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {event.term || event.brands?.name || 'System event'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {event.profiles?.display_name || 'Unknown user'}
                          {event.url && (
                            <span className="ml-2 opacity-60">• {event.url}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap pl-16 sm:pl-0">
                      <span className="hidden sm:inline">
                        {format(new Date(event.created_at), 'MMM d, HH:mm')}
                      </span>
                      <span className="sm:hidden">
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                      </span>
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
