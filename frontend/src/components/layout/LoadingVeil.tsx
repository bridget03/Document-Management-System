import { useQueryClient } from '@tanstack/react-query';
import logoUrl from '../../assets/logo.jpeg';
import { listDocuments } from '../../services/documentApi';
import { driveStatus } from '../../services/googleDriveApi';
import api from '../../services/api';

/** Warm the cache for the dashboard shell so it renders with data, not skeletons. */
export function prefetchWorkspace(qc: ReturnType<typeof useQueryClient>) {
  return Promise.allSettled([
    qc.prefetchQuery({ queryKey: ['stats-total'], queryFn: () => listDocuments({ page: 1, page_size: 1 }) }),
    qc.prefetchQuery({ queryKey: ['cats'], queryFn: () => api.get('/categories').then((r) => r.data) }),
    qc.prefetchQuery({ queryKey: ['drive-status'], queryFn: driveStatus }),
  ]);
}

export function LoadingVeil({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-[#f6f7f9] animate-fade-in">
      <img src={logoUrl} alt="Vicenza DMS" className="h-14 w-14 rounded-2xl object-cover shadow-card" />
      <span
        className="h-6 w-6 animate-spin rounded-full border-[3px] border-gray-300 border-t-brand-700"
        aria-hidden
      />
      <p className="text-sm font-medium text-gray-600">{message}</p>
    </div>
  );
}
