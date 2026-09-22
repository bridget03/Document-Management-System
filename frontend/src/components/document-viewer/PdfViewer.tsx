import { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, Expand } from 'lucide-react';
import { fetchPreviewBuffer } from '../../services/documentApi';
import { ToolButton } from '../ui/Button';
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
        <ToolButton disabled={page <= 1} onClick={() => setPage((p) => p - 1)} title="Previous page" aria-label="Previous page">
          <ChevronLeft size={16} />
        </ToolButton>
        <span>
          {page} / {numPages || '…'}
        </span>
        <ToolButton disabled={page >= numPages} onClick={() => setPage((p) => p + 1)} title="Next page" aria-label="Next page">
          <ChevronRight size={16} />
        </ToolButton>
        <span className="mx-1 text-gray-300">|</span>
        <ToolButton onClick={() => { setFitWidth(false); setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2))); }} title="Zoom out" aria-label="Zoom out">
          <ZoomOut size={16} />
        </ToolButton>
        <span>{Math.round(scale * 100)}%</span>
        <ToolButton onClick={() => { setFitWidth(false); setScale((s) => Math.min(3, +(s + 0.25).toFixed(2))); }} title="Zoom in" aria-label="Zoom in">
          <ZoomIn size={16} />
        </ToolButton>
        <ToolButton
          active={fitWidth}
          onClick={() => setFitWidth((f) => !f)}
          title="Fit width"
        >
          <Maximize size={16} /> Fit width
        </ToolButton>
        <ToolButton onClick={fullscreen} title="Fullscreen">
          <Expand size={16} /> Fullscreen
        </ToolButton>
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
