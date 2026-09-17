import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import Badge from '../ui/Badge';
import { STATUS_CONFIG, fmtDateVN, type CorrDoc, type Direction } from '../../types/correspondence';

interface Props {
  items: CorrDoc[];
  dir: Direction;
  base: string;
  onDelete: (doc: CorrDoc) => void;
}

export default function CorrespondenceTable({ items, dir, base, onDelete }: Props) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const party = (d: CorrDoc) => (dir === 'OUTGOING' ? d.recipient : d.sender) || '—';

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-2.5 font-medium">Số văn bản</th>
            <th className="px-4 py-2.5 font-medium">Loại</th>
            <th className="px-4 py-2.5 font-medium">{dir === 'OUTGOING' ? 'Nơi nhận' : 'Nơi gửi'}</th>
            <th className="px-4 py-2.5 font-medium">Người ký</th>
            <th className="px-4 py-2.5 font-medium">Ngày ký</th>
            <th className="px-4 py-2.5 font-medium">Ngày phát hành</th>
            <th className="px-4 py-2.5 font-medium">Tình trạng</th>
            <th className="px-4 py-2.5 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((d) => {
            const st = STATUS_CONFIG[d.processing_status] || { label: d.processing_status, tone: 'neutral' as const };
            return (
              <tr key={d.id} className="transition-colors hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <Link to={`${base}/${d.id}`} className="font-medium text-brand-700 hover:text-brand-800">
                    {d.document_number}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{d.doc_type ? `${d.doc_type.code} · ${d.doc_type.name}` : '—'}</td>
                <td className="max-w-[220px] truncate px-4 py-2.5 text-gray-600">{party(d)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{d.signer || '—'}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{fmtDateVN(d.signed_date)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{fmtDateVN(d.issue_date)}</td>
                <td className="whitespace-nowrap px-4 py-2.5"><Badge tone={st.tone}>{st.label}</Badge></td>
                <td className="px-4 py-2.5 text-right">
                  <div className="relative inline-block">
                    <button
                      onClick={() => setMenuId(menuId === d.id ? null : d.id)}
                      className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                      aria-label={`Actions for ${d.document_number}`}
                      aria-expanded={menuId === d.id}
                    >
                      <MoreHorizontal size={17} />
                    </button>
                    {menuId === d.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                        <div className="absolute right-0 z-20 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-card">
                          <Link
                            to={`${base}/${d.id}`}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setMenuId(null)}
                          >
                            <Eye size={14} /> Chi tiết
                          </Link>
                          <Link
                            to={`${base}/${d.id}/edit`}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setMenuId(null)}
                          >
                            <Pencil size={14} /> Chỉnh sửa
                          </Link>
                          <button
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            onClick={() => { setMenuId(null); onDelete(d); }}
                          >
                            <Trash2 size={14} /> Xóa
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export type { Direction };
