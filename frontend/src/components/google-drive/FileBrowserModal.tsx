import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Folder, FileText, Search, X } from 'lucide-react';
import { driveItems, listSyncFiles, saveSyncFiles } from '../../services/googleDriveApi';
import type { DriveItem, SyncFile } from '../../types/document';

interface Crumb {
  id: string | null;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

function fmtSize(size?: string): string {
  const n = Number(size || 0);
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function fmtDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return '';
  }
}

export default function FileBrowserModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [stack, setStack] = useState<Crumb[]>([{ id: null, name: 'My Drive' }]);
  const [search, setSearch] = useState('');
  // Selection spans folders: id -> metadata.
  const [picked, setPicked] = useState<Map<string, { file_name: string; mime_type?: string; parent_id: string | null }>>(new Map());

  const parentId = stack[stack.length - 1].id;

  const { data: existing } = useQuery<SyncFile[]>({
    queryKey: ['drive-selected'],
    queryFn: listSyncFiles,
    enabled: open,
  });

  useEffect(() => {
    if (open && existing) {
      const m = new Map<string, { file_name: string; mime_type?: string; parent_id: string | null }>();
      for (const s of existing) {
        m.set(s.google_drive_file_id, {
          file_name: s.file_name || s.google_drive_file_id,
          mime_type: s.mime_type || undefined,
          parent_id: s.google_drive_parent_id || null,
        });
      }
      setPicked(m);
      setStack([{ id: null, name: 'My Drive' }]);
      setSearch('');
    }
  }, [open, existing]);

  const { data, isLoading, isError, refetch } = useQuery<{ folders: DriveItem[]; files: DriveItem[] }>({
    queryKey: ['drive-items', parentId],
    queryFn: () => driveItems(parentId),
    enabled: open,
    retry: false,
  });

  const save = useMutation({
    mutationFn: () =>
      saveSyncFiles(
        [...picked.entries()].map(([file_id, meta]) => ({
          file_id,
          file_name: meta.file_name,
          mime_type: meta.mime_type,
          parent_id: meta.parent_id,
        })),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drive-selected'] });
      qc.invalidateQueries({ queryKey: ['drive-status'] });
      onClose();
    },
  });

  const q = search.trim().toLowerCase();
  const folders = useMemo(
    () => (data?.folders || []).filter((f) => !q || f.name.toLowerCase().includes(q)),
    [data, q],
  );
  const files = useMemo(
    () => (data?.files || []).filter((f) => !q || f.name.toLowerCase().includes(q)),
    [data, q],
  );

  if (!open) return null;

  const toggle = (f: DriveItem) => {
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(f.id)) next.delete(f.id);
      else next.set(f.id, { file_name: f.name, mime_type: f.mimeType, parent_id: parentId });
      return next;
    });
  };

  const selectAll = (checked: boolean) => {
    setPicked((prev) => {
      const next = new Map(prev);
      for (const f of files) {
        if (checked) next.set(f.id, { file_name: f.name, mime_type: f.mimeType, parent_id: parentId });
        else next.delete(f.id);
      }
      return next;
    });
  };

  const allChecked = files.length > 0 && files.every((f) => picked.has(f.id));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded shadow-lg w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold">Select files from Google Drive</h2>
          <button onClick={onClose} className="text-gray-500"><X size={18} /></button>
        </div>

        <div className="p-3 border-b space-y-2">
          <div className="flex items-center gap-1 text-sm flex-wrap">
            {stack.length > 1 && (
              <button onClick={() => setStack((s) => s.slice(0, -1))} className="border rounded px-2 py-1 flex items-center gap-1">
                <ArrowLeft size={14} /> Back
              </button>
            )}
            {stack.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-400">/</span>}
                <button
                  disabled={i === stack.length - 1}
                  onClick={() => setStack((s) => s.slice(0, i + 1))}
                  className={`px-1 ${i === stack.length - 1 ? 'font-semibold' : 'text-blue-600 underline'}`}
                >
                  {c.name}
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center border rounded px-2">
            <Search size={14} className="text-gray-400" />
            <input className="p-1.5 outline-none w-full text-sm" placeholder="Search files..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-2 min-h-[200px]">
          {isLoading && <p className="p-6 text-sm text-gray-500 text-center">Loading Google Drive...</p>}
          {isError && (
            <div className="p-6 text-center space-y-2">
              <p className="text-sm text-red-600">Unable to load Google Drive files.</p>
              <button onClick={() => refetch()} className="text-sm border rounded px-3 py-1">Retry</button>
            </div>
          )}
          {!isLoading && !isError && folders.length === 0 && files.length === 0 && (
            <p className="p-6 text-sm text-gray-500 text-center">No files found.</p>
          )}
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => { setStack((s) => [...s, { id: f.id, name: f.name }]); setSearch(''); }}
              className="w-full flex items-center gap-2 p-2 rounded hover:bg-gray-100 text-sm text-left"
            >
              <Folder size={16} className="text-amber-500 shrink-0" />
              <span className="truncate">{f.name}</span>
            </button>
          ))}
          {files.length > 0 && (
            <label className="flex items-center gap-2 p-2 text-xs text-gray-500 border-t mt-1">
              <input type="checkbox" checked={allChecked} onChange={(e) => selectAll(e.target.checked)} />
              Select all files in this folder
            </label>
          )}
          {files.map((f) => (
            <label key={f.id} className="flex items-start gap-2 p-2 rounded hover:bg-gray-100 text-sm cursor-pointer">
              <input type="checkbox" className="mt-1" checked={picked.has(f.id)} onChange={() => toggle(f)} />
              <FileText size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <span className="flex-1 min-w-0">
                <span className="block truncate">{f.name}</span>
                <span className="block text-xs text-gray-400">
                  {(f.mimeType || '').split('/').pop()} {fmtSize(f.size) && `· ${fmtSize(f.size)}`} {fmtDate(f.modifiedTime) && `· ${fmtDate(f.modifiedTime)}`}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className="p-4 border-t flex items-center justify-between gap-2">
          <p className="text-sm text-gray-600">Selected: {picked.size} file{picked.size === 1 ? '' : 's'}</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="border px-4 py-2 rounded text-sm">Cancel</button>
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            >
              {save.isPending ? 'Saving...' : `Select ${picked.size} file${picked.size === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
        {save.isError && <p className="px-4 pb-3 text-sm text-red-600">Failed to save selection.</p>}
      </div>
    </div>
  );
}
