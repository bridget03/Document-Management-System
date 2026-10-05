import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  FolderInput,
  Pencil,
  Trash2,
  MoreHorizontal,
  Star,
} from "lucide-react";
import Badge from "../ui/Badge";
import ActionMenu from "../ui/ActionMenu";
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
  sortBy: CorrSortKey;
  sortOrder: SortOrder;
  onSort: (key: CorrSortKey) => void;
  onMoveToFolder: (doc: CorrDoc) => void;
}

export type CorrSortKey =
  | "document_number"
  | "document_type"
  | "party"
  | "signer"
  | "signed_date"
  | "issue_date"
  | "processing_status";
export type SortOrder = "asc" | "desc";

export default function CorrespondenceTable({
  items,
  dir,
  base,
  onDelete,
  sortBy,
  sortOrder,
  onSort,
  onMoveToFolder,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const cfg = DIRECTION_CONFIG[dir];
  const partyList = (d: CorrDoc) => splitPartyList(d[cfg.partyKey]);
  const closeMenu = useCallback(() => {
    setOpenId(null);
    setAnchor(null);
  }, []);
  const openDoc = items.find((i) => i.id === openId) ?? null;
  const sortableHeader = (label: string, key: CorrSortKey) => {
    const active = sortBy === key;
    const Icon = active
      ? sortOrder === "asc"
        ? ArrowUp
        : ArrowDown
      : ArrowUpDown;
    return (
      <button
        type="button"
        className="-mx-2 inline-flex items-center gap-1 rounded px-2 py-1 text-left hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-1"
        onClick={() => onSort(key)}
        aria-label={`Sắp xếp theo ${label}${active ? (sortOrder === "asc" ? ", tăng dần" : ", giảm dần") : ""}`}
      >
        {label}
        <Icon
          size={14}
          aria-hidden="true"
          className={active ? "text-brand-700" : "text-gray-400"}
        />
      </button>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
            <th
              className="px-4 py-2.5 font-medium"
              aria-sort={
                sortBy === "document_number"
                  ? sortOrder === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              {sortableHeader("Số văn bản", "document_number")}
            </th>
            <th
              className="px-4 py-2.5 font-medium"
              aria-sort={
                sortBy === "document_type"
                  ? sortOrder === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              {sortableHeader("Loại", "document_type")}
            </th>
            <th
              className="px-4 py-2.5 font-medium"
              aria-sort={
                sortBy === "party"
                  ? sortOrder === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              {sortableHeader(cfg.partyLabel.replace(" *", ""), "party")}
            </th>
            <th
              className="px-4 py-2.5 font-medium"
              aria-sort={
                sortBy === "signer"
                  ? sortOrder === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              {sortableHeader("Người ký", "signer")}
            </th>
            <th
              className="px-4 py-2.5 font-medium"
              aria-sort={
                sortBy === "signed_date"
                  ? sortOrder === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              {sortableHeader("Ngày ký", "signed_date")}
            </th>
            <th
              className="px-4 py-2.5 font-medium"
              aria-sort={
                sortBy === "issue_date"
                  ? sortOrder === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              {sortableHeader("Ngày phát hành", "issue_date")}
            </th>
            <th
              className="px-4 py-2.5 font-medium"
              aria-sort={
                sortBy === "processing_status"
                  ? sortOrder === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              {sortableHeader("Tình trạng", "processing_status")}
            </th>
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
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Link
                      to={`${base}/${d.id}`}
                      className="font-medium text-brand-700 underline  hover:text-slate-600 "
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
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                  {d.doc_type ? `${d.doc_type.code} · ${d.doc_type.name}` : "—"}
                </td>
                <td className="max-w-[260px] px-4 py-2.5 text-gray-600">
                  {(() => {
                    const list = partyList(d);
                    if (list.length === 0) return "—";
                    return (
                      <span className="flex flex-wrap items-center gap-1">
                        <span
                          className="max-w-[180px] truncate"
                          title={list[0]}
                        >
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
            );
          })}
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
          <Link
            to={`${base}/${openDoc.id}/edit`}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={closeMenu}
          >
            <Pencil size={14} /> Chỉnh sửa
          </Link>

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
        </ActionMenu>
      )}
    </div>
  );
}

export type { Direction };
