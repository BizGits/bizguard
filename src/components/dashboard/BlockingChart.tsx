import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, subDays, eachDayOfInterval, startOfDay } from 'date-fns';

interface Event {
  id: string;
  action: string;
  created_at: string;
}

interface BlockingChartProps {
  events: Event[];
  days?: number;
}

export function BlockingChart({ events, days = 7 }: BlockingChartProps) {
  const chartData = useMemo(() => {
    const endDate = new Date();
    const startDate = subDays(endDate, days - 1);
    
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
    
    const dataMap = new Map<string, { blocked: number; toggled: number }>();
    
    dateRange.forEach((date) => {
      const key = format(date, 'MMM d');
      dataMap.set(key, { blocked: 0, toggled: 0 });
    });
    
    events.forEach((event) => {
      const eventDate = startOfDay(new Date(event.created_at));
      const key = format(eventDate, 'MMM d');
      
      if (dataMap.has(key)) {
        const current = dataMap.get(key)!;
        if (event.action === 'BLOCKED') {
          current.blocked += 1;
        } else if (event.action === 'TOGGLED_OFF' || event.action === 'TOGGLED_ON') {
          current.toggled += 1;
        }
      }
    });
    
    return Array.from(dataMap.entries()).map(([date, counts]) => ({
      date,
      ...counts,
    }));
  }, [events, days]);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="blockedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="toggledGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid 
          strokeDasharray="3 3" 
          stroke="hsl(var(--border))" 
          vertical={false}
        />
        <XAxis 
          dataKey="date" 
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          dy={10}
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          dx={-10}
        />
        <Tooltip 
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '12px',
            boxShadow: '0 8px 24px -4px hsl(var(--foreground) / 0.1)',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 500, marginBottom: 4 }}
          itemStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}
        />
        <Area
          type="monotone"
          dataKey="blocked"
          name="Blocked"
          stroke="hsl(0, 72%, 51%)"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#blockedGradient)"
        />
        <Area
          type="monotone"
          dataKey="toggled"
          name="Toggled"
          stroke="hsl(142, 76%, 36%)"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#toggledGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
