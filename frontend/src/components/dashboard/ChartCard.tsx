import { Link } from 'react-router-dom';
import { Card, Skeleton } from '../ui/Skeleton';

export function ChartCard({ title, hint, action, children }: {
  title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Card className="flex min-w-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-gray-900">{title}</h2>
          {hint && <p className="truncate text-xs text-gray-500">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="flex-1 px-3 py-3">{children}</div>
    </Card>
  );
}

export function ChartEmpty({ message = 'Chưa có dữ liệu trong khoảng thời gian này.' }: { message?: string }) {
  return <p className="flex h-[220px] items-center justify-center px-6 text-center text-sm text-gray-400">{message}</p>;
}

export function ChartSkeleton() {
  return (
    <div className="space-y-2.5 p-5" aria-label="Đang tải biểu đồ">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function KpiCard({ icon, label, value, loading, to }: {
  icon: React.ReactNode; label: string; value: number; loading: boolean; to: string;
}) {
  return (
    <Link to={to}>
      <Card className="flex items-center gap-3 p-4 transition-colors duration-150 hover:border-gray-300">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs text-gray-500">{label}</span>
          {loading
            ? <Skeleton className="mt-1 h-6 w-16" />
            : <span className="block text-xl font-bold text-gray-900">{value.toLocaleString()}</span>}
        </span>
      </Card>
    </Link>
  );
}
