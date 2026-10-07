import { useMemo } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Inbox, Search, Send } from "lucide-react";
import type { Direction } from "../../../types/correspondence";
import type { CorrTreeStat } from "../../../services/correspondenceApi";

export const TREE_DIRECTIONS: { dir: Direction; label: string; Icon: typeof Inbox }[] = [
  { dir: "INCOMING", label: "Công văn đến", Icon: Inbox },
  { dir: "OUTGOING", label: "Công văn đi", Icon: Send },
  { dir: "INTERNAL", label: "Công văn nội bộ", Icon: FileText },
];

export interface TreeSelection {
  year: number | null;
  direction: Direction | null;
  month: number | null;
}

interface Props {
  items: CorrTreeStat[];
  selection: TreeSelection;
  expandedYears: Set<number>;
  expandedTypes: Set<string>;
  treeSearch: string;
  onTreeSearch: (v: string) => void;
  onToggleYear: (year: number) => void;
  onToggleType: (year: number, dir: Direction) => void;
  onSelect: (sel: TreeSelection) => void;
  totalCount: number;
  /** Khi vào từ sidebar Đến/Đi/Nội bộ: cây bắt đầu từ Năm, ẩn tầng Loại. */
  onlyDirection?: Direction | null;
  rootLabel?: string;
}

function matchesSearch(year: number, dirLabel: string, month: number, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  if (String(year).includes(s)) return true;
  if (dirLabel.toLowerCase().includes(s)) return true;
  if (`tháng ${month}`.includes(s) || String(month) === s) return true;
  return false;
}

export default function CorrespondenceTree({
  items, selection, expandedYears, expandedTypes,
  treeSearch, onTreeSearch, onToggleYear, onToggleType, onSelect, totalCount,
  onlyDirection = null, rootLabel = "Công văn",
}: Props) {
  const visibleDirs = onlyDirection ? TREE_DIRECTIONS.filter((t) => t.dir === onlyDirection) : TREE_DIRECTIONS;
  const years = useMemo(() => {
    const map = new Map<number, CorrTreeStat[]>();
    for (const it of items) {
      if (onlyDirection && it.direction !== onlyDirection) continue;
      if (!map.has(it.year)) map.set(it.year, []);
      map.get(it.year)!.push(it);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [items, onlyDirection]);

  const countFor = (list: CorrTreeStat[], dir?: Direction, month?: number) =>
    list.filter((i) => (!dir || i.direction === dir) && (!month || i.month === month))
      .reduce((s, i) => s + i.count, 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 px-1 pb-2">
        <FolderOpen size={16} className="shrink-0 text-brand-700" />
        <span className="text-sm font-semibold text-gray-900">{rootLabel}</span>
        <span className="ml-auto text-xs text-gray-400">{totalCount.toLocaleString("vi-VN")}</span>
      </div>
      <div className="mb-2 flex items-center gap-2 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 focus-within:border-brand-600">
        <Search size={14} className="shrink-0 text-gray-400" />
        <input
          value={treeSearch}
          onChange={(e) => onTreeSearch(e.target.value)}
          placeholder="Tìm trong cây..."
          aria-label="Tìm trong cây công văn"
          className="w-full bg-transparent text-xs outline-none placeholder:text-gray-400"
        />
      </div>
      <div role="tree" aria-label="Cây công văn theo năm" className="min-h-0 flex-1 space-y-0.5 overflow-auto">
        {years.length === 0 && (
          <p className="px-2 py-3 text-xs text-gray-500">Chưa có công văn có ngày phát hành.</p>
        )}
        {years.map(([year, list]) => {
          const expanded = expandedYears.has(year) || !!treeSearch.trim();
          const active = onlyDirection
            ? selection.year === year && !selection.month
            : selection.year === year && !selection.direction && !selection.month;
          const yCount = countFor(list);
          // Lọc tháng 0: API đã chỉ trả tháng có count > 0.
          const monthsByDir = (dir: Direction) =>
            list.filter((i) => i.direction === dir).sort((a, b) => a.month - b.month);
          // Chế độ 1 loại (sidebar Đến/Đi/Nội bộ): Năm -> Tháng trực tiếp.
          const flatMonths = onlyDirection ? monthsByDir(onlyDirection).filter((m) => {
            const lbl = visibleDirs[0]?.label ?? "";
            return matchesSearch(year, lbl, m.month, treeSearch);
          }) : [];
          return (
            <div key={year}>
              <div
                role="treeitem"
                aria-expanded={expanded}
                aria-selected={active}
                className={`group flex items-center rounded-md pr-1.5 ${active ? "bg-brand-50 font-medium text-brand-700" : "text-gray-700 hover:bg-gray-50"}`}
              >
                <button
                  type="button"
                  aria-label={expanded ? `Thu gọn năm ${year}` : `Mở rộng năm ${year}`}
                  onClick={() => onToggleYear(year)}
                  className="p-1.5 text-gray-400 hover:text-gray-700"
                >
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => onSelect(onlyDirection ? { year, direction: onlyDirection, month: null } : { year, direction: null, month: null })}
                  className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1.5 text-left text-[13px]"
                >
                  <Folder size={14} className="shrink-0 text-amber-500" />
                  <span className="truncate">{year}</span>
                  <span className="ml-auto pl-2 text-[11px] text-gray-400">{yCount}</span>
                </button>
              </div>
              {expanded && onlyDirection ? (
                <div role="group" className="ml-4 border-l border-gray-200 pl-1">
                  {flatMonths.map((m) => {
                    const mActive = selection.year === year && selection.month === m.month;
                    return (
                      <button
                        key={m.month}
                        type="button"
                        role="treeitem"
                        aria-selected={mActive}
                        onClick={() => onSelect({ year, direction: onlyDirection, month: m.month })}
                        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs ${mActive ? "bg-brand-50 font-semibold text-brand-700" : "text-gray-600 hover:bg-gray-50"}`}
                      >
                        <Folder size={13} className="shrink-0 text-amber-500" />
                        <span>Tháng {m.month}</span>
                        <span className="ml-auto text-[11px] text-gray-400">{m.count}</span>
                      </button>
                    );
                  })}
                </div>
              ) : expanded ? (
                <div role="group" className="ml-4 border-l border-gray-200 pl-1">
                  {visibleDirs.map(({ dir, label, Icon }) => {
                    const tkey = `${year}-${dir}`;
                    const texpanded = expandedTypes.has(tkey) || !!treeSearch.trim();
                    const tCount = countFor(list, dir);
                    if (tCount === 0) return null;
                    const tActive = selection.year === year && selection.direction === dir && !selection.month;
                    const months = monthsByDir(dir).filter((m) =>
                      matchesSearch(year, label, m.month, treeSearch),
                    );
                    // Nếu search không khớp tháng nào nhưng khớp năm/loại thì vẫn hiện loại.
                    const q = treeSearch.trim().toLowerCase();
                    const typeMatched = !q || String(year).includes(q) || label.toLowerCase().includes(q);
                    if (months.length === 0 && !typeMatched) return null;
                    return (
                      <div key={tkey}>
                        <div
                          role="treeitem"
                          aria-expanded={texpanded}
                          aria-selected={tActive}
                          className={`flex items-center rounded-md pr-1.5 ${tActive ? "bg-brand-50 font-medium text-brand-700" : "text-gray-700 hover:bg-gray-50"}`}
                        >
                          <button
                            type="button"
                            aria-label={texpanded ? `Thu gọn ${label} ${year}` : `Mở rộng ${label} ${year}`}
                            onClick={() => onToggleType(year, dir)}
                            className="p-1.5 text-gray-400 hover:text-gray-700"
                          >
                            {texpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelect({ year, direction: dir, month: null })}
                            className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1.5 text-left text-[13px]"
                          >
                            <Icon size={14} className="shrink-0 text-gray-500" />
                            <span className="truncate">{label}</span>
                            <span className="ml-auto pl-2 text-[11px] text-gray-400">{tCount}</span>
                          </button>
                        </div>
                        {texpanded && (
                          <div role="group" className="ml-4 border-l border-gray-200 pl-1">
                            {months.map((m) => {
                              const mActive =
                                selection.year === year && selection.direction === dir && selection.month === m.month;
                              return (
                                <button
                                  key={m.month}
                                  type="button"
                                  role="treeitem"
                                  aria-selected={mActive}
                                  onClick={() => onSelect({ year, direction: dir, month: m.month })}
                                  className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs ${mActive ? "bg-brand-50 font-semibold text-brand-700" : "text-gray-600 hover:bg-gray-50"}`}
                                >
                                  <Folder size={13} className="shrink-0 text-amber-500" />
                                  <span>Tháng {m.month}</span>
                                  <span className="ml-auto text-[11px] text-gray-400">{m.count}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
