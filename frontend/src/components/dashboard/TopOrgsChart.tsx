import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { ChartEmpty } from './ChartCard';
import { TYPE_COLORS } from './chartTheme';

type Mode = 'senders' | 'recipients' | 'departments';

const MODES: { value: Mode; label: string }[] = [
  { value: 'senders', label: 'Nơi gửi' },
  { value: 'recipients', label: 'Nơi nhận' },
  { value: 'departments', label: 'Bộ phận' },
];

const TITLES: Record<Mode, string> = {
  senders: 'Top nơi gửi',
  recipients: 'Top nơi nhận',
  departments: 'Top bộ phận phát hành',
};

interface Props {
  senders: { name: string; count: number }[];
  recipients: { name: string; count: number }[];
  departments: { name: string; count: number }[];
}

export default function TopOrgsChart({ senders, recipients, departments }: Props) {
  const [mode, setMode] = useState<Mode>('recipients');
  const data = (mode === 'senders' ? senders : mode === 'recipients' ? recipients : departments).slice(0, 8);

  return (
    <div>
      <div className="mb-2 flex gap-1.5 px-2" role="group" aria-label="Chọn nhóm đơn vị">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            aria-pressed={mode === m.value}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              mode === m.value ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {data.length === 0 ? (
        <ChartEmpty message={`Chưa có dữ liệu ${TITLES[mode].toLowerCase()} trong khoảng này.`} />
      ) : (
        <div className="h-[260px]" role="img" aria-label={TITLES[mode]}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[...data].reverse()} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#eef0f3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={130}
                tick={{ fontSize: 11, fill: '#374151' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 17) + '…' : v)}
              />
              <Tooltip
                formatter={(value) => [value, 'Số văn bản']}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                {data.map((_, i) => (
                  <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
