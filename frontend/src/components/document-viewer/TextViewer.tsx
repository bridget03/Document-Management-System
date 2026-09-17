import { useEffect, useState } from 'react';
import { fetchPreviewText } from '../../services/documentApi';

const MAX_CHARS = 200_000;

interface Props {
  docId: string;
}

export default function TextViewer({ docId }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchPreviewText(docId)
      .then((t) => {
        if (!alive) return;
        setTruncated(t.length > MAX_CHARS);
        setText(t.slice(0, MAX_CHARS));
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [docId]);

  if (error) return <p className="p-10 text-center text-sm text-red-600">Không thể đọc file.</p>;
  if (text === null) return <p className="p-10 text-center text-sm text-gray-600">Loading document...</p>;

  // React escapes text content by default: embedded HTML/JS is never executed.
  return (
    <div className="p-4">
      {truncated && (
        <p className="text-xs text-amber-600 mb-2">
          File quá lớn — chỉ hiển thị {MAX_CHARS.toLocaleString()} ký tự đầu. Hãy tải file để xem đầy đủ.
        </p>
      )}
      <pre className="font-mono text-sm whitespace-pre-wrap break-words bg-gray-50 border rounded p-4 max-h-[70vh] overflow-auto">
        {text}
      </pre>
    </div>
  );
}
