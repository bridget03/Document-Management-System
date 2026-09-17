import { useEffect, useState } from 'react';
import mammoth from 'mammoth';
import { fetchPreviewBuffer } from '../../services/documentApi';

interface Props {
  docId: string;
}

export default function DocxViewer({ docId }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchPreviewBuffer(docId)
      .then((buf) => mammoth.convertToHtml({ arrayBuffer: buf }))
      .then((result) => {
        if (alive) setHtml(result.value);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [docId]);

  if (error || (html !== null && html.trim() === '')) {
    return (
      <div className="p-10 text-center text-sm space-y-2">
        <p className="text-gray-600">File này chưa hỗ trợ xem trực tiếp.</p>
        <p className="text-gray-500">Vui lòng tải file để xem đầy đủ.</p>
      </div>
    );
  }
  if (html === null) return <p className="p-10 text-center text-sm text-gray-600">Loading document...</p>;

  // Mammoth generates HTML itself (no author scripts/styles pass through),
  // so rendering its output is safe. Read-only: no editing controls.
  return (
    <div className="p-4">
      <div
        className="prose max-w-none bg-white border rounded p-6 max-h-[70vh] overflow-auto text-sm leading-relaxed [&_h1]:text-xl [&_h1]:font-bold [&_h1]:my-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:my-2 [&_h3]:font-bold [&_h3]:my-2 [&_p]:my-2 [&_table]:border-collapse [&_table]:my-3 [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-gray-100 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
