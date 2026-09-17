import { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, Expand } from 'lucide-react';
import { fetchPreviewBuffer } from '../../services/documentApi';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface Props {
  docId: string;
}

export default function PdfViewer({ docId }: Props) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [fitWidth, setFitWidth] = useState(false);
  const [containerWidth, setContainerWidth] = useState(800);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    fetchPreviewBuffer(docId)
      .then((buf) => {
        if (!alive) return;
        url = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }));
        setFileUrl(url);
      })
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [docId]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth - 32);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.current?.requestFullscreen();
  };

  if (status === 'error') {
    return <p className="p-10 text-center text-red-600 text-sm">Không thể đọc file.</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap p-2 border-b bg-gray-50 text-sm sticky top-0 z-10">
        <button className="border px-2 py-1 rounded disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} title="Previous page">
          <ChevronLeft size={16} />
        </button>
        <span>
          {page} / {numPages || '…'}
        </span>
        <button className="border px-2 py-1 rounded disabled:opacity-40" disabled={page >= numPages} onClick={() => setPage((p) => p + 1)} title="Next page">
          <ChevronRight size={16} />
        </button>
        <span className="mx-1 text-gray-300">|</span>
        <button className="border px-2 py-1 rounded" onClick={() => { setFitWidth(false); setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2))); }} title="Zoom out">
          <ZoomOut size={16} />
        </button>
        <span>{Math.round(scale * 100)}%</span>
        <button className="border px-2 py-1 rounded" onClick={() => { setFitWidth(false); setScale((s) => Math.min(3, +(s + 0.25).toFixed(2))); }} title="Zoom in">
          <ZoomIn size={16} />
        </button>
        <button
          className={`border px-2 py-1 rounded flex items-center gap-1 ${fitWidth ? 'bg-blue-100 border-blue-400' : ''}`}
          onClick={() => setFitWidth((f) => !f)}
          title="Fit width"
        >
          <Maximize size={16} /> Fit width
        </button>
        <button className="border px-2 py-1 rounded flex items-center gap-1" onClick={fullscreen} title="Fullscreen">
          <Expand size={16} /> Fullscreen
        </button>
      </div>
      <div ref={wrapRef} className="bg-gray-200 p-4 flex justify-center overflow-auto max-h-[75vh] [&:fullscreen]:max-h-none [&:fullscreen]:bg-gray-900">
        {status === 'loading' && !fileUrl && <p className="p-10 text-sm text-gray-600">Loading document...</p>}
        {fileUrl && (
          <Document
            file={fileUrl}
            loading={<p className="p-10 text-sm text-gray-600">Loading document...</p>}
            error={<p className="p-10 text-sm text-red-600">Không thể đọc file.</p>}
            onLoadSuccess={({ numPages: n }) => {
              setNumPages(n);
              setStatus('ready');
            }}
            onLoadError={() => setStatus('error')}
          >
            <Page
              pageNumber={page}
              scale={fitWidth ? 1 : scale}
              width={fitWidth ? containerWidth : undefined}
              renderTextLayer
              renderAnnotationLayer
            />
          </Document>
        )}
      </div>
    </div>
  );
}
