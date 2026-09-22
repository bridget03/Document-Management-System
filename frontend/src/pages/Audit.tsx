import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Search } from 'lucide-react';
import api from '../services/api';
import { Card, TableSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { TextInput, Select, Field } from '../components/ui/Input';

interface AuditItem {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  action: string;
  document_id: string | null;
  correspondence_id: string | null;
  ip_address: string | null;
  created_at: string;
}

const ACTIONS = [
  '', 'LOGIN', 'LOGIN_FAIL', 'LOGOUT', 'UPLOAD', 'DOWNLOAD', 'PREVIEW', 'UPDATE', 'DELETE',
  'CORR_CREATE', 'CORR_UPDATE', 'CORR_DELETE', 'CORR_IMPORT', 'CORR_DETACH', 'CORR_UNLINK',
  'USER_CREATE', 'USER_UPDATE', 'USER_RESET_PASSWORD', 'TYPE_CREATE', 'TYPE_UPDATE',
  'TYPE_DELETE', 'NUMBERING_UPDATE', 'CATEGORY_CREATE', 'CATEGORY_UPDATE', 'CATEGORY_DELETE',
  'TAG_CREATE', 'TAG_DELETE', 'DRIVE_CONFIG', 'DRIVE_SYNC',
];

const ACTION_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'> = {
  LOGIN_FAIL: 'danger',
  DELETE: 'danger',
  CORR_DELETE: 'danger',
  USER_RESET_PASSWORD: 'warning',
  LOGIN: 'success',
  UPLOAD: 'brand',
  CORR_CREATE: 'brand',
  PREVIEW: 'info',
  DOWNLOAD: 'info',
};

export default function Audit() {
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState({ q: '', action: '', dateFrom: '', dateTo: '' });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit', applied, page],
    queryFn: () =>
      api
        .get('/audit-logs', {
          params: {
            q: applied.q || undefined,
            action: applied.action || undefined,
            date_from: applied.dateFrom || undefined,
            date_to: applied.dateTo || undefined,
            page,
            page_size: 20,
          },
        })
        .then((r) => r.data),
  });

  const apply = () => {
    setPage(1);
    setApplied({ q, action, dateFrom, dateTo });
  };

  const exportCsv = () => {
    const rows: AuditItem[] = data?.items || [];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      'time,user,email,action,document_id,correspondence_id,ip',
      ...rows.map((r) =>
        [r.created_at, r.user_name, r.user_email, r.action, r.document_id, r.correspondence_id, r.ip_address]
          .map(esc)
          .join(','),
      ),
    ].join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-log.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nhật ký hệ thống</h1>
          <p className="mt-0.5 text-sm text-gray-500">Truy vết ai đã làm gì, từ đâu, khi nào.</p>
        </div>
        <Button onClick={exportCsv} disabled={!data?.items?.length}>
          <Download size={15} /> Xuất CSV (trang hiện tại)
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Field label="Tìm (email/tên/IP)">
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="admin@…" />
          </Field>
          <Field label="Hành động">
            <Select value={action} onChange={(e) => setAction(e.target.value)}>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>{a || '— Tất cả —'}</option>
              ))}
            </Select>
          </Field>
          <Field label="Từ ngày">
            <TextInput type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </Field>
          <Field label="Đến ngày">
            <TextInput type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button variant="primary" onClick={apply}>
              <Search size={15} /> Lọc
            </Button>
          </div>
        </div>
      </Card>

      {isError ? (
        <Card className="px-6 py-10 text-center">
          <p className="font-semibold text-gray-900">Không tải được nhật ký</p>
          <p className="mt-1 text-sm text-gray-500">Bạn cần quyền Admin.</p>
          <Button size="sm" className="mt-3" onClick={() => refetch()}>Thử lại</Button>
        </Card>
      ) : isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : (data?.items || []).length === 0 ? (
        <EmptyState title="Không có bản ghi" description="Thử nới điều kiện lọc." />
      ) : (
        <>
          <Card className="overflow-x-auto">
            <table className="min-w-[860px] w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3">Thời gian</th>
                  <th className="px-5 py-3">Người dùng</th>
                  <th className="px-5 py-3">Hành động</th>
                  <th className="px-5 py-3">Đối tượng</th>
                  <th className="px-5 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data.items as AuditItem[]).map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-5 py-2.5 text-gray-600">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-5 py-2.5">
                      <span className="block font-medium text-gray-900">{r.user_name || '—'}</span>
                      <span className="block text-xs text-gray-400">{r.user_email || ''}</span>
                    </td>
                    <td className="px-5 py-2.5">
                      <Badge tone={ACTION_TONE[r.action] || 'neutral'}>{r.action}</Badge>
                    </td>
                    <td className="max-w-[220px] truncate px-5 py-2.5 font-mono text-xs text-gray-500">
                      {r.document_id || r.correspondence_id || '—'}
                    </td>
                    <td className="px-5 py-2.5 text-gray-500">{r.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              Trang {data.page}/{data.total_pages} · {data.total} bản ghi
            </span>
            <div className="flex gap-2">
              <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Trước</Button>
              <Button size="sm" disabled={page >= data.total_pages} onClick={() => setPage((p) => p + 1)}>Sau</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
