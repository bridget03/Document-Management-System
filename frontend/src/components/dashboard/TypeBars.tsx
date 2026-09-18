import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { ChartEmpty } from './ChartCard';
import { TYPE_COLORS } from './chartTheme';

export default function TypeBars({ data }: { data: { id: string; code: string; name: string; count: number }[] }) {
  const rows = data.slice(0, 8);
  if (rows.length === 0) return <ChartEmpty />;
  return (
    <div className="h-[240px]" role="img" aria-label="Biểu đồ loại văn bản">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[...rows].reverse()} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#eef0f3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="code"
            width={64}
            tick={{ fontSize: 11, fill: '#374151', fontWeight: 600 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value, _name, props) => [value, props?.payload?.name || 'Số văn bản']}
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
            {rows.map((_, i) => (
              <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
