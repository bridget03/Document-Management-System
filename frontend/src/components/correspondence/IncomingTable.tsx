import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Pencil, Trash2, MoreHorizontal, Star } from "lucide-react";
import Badge from "../ui/Badge";
import ActionMenu from "../ui/ActionMenu";
import { IconButton, MenuItem } from "../ui/Button";
import { useAuthStore } from "../../stores/authStore";
import {
  fmtDateVN,
  type CorrDoc,
} from "../../types/correspondence";
import type { CorrSortKey, SortOrder } from "./CorrespondenceTable";
import { ResizeHandle, useResizableColumns } from "./useResizableColumns";

interface Props {
  items: CorrDoc[];
  base: string;
  onDelete: (doc: CorrDoc) => void;
  sortBy: CorrSortKey;
  sortOrder: SortOrder;
  onSort: (key: CorrSortKey) => void;
}

/** Bảng công văn ĐẾN — cột: số, tiêu đề, loại (tên), đơn vị phát hành,
 *  đơn vị tiếp nhận, ngày phát hành, ngày tiếp nhận. Không có Tình trạng. */
const COL_WIDTHS: Record<string, number> = {
  docNo: 120,
  title: 340,
  type: 110,
  issuer: 220,
  receiver: 220,
  issueDate: 120,
  receivedDate: 120,
  actions: 60,
};
const COL_ORDER = Object.keys(COL_WIDTHS);
export default function IncomingTable({
  items,
  base,
  onDelete,
  sortBy,
  sortOrder,
  onSort,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const me = useAuthStore((s) => s.user);
  // Member read-only: chỉ admin hoặc chủ sở hữu (văn bản cũ) được sửa/xóa.
  const canWriteDoc = (d: CorrDoc) =>
    me?.role === "ADMIN" || (d.created_by != null && d.created_by === me?.id);
  const closeMenu = useCallback(() => {
    setOpenId(null);
    setAnchor(null);
  }, []);
  const openDoc = items.find((i) => i.id === openId) ?? null;
  const { widths, onResizeStart, resetColumn } = useResizableColumns(
    "corr-cols-incoming",
    COL_WIDTHS,
  );
  const minWidth = COL_ORDER.reduce((s, k) => s + (widths[k] ?? COL_WIDTHS[k]), 0);
  const sortableHeader = (label: string, key: CorrSortKey) => {
    const active = sortBy === key;
    const Icon = active ? (sortOrder === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <button
        type="button"
        className="-mx-2 inline-flex items-center gap-1 rounded px-2 py-1 text-left hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-1"
        onClick={() => onSort(key)}
        aria-label={`Sắp xếp theo ${label}${active ? (sortOrder === "asc" ? ", tăng dần" : ", giảm dần") : ""}`}
      >
        {label}
        <Icon size={14} aria-hidden="true" className={active ? "text-brand-700" : "text-gray-400"} />
      </button>
    );
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full table-fixed text-sm" style={{ minWidth }}>
        <colgroup>
          {COL_ORDER.map((k) => (
            <col key={k} style={{ width: widths[k] ?? COL_WIDTHS[k] }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-gray-50">
          <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="relative px-4 py-2.5 font-medium" aria-sort={sortBy === "document_number" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}>{sortableHeader("Số văn bản", "document_number")}<ResizeHandle onResizeStart={onResizeStart("docNo")} onReset={() => resetColumn("docNo")} /></th>
            <th className="relative px-4 py-2.5 font-medium">Tiêu đề<ResizeHandle onResizeStart={onResizeStart("title")} onReset={() => resetColumn("title")} /></th>
            <th className="relative px-4 py-2.5 font-medium" aria-sort={sortBy === "document_type" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}>{sortableHeader("Loại", "document_type")}<ResizeHandle onResizeStart={onResizeStart("type")} onReset={() => resetColumn("type")} /></th>
            <th className="relative px-4 py-2.5 font-medium" aria-sort={sortBy === "party" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}>{sortableHeader("Đơn vị phát hành", "party")}<ResizeHandle onResizeStart={onResizeStart("issuer")} onReset={() => resetColumn("issuer")} /></th>
            <th className="relative px-4 py-2.5 font-medium" aria-sort={sortBy === "signer" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}>{sortableHeader("Đơn vị tiếp nhận", "signer")}<ResizeHandle onResizeStart={onResizeStart("receiver")} onReset={() => resetColumn("receiver")} /></th>
            <th className="relative px-4 py-2.5 font-medium" aria-sort={sortBy === "issue_date" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}>{sortableHeader("Ngày phát hành", "issue_date")}<ResizeHandle onResizeStart={onResizeStart("issueDate")} onReset={() => resetColumn("issueDate")} /></th>
            <th className="relative px-4 py-2.5 font-medium" aria-sort={sortBy === "received_date" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}>{sortableHeader("Ngày tiếp nhận", "received_date")}<ResizeHandle onResizeStart={onResizeStart("receivedDate")} onReset={() => resetColumn("receivedDate")} /></th>
            <th className="relative px-4 py-2.5 text-right font-medium">Actions<ResizeHandle onResizeStart={onResizeStart("actions")} onReset={() => resetColumn("actions")} /></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((d) => (
            <tr key={d.id} className="transition-colors hover:bg-gray-50">
              <td className="whitespace-nowrap px-4 py-3">
                <span className="flex flex-wrap items-center gap-1.5">
                  <Link
                    to={`${base}/${d.id}`}
                    className="font-medium text-brand-700 underline hover:text-slate-600"
                  >
                    {d.document_number}
                  </Link>
                  {d.is_important && (
                    <Badge tone="danger">
                      <Star size={11} aria-hidden="true" /> Quan trọng
                    </Badge>
                  )}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600">
                <span className="block truncate" title={d.title || undefined}>
                  {d.title || "—"}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                {d.doc_type ? d.doc_type.name : "—"}
              </td>
              <td className="px-4 py-3 text-gray-600">
                <span className="block truncate" title={d.sender || undefined}>
                  {d.sender || "—"}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600">
                <span className="block truncate" title={d.signer || undefined}>
                  {d.signer || "—"}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                {fmtDateVN(d.issue_date)}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                {fmtDateVN(d.received_date)}
              </td>
              <td className="px-4 py-3 text-right">
                <IconButton
                  label={`Actions for ${d.document_number}`}
                  aria-expanded={openId === d.id}
                  aria-haspopup="menu"
                  onClick={(e) => {
                    if (openId === d.id) {
                      closeMenu();
                    } else {
                      setAnchor(e.currentTarget);
                      setOpenId(d.id);
                    }
                  }}
                >
                  <MoreHorizontal size={17} />
                </IconButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {openDoc && (
        <ActionMenu anchor={anchor} onClose={closeMenu}>
          <Link
            to={`${base}/${openDoc.id}`}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={closeMenu}
          >
            <Eye size={14} /> Chi tiết
          </Link>
          {canWriteDoc(openDoc) && (
            <Link
              to={`${base}/${openDoc.id}/edit`}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={closeMenu}
            >
              <Pencil size={14} /> Chỉnh sửa
            </Link>
          )}
          {canWriteDoc(openDoc) && (
            <MenuItem
              tone="danger"
              onClick={() => {
                const doc = openDoc;
                closeMenu();
                onDelete(doc);
              }}
            >
              <Trash2 size={14} /> Xóa
            </MenuItem>
          )}
        </ActionMenu>
      )}
    </div>
  );
}
