import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { fetchPreviewBuffer } from '../../services/documentApi';
import { MAX_PREVIEW_ROWS } from './preview';
import { SegmentButton } from '../ui/Button';

type Cell = string | number | boolean | null | undefined;

interface Props {
  docId: string;
}

function fmt(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'boolean') return cell ? 'TRUE' : 'FALSE';
  return String(cell);
}

export default function SpreadsheetViewer({ docId }: Props) {
  const [sheets, setSheets] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [rows, setRows] = useState<Cell[][]>([]);
  const [limited, setLimited] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    fetchPreviewBuffer(docId)
      .then((buf) => {
        if (!alive) return;
        const wb = XLSX.read(buf, { type: 'array' });
        setSheets(wb.SheetNames);
        loadSheet(wb, 0);
        setState('ready');

        function loadSheet(wbRef: XLSX.WorkBook, idx: number) {
          const ws = wbRef.Sheets[wbRef.SheetNames[idx]];
          // header:1 returns rows as arrays of cell values (untyped) -> cast to Cell
          const aoa = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, defval: null }) as Cell[][];
          const nonEmpty = aoa.filter((r) => r.some((c) => c !== null && c !== undefined && c !== ''));
          setEmpty(nonEmpty.length === 0);
          setLimited(nonEmpty.length > MAX_PREVIEW_ROWS);
          setRows(nonEmpty.slice(0, MAX_PREVIEW_ROWS));
          setActive(idx);
        }
      })
      .catch(() => alive && setState('error'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  const switchSheet = async (idx: number) => {
    try {
      const buf = await fetchPreviewBuffer(docId);
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[idx]];
      const aoa = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, defval: null }) as Cell[][];
      const nonEmpty = aoa.filter((r) => r.some((c) => c !== null && c !== undefined && c !== ''));
      setEmpty(nonEmpty.length === 0);
      setLimited(nonEmpty.length > MAX_PREVIEW_ROWS);
      setRows(nonEmpty.slice(0, MAX_PREVIEW_ROWS));
      setActive(idx);
    } catch {
      setState('error');
    }
  };

  if (state === 'loading') return <p className="p-10 text-center text-sm text-gray-600">Loading document...</p>;
  if (state === 'error') return <p className="p-10 text-center text-sm text-red-600">Không thể đọc file.</p>;

  return (
    <div className="p-4">
      <div className="flex gap-1 flex-wrap mb-3">
        {sheets.map((name, i) => (
          <SegmentButton
            key={name + i}
            onClick={() => void switchSheet(i)}
            aria-pressed={i === active}
            active={i === active}
            className="border px-3 py-1 text-sm"
          >
            {name}
          </SegmentButton>
        ))}
      </div>
      {empty && <p className="text-sm text-gray-500 py-6 text-center">Sheet trống.</p>}
      {!empty && (
        <>
          {limited && (
            <p className="text-xs text-amber-600 mb-2">
              Sheet quá lớn — chỉ hiển thị {MAX_PREVIEW_ROWS} dòng đầu. Hãy tải file để xem đầy đủ.
            </p>
          )}
          <div className="overflow-auto max-h-[65vh] border rounded">
            <table className="text-sm border-collapse">
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="odd:bg-white even:bg-gray-50">
                    {row.map((cell, ci) => (
                      <td key={ci} className={`border px-3 py-1 whitespace-nowrap ${ri === 0 ? 'font-semibold bg-gray-100' : ''}`}>
                        {fmt(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
