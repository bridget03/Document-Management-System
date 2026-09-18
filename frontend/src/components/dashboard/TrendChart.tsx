import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { SERIES_COLORS, SERIES_LABELS, shortDate } from './chartTheme';
import { ChartEmpty } from './ChartCard';

interface Point {
  date: string;
  incoming: number;
  outgoing: number;
  internal: number;
}

function Tick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  return (
    <text x={x} y={(y || 0) + 14} textAnchor="middle" fontSize={11} fill="#6b7280">
      {shortDate(payload?.value || '')}
    </text>
  );
}

export default function TrendChart({ data }: { data: Point[] }) {
  const total = data.reduce((s, p) => s + p.incoming + p.outgoing + p.internal, 0);
  if (data.length === 0 || total === 0) return <ChartEmpty />;
  return (
    <div className="h-[260px]" role="img" aria-label="Biểu đồ xu hướng công văn theo thời gian">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#eef0f3" vertical={false} />
          <XAxis dataKey="date" tick={<Tick />} interval="preserveStartEnd" minTickGap={28} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={40} />
          <Tooltip
            labelFormatter={(v) => `Ngày ${shortDate(String(v))}`}
            formatter={(value, name) => [value, SERIES_LABELS[String(name)] || name]}
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
          />
          <Legend formatter={(v) => SERIES_LABELS[String(v)] || v} wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="incoming" stroke={SERIES_COLORS.incoming} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="outgoing" stroke={SERIES_COLORS.outgoing} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="internal" stroke={SERIES_COLORS.internal} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
