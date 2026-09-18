import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Menu, Search, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { driveStatus } from '../../services/googleDriveApi';
import { useAuthStore } from '../../stores/authStore';
import type { DriveStatus } from '../../types/document';

const crumbs: Record<string, string[]> = {
  '/dashboard': ['Overview'],
  '/documents': ['Documents'],
  '/upload': ['Documents', 'Upload'],
  '/drive': ['Google Drive'],
  '/categories': ['Categories'],
  '/tags': ['Tags'],
};

function useCrumbs(): string[] {
  const { pathname } = useLocation();
  if (pathname.startsWith('/correspondence/incoming/')) return ['Văn bản đến', 'Chi tiết'];
  if (pathname.startsWith('/correspondence/outgoing/')) return ['Văn bản đi', 'Chi tiết'];
  if (pathname.startsWith('/correspondence/internal/')) return ['Văn bản nội bộ', 'Chi tiết'];
  if (pathname === '/correspondence/incoming') return ['Quản lý công văn', 'Văn bản đến'];
  if (pathname === '/correspondence/outgoing') return ['Quản lý công văn', 'Văn bản đi'];
  if (pathname === '/correspondence/internal') return ['Quản lý công văn', 'Văn bản nội bộ'];
  if (pathname === '/correspondence/types') return ['Cấu hình', 'Loại văn bản'];
  if (pathname === '/correspondence/settings') return ['Cấu hình', 'Cấu hình văn bản'];
  if (pathname.startsWith('/documents/') && pathname.endsWith('/preview')) return ['Documents', 'Detail', 'Preview'];
  if (pathname.startsWith('/documents/')) return ['Documents', 'Detail'];
  return crumbs[pathname] || ['Documents'];
}

export default function Header({ onMenu }: { onMenu: () => void }) {
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const items = useCrumbs();
  const token = useAuthStore((s) => s.token);
  const { data: drive } = useQuery<DriveStatus>({
    queryKey: ['drive-status'],
    queryFn: driveStatus,
    enabled: !!token,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    nav(`/documents${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gray-200 bg-white px-4 md:px-6">
      <button onClick={onMenu} className="rounded p-2 text-gray-500 hover:bg-gray-100 lg:hidden" aria-label="Open navigation">
        <Menu size={18} />
      </button>
      <nav className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex" aria-label="Breadcrumb">
        {items.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-gray-300">/</span>}
            <span className={i === items.length - 1 ? 'font-semibold text-gray-900' : 'text-gray-500'}>{c}</span>
          </span>
        ))}
      </nav>
      <div className="flex-1" />
      <form onSubmit={submit} className="hidden items-center md:flex" role="search">
        <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 focus-within:border-brand-600 focus-within:bg-white">
          <Search size={15} className="shrink-0 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search documents..."
            className="w-44 bg-transparent text-sm outline-none placeholder:text-gray-400 lg:w-56"
            aria-label="Global search documents"
          />
        </div>
      </form>
      {drive?.connected ? (
        <Link
          to="/drive"
          title={drive.last_sync ? `Last sync: ${new Date(drive.last_sync).toLocaleString()}` : 'Connected'}
          className="hidden items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 sm:inline-flex"
        >
          <RefreshCw size={12} />
          Drive synced
        </Link>
      ) : (
        <Link
          to="/drive"
          className="hidden items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-500 sm:inline-flex"
        >
          Drive not connected
        </Link>
      )}
    </header>
  );
}
