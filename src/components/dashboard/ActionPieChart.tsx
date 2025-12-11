import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

interface Event {
  id: string;
  action: string;
}

interface ActionPieChartProps {
  events: Event[];
}

const ACTION_COLORS: Record<string, string> = {
  BLOCKED: 'hsl(0, 72%, 51%)',
  TOGGLED_OFF: 'hsl(38, 92%, 50%)',
  TOGGLED_ON: 'hsl(142, 76%, 36%)',
  LOGIN: 'hsl(199, 89%, 48%)',
  LOGOUT: 'hsl(220, 9%, 46%)',
};

export function ActionPieChart({ events }: ActionPieChartProps) {
  const chartData = useMemo(() => {
    const counts = new Map<string, number>();
    
    events.forEach((event) => {
      counts.set(event.action, (counts.get(event.action) || 0) + 1);
    });
    
    return Array.from(counts.entries())
      .map(([action, count]) => ({
        name: action.charAt(0) + action.slice(1).toLowerCase().replace('_', ' '),
        value: count,
        color: ACTION_COLORS[action] || 'hsl(220, 9%, 46%)',
      }))
      .sort((a, b) => b.value - a.value);
  }, [events]);

  if (chartData.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={75}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '12px',
            boxShadow: '0 8px 24px -4px hsl(var(--foreground) / 0.1)',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}
          itemStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}
        />
        <Legend
          verticalAlign="middle"
          align="right"
          layout="vertical"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value) => <span style={{ color: 'hsl(var(--muted-foreground))' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
