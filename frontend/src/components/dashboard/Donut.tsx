import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChartEmpty } from './ChartCard';

/** Generic donut with total in the center: label + count shown as text, not color-only. */
export default function Donut({ data, colors, labelMap, title }: {
  data: { key: string; count: number }[];
  colors: Record<string, string>;
  labelMap: Record<string, string>;
  title: string;
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (data.length === 0 || total === 0) return <ChartEmpty />;
  const rows = data.map((d) => ({ ...d, label: labelMap[d.key] || d.key }));
  return (
    <div className="relative h-[220px]" role="img" aria-label={title}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={rows} dataKey="count" nameKey="label" innerRadius="62%" outerRadius="85%" paddingAngle={2} strokeWidth={0}>
            {rows.map((r) => (
              <Cell key={r.key} fill={colors[r.key] || '#9ca3af'} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [`${value} (${Math.round((Number(value) / total) * 100)}%)`, name]}
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
        <span className="text-2xl font-bold text-gray-900">{total.toLocaleString()}</span>
        <span className="text-xs text-gray-500">Tổng số</span>
      </div>
    </div>
  );
}
