import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import Badge from "../ui/Badge";
import { IconButton, MenuItem } from "../ui/Button";
import {
  STATUS_CONFIG,
  fmtDateVN,
  splitPartyList,
  DIRECTION_CONFIG,
  type CorrDoc,
  type Direction,
} from "../../types/correspondence";

interface Props {
  items: CorrDoc[];
  dir: Direction;
  base: string;
  onDelete: (doc: CorrDoc) => void;
}

export default function CorrespondenceTable({
  items,
  dir,
  base,
  onDelete,
}: Props) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const cfg = DIRECTION_CONFIG[dir];
  const partyList = (d: CorrDoc) => splitPartyList(d[cfg.partyKey]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-2.5 font-medium">Số văn bản</th>
            <th className="px-4 py-2.5 font-medium">Loại</th>
            <th className="px-4 py-2.5 font-medium">
              {cfg.partyLabel.replace(" *", "")}
            </th>
            <th className="px-4 py-2.5 font-medium">Người ký</th>
            <th className="px-4 py-2.5 font-medium">Ngày ký</th>
            <th className="px-4 py-2.5 font-medium">Ngày phát hành</th>
            <th className="px-4 py-2.5 font-medium">Tình trạng</th>
            <th className="px-4 py-2.5 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((d) => {
            const st = STATUS_CONFIG[d.processing_status] || {
              label: d.processing_status,
              tone: "neutral" as const,
            };
            return (
              <tr key={d.id} className="transition-colors hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <Link
                    to={`${base}/${d.id}`}
                    className="font-medium text-brand-700 underline  hover:text-slate-600 "
                  >
                    {d.document_number}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                  {d.doc_type ? `${d.doc_type.code} · ${d.doc_type.name}` : "—"}
                </td>
                <td className="max-w-[260px] px-4 py-2.5 text-gray-600">
                  {(() => {
                    const list = partyList(d);
                    if (list.length === 0) return "—";
                    return (
                      <span className="flex flex-wrap items-center gap-1">
                        <span className="max-w-[180px] truncate" title={list[0]}>
                          {list[0]}
                        </span>
                        {list.length > 1 && (
                          <span
                            className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700"
                            title={list.slice(1).join("; ")}
                          >
                            +{list.length - 1}
                          </span>
                        )}
                      </span>
                    );
                  })()}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                  {d.signer || "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                  {fmtDateVN(d.signed_date)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                  {fmtDateVN(d.issue_date)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <Badge tone={st.tone}>{st.label}</Badge>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="relative inline-block">
                    <IconButton
                      label={`Actions for ${d.document_number}`}
                      aria-expanded={menuId === d.id}
                      onClick={() => setMenuId(menuId === d.id ? null : d.id)}
                    >
                      <MoreHorizontal size={17} />
                    </IconButton>
                    {menuId === d.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setMenuId(null)}
                        />
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
                          <MenuItem
                            tone="danger"
                            onClick={() => {
                              setMenuId(null);
                              onDelete(d);
                            }}
                          >
                            <Trash2 size={14} /> Xóa
                          </MenuItem>
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
