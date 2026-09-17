import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { fetchPreviewText } from '../../services/documentApi';
import { MAX_PREVIEW_ROWS } from './preview';

interface Props {
  docId: string;
}

export default function CsvViewer({ docId }: Props) {
  const [rows, setRows] = useState<string[][]>([]);
  const [limited, setLimited] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    fetchPreviewText(docId)
      .then((text) => {
        if (!alive) return;
        const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
        const all = (parsed.data as string[][]).filter((r) => r.length > 0);
        setLimited(all.length > MAX_PREVIEW_ROWS + 1);
        setRows(all.slice(0, MAX_PREVIEW_ROWS + 1));
        setState('ready');
      })
      .catch(() => alive && setState('error'));
    return () => {
      alive = false;
    };
  }, [docId]);

  if (state === 'loading') return <p className="p-10 text-center text-sm text-gray-600">Loading document...</p>;
  if (state === 'error' || rows.length === 0)
    return <p className="p-10 text-center text-sm text-red-600">Không thể đọc file.</p>;

  const [header, ...body] = rows;
  return (
    <div className="p-4">
      {limited && (
        <p className="text-xs text-amber-600 mb-2">
          File quá lớn — chỉ hiển thị {MAX_PREVIEW_ROWS} dòng đầu. Hãy tải file để xem đầy đủ.
        </p>
      )}
      <div className="overflow-auto max-h-[70vh] border rounded">
        <table className="text-sm border-collapse min-w-full">
          <thead className="sticky top-0 bg-gray-100">
            <tr>
              {header.map((h, i) => (
                <th key={i} className="border px-3 py-2 text-left font-semibold whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri} className="odd:bg-white even:bg-gray-50">
                {row.map((cell, ci) => (
                  <td key={ci} className="border px-3 py-1 whitespace-nowrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
