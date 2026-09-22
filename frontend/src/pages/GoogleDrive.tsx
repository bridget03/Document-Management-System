import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, FolderOpen, X, RefreshCw, Link2, Clock } from 'lucide-react';
import {
  driveStatus, driveAuth, driveSync, driveLogs, driveFolders,
  saveDriveConfig, listSyncFiles, removeSyncFile,
} from '../services/googleDriveApi';
import FileBrowserModal from '../components/google-drive/FileBrowserModal';
import { Card, Skeleton } from '../components/ui/Skeleton';
import Button from '../components/ui/Button';
import { IconButton, SegmentButton } from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { Select } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import type { DriveStatus, SyncFile, SyncLog } from '../types/document';

export default function GoogleDrive() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: status, isLoading: statusLoading } = useQuery<DriveStatus>({ queryKey: ['drive-status'], queryFn: driveStatus });
  const { data: logs } = useQuery<SyncLog[]>({ queryKey: ['drive-logs'], queryFn: driveLogs });
  const { data: folders, isError: foldersError } = useQuery({
    queryKey: ['drive-folders'],
    queryFn: driveFolders,
    enabled: !!status?.connected,
    retry: false,
  });
  const { data: selected } = useQuery<SyncFile[]>({
    queryKey: ['drive-selected'],
    queryFn: listSyncFiles,
    enabled: !!status?.connected,
  });

  const [mode, setMode] = useState<'FOLDER' | 'FILES'>('FOLDER');
  const [folderId, setFolderId] = useState('');
  const [browserOpen, setBrowserOpen] = useState(false);

  useEffect(() => {
    if (status?.sync_scope === 'FILES') setMode('FILES');
    else setMode('FOLDER');
  }, [status?.sync_scope]);

  const sync = useMutation({
    mutationFn: driveSync,
    onSuccess: (r: { total: number; created: number; updated: number }) => {
      qc.invalidateQueries({ queryKey: ['drive-logs'] });
      qc.invalidateQueries({ queryKey: ['drive-status'] });
      qc.invalidateQueries({ queryKey: ['docs'] });
      toast('success', `Sync completed: ${r.total} files (${r.created} new, ${r.updated} updated).`);
    },
    onError: () => toast('error', 'Sync failed. Please try again.'),
  });
  const save = useMutation({
    mutationFn: (payload: { folder_id?: string; folder_name?: string; sync_scope: string }) => saveDriveConfig(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drive-status'] });
      toast('success', 'Configuration saved.');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to save.';
      toast('error', msg);
    },
  });
  const remove = useMutation({
    mutationFn: removeSyncFile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drive-selected'] });
      qc.invalidateQueries({ queryKey: ['drive-status'] });
    },
    onError: () => toast('error', 'Could not remove file.'),
  });

  const connect = async () => {
    try {
      const { auth_url } = await driveAuth();
      window.open(auth_url, '_blank');
    } catch {
      toast('error', 'Could not start Google authorization.');
    }
  };

  const saveFolderMode = () => {
    const f = (folders?.folders || []).find((x: { id: string }) => x.id === folderId);
    if (!f) {
      toast('error', 'Please select a folder.');
      return;
    }
    save.mutate({ folder_id: f.id, folder_name: f.name, sync_scope: 'FOLDER' });
  };

  const saveFilesMode = () => {
    if (!selected || selected.length === 0) {
      toast('error', 'Please select at least one file.');
      return;
    }
    save.mutate({ sync_scope: 'FILES' });
  };

  const canSync =
    !!status?.connected &&
    (mode === 'FOLDER' ? !!status?.folder_id : (status?.selected_count || 0) > 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Google Drive</h1>
        <p className="mt-0.5 text-sm text-gray-500">Connect and synchronize documents from Google Drive.</p>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Link2 size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900">Google Drive</p>
              <p className="text-xs text-gray-500">{status?.email || 'Company documents'}</p>
            </div>
          </div>
          {statusLoading ? (
            <Skeleton className="h-6 w-24" />
          ) : status?.connected ? (
            <Badge tone="success" dot>Connected</Badge>
          ) : (
            <Badge tone="neutral" dot>Not connected</Badge>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
          <Button onClick={connect}>{status?.connected ? 'Manage connection' : 'Connect Google Drive'}</Button>
          <Button variant="primary" loading={sync.isPending} disabled={!canSync} onClick={() => sync.mutate()}>
            <RefreshCw size={15} /> Sync now
          </Button>
        </div>
        {status?.connected && !canSync && (
          <p className="mt-2 text-sm text-amber-600">
            {mode === 'FOLDER' ? 'Select a sync folder below before syncing.' : 'Select at least one file below before syncing.'}
          </p>
        )}
      </Card>

      {status?.connected && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-900">Synchronization</h2>
          <p className="mt-0.5 text-xs text-gray-500">Choose what to synchronize.</p>
          <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Sync scope">
            {(['FOLDER', 'FILES'] as const).map((m) => (
              <SegmentButton
                key={m}
                role="radio"
                aria-checked={mode === m}
                active={mode === m}
                onClick={() => setMode(m)}
                className="border px-4 py-2 text-sm"
              >
                {m === 'FOLDER' ? 'Entire folder' : 'Selected files'}
              </SegmentButton>
            ))}
          </div>

          {mode === 'FOLDER' && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-gray-600">
                Folder: <span className="font-medium text-gray-900">{status.folder_name || status.folder_id || '— not selected —'}</span>
              </p>
              {foldersError && <p className="text-sm text-red-600">Could not load folders from Google Drive.</p>}
              <div className="flex flex-wrap gap-2">
                <Select value={folderId} onChange={(e) => setFolderId(e.target.value)} className="min-w-[220px] flex-1" aria-label="Choose sync folder">
                  <option value="">— Choose a folder —</option>
                  {(folders?.folders || []).map((f: { id: string; name: string }) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </Select>
                <Button onClick={saveFolderMode} disabled={!folderId} loading={save.isPending}>Save</Button>
              </div>
            </div>
          )}

          {mode === 'FILES' && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Selected: <span className="font-medium text-gray-900">{selected?.length || 0} file{(selected?.length || 0) === 1 ? '' : 's'}</span>
                </p>
                <Button size="sm" onClick={() => setBrowserOpen(true)}>
                  <FolderOpen size={14} /> Select files
                </Button>
              </div>
              {(selected || []).length > 0 ? (
                <ul className="max-h-48 divide-y divide-gray-100 overflow-auto rounded-md border border-gray-200">
                  {(selected || []).map((s) => (
                    <li key={s.google_drive_file_id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <FileText size={14} className="shrink-0 text-blue-500" />
                      <span className="flex-1 truncate text-gray-700">{s.file_name}</span>
                      <IconButton label={`Remove ${s.file_name}`} tone="danger" iconSize="sm" onClick={() => remove.mutate(s.google_drive_file_id)}>
                        <X size={14} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No files selected yet.</p>
              )}
              <Button onClick={saveFilesMode} loading={save.isPending}>Save configuration</Button>
            </div>
          )}

          <div className="mt-4 flex items-center gap-1.5 border-t border-gray-100 pt-3 text-sm text-gray-600">
            <Clock size={14} className="text-gray-400" />
            Last synchronization: <span className="font-medium text-gray-900">{status.last_sync ? new Date(status.last_sync).toLocaleString() : 'Never'}</span>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="border-b border-gray-200 px-5 py-3.5 text-sm font-semibold text-gray-900">Sync history</h2>
        {(logs || []).length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-gray-500">No synchronizations yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {(logs || []).map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5 text-sm">
                <Badge tone={l.status === 'SUCCESS' ? 'success' : l.status === 'FAILED' ? 'danger' : 'warning'}>
                  {l.status}
                </Badge>
                <span className="text-gray-600">{new Date(l.started_at).toLocaleString()}</span>
                <span className="text-gray-400">
                  · {l.total_files} total · {l.created_files} new · {l.updated_files} updated
                  {l.failed_files > 0 && ` · ${l.failed_files} failed`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!status?.connected && !statusLoading && (
        <EmptyState
          title="Connect Google Drive"
          description="Sync your company documents directly from Google Drive."
          actionLabel="Connect Google Drive"
          onAction={connect}
        />
      )}

      <FileBrowserModal open={browserOpen} onClose={() => setBrowserOpen(false)} />
    </div>
  );
}
