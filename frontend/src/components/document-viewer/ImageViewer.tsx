import { useEffect, useRef, useState } from 'react';
import { Expand } from 'lucide-react';
import { fetchPreviewBlob } from '../../services/documentApi';

interface Props {
  docId: string;
  fileName: string;
}

export default function ImageViewer({ docId, fileName }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    let obj: string | null = null;
    fetchPreviewBlob(docId)
      .then((blob) => {
        if (!alive) return;
        obj = URL.createObjectURL(blob);
        setUrl(obj);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
      if (obj) URL.revokeObjectURL(obj);
    };
  }, [docId]);

  if (status === 'loading') return <p className="p-10 text-center text-sm text-gray-600">Loading document...</p>;
  if (status === 'error' || !url) return <p className="p-10 text-center text-sm text-red-600">Không thể đọc file.</p>;

  return (
    <div>
      <div className="flex justify-end p-2 border-b bg-gray-50">
        <button
          className="border px-2 py-1 rounded text-sm flex items-center gap-1"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void wrapRef.current?.requestFullscreen();
          }}
        >
          <Expand size={14} /> Fullscreen
        </button>
      </div>
      <div ref={wrapRef} className="flex items-center justify-center bg-gray-100 p-4 min-h-[40vh] [&:fullscreen]:bg-black">
        <img src={url} alt={fileName} className="max-w-full max-h-[70vh] object-contain [&:fullscreen]:max-h-screen" />
      </div>
    </div>
  );
}
