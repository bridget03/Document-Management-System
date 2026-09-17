import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Files, FolderOpen, HardDrive, AlertTriangle, Upload, ArrowRight, Clock, Inbox, Send } from 'lucide-react';
import { listDocuments } from '../services/documentApi';
import { corrList } from '../services/correspondenceApi';
import { driveStatus } from '../services/googleDriveApi';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { Card, Skeleton } from '../components/ui/Skeleton';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { fileTypeLabel } from '../components/document-viewer/preview';
import type { Document, Paginated } from '../types/document';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Good morning';
  if (h < 14) return 'Good day';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function StatCard({ icon, label, value, loading, to }: {
  icon: React.ReactNode; label: string; value: number | string; loading: boolean; to: string;
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
            : <span className="block text-xl font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString() : value}</span>}
        </span>
      </Card>
    </Link>
  );
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const totalQ = useQuery({ queryKey: ['stats-total'], queryFn: () => listDocuments({ page: 1, page_size: 1 }) });
  const driveQ = useQuery({ queryKey: ['stats-drive'], queryFn: () => listDocuments({ source: 'GOOGLE_DRIVE', page: 1, page_size: 1 }) });
  const missingQ = useQuery({ queryKey: ['stats-missing'], queryFn: () => listDocuments({ sync_status: 'REMOTE_MISSING', page: 1, page_size: 1 }) });
  const catsQ = useQuery({ queryKey: ['cats'], queryFn: () => api.get('/categories').then((r) => r.data) });
  const recentQ = useQuery<Paginated<Document>>({ queryKey: ['stats-recent'], queryFn: () => listDocuments({ page: 1, page_size: 8 }) });
  const sampleQ = useQuery<Paginated<Document>>({ queryKey: ['stats-sample'], queryFn: () => listDocuments({ page: 1, page_size: 100 }) });
  const driveStatusQ = useQuery({ queryKey: ['drive-status'], queryFn: driveStatus, retry: false, refetchOnWindowFocus: false });
  const corrInQ = useQuery({ queryKey: ['stats-corr-in'], queryFn: () => corrList('incoming', { page: 1, page_size: 1 }), retry: false });
  const corrOutQ = useQuery({ queryKey: ['stats-corr-out'], queryFn: () => corrList('outgoing', { page: 1, page_size: 1 }), retry: false });

  const byCategory = new Map<string, number>();
  for (const d of sampleQ.data?.items || []) {
    const name = d.category?.name || 'Uncategorized';
    byCategory.set(name, (byCategory.get(name) || 0) + 1);
  }
  const topCats = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{greeting()}, {user?.name || 'there'}</h1>
          <p className="mt-0.5 text-sm text-gray-500">Here&apos;s what&apos;s happening with your documents.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/upload"><Button variant="primary"><Upload size={15} /> Upload document</Button></Link>
          <Link to="/documents"><Button>Browse documents</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Files size={18} />} label="Total documents" value={totalQ.data?.total ?? 0} loading={totalQ.isLoading} to="/documents" />
        <StatCard icon={<FolderOpen size={18} />} label="Categories" value={catsQ.data?.length ?? 0} loading={catsQ.isLoading} to="/categories" />
        <StatCard icon={<HardDrive size={18} />} label="Synced from Drive" value={driveQ.data?.total ?? 0} loading={driveQ.isLoading} to="/documents" />
        <StatCard icon={<AlertTriangle size={18} />} label="Needs attention" value={missingQ.data?.total ?? 0} loading={missingQ.isLoading} to="/documents" />
      </div>

      <Card className="flex flex-wrap items-center gap-x-8 gap-y-2 px-5 py-3.5">
        <span className="text-sm font-semibold text-gray-900">Quản lý công văn</span>
        <Link to="/correspondence/incoming" className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-brand-700">
          <Inbox size={15} className="text-gray-400" /> Văn bản đến <b className="text-gray-900">{corrInQ.data?.total ?? '—'}</b>
        </Link>
        <Link to="/correspondence/outgoing" className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-brand-700">
          <Send size={15} className="text-gray-400" /> Văn bản đi <b className="text-gray-900">{corrOutQ.data?.total ?? '—'}</b>
        </Link>
      </Card>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-gray-900">Recent documents</h2>
            <Link to="/documents" className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          {recentQ.isLoading ? (
            <div className="space-y-2.5 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
          ) : (recentQ.data?.items.length || 0) === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500">No documents yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentQ.data?.items.map((d) => (
                <li key={d.id}>
                  <Link to={`/documents/${d.id}`} className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-gray-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900">{d.name}</span>
                      <span className="block text-xs text-gray-500">
                        {fileTypeLabel(d)} · {d.category?.name || 'Uncategorized'} · {new Date(d.updated_at).toLocaleDateString()}
                      </span>
                    </span>
                    <Badge tone={d.sync_status === 'SYNCED' ? 'success' : d.sync_status === 'REMOTE_MISSING' ? 'warning' : 'neutral'} dot>
                      {d.sync_status === 'SYNCED' ? 'Synced' : d.sync_status === 'REMOTE_MISSING' ? 'Missing' : d.source === 'GOOGLE_DRIVE' ? 'Drive' : 'Local'}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-3">
          <Card>
            <h2 className="border-b border-gray-200 px-5 py-3.5 text-sm font-semibold text-gray-900">Sync overview</h2>
            <div className="space-y-2 px-5 py-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Google Drive</span>
                {driveStatusQ.data?.connected
                  ? <Badge tone="success" dot>Connected</Badge>
                  : <Badge tone="neutral" dot>Not connected</Badge>}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Folder</span>
                <span className="font-medium text-gray-900">{driveStatusQ.data?.folder_name || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-gray-500"><Clock size={13} /> Last sync</span>
                <span className="font-medium text-gray-900">
                  {driveStatusQ.data?.last_sync ? new Date(driveStatusQ.data.last_sync).toLocaleString() : 'Never'}
                </span>
              </div>
              <Link to="/drive"><Button size="sm" className="mt-1 w-full">Open Google Drive</Button></Link>
            </div>
          </Card>

          <Card>
            <h2 className="border-b border-gray-200 px-5 py-3.5 text-sm font-semibold text-gray-900">Documents by category</h2>
            {sampleQ.isLoading ? (
              <div className="space-y-2.5 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
            ) : topCats.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-gray-500">No data.</p>
            ) : (
              <ul className="space-y-2.5 px-5 py-4">
                {topCats.map(([name, count]) => (
                  <li key={name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">{name}</span>
                      <span className="text-gray-500">{count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-brand-600"
                        style={{ width: `${Math.max(4, (count / (sampleQ.data?.total || count)) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
