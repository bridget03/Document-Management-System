import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, Folder, FolderPlus, Menu, Plus, RefreshCw,
  Search, SlidersHorizontal, Trash2, Upload, X,
} from "lucide-react";
import {
  corrCreateFolder, corrDelete, corrDeleteFolder, corrFolders, corrList,
  corrMoveToFolder, corrTreeStats, listDocTypes,
} from "../services/correspondenceApi";
import { Card, TableSkeleton } from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import Button, { IconButton, LinkButton } from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import { Select } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";
import CorrespondenceTree, { TREE_DIRECTIONS, type TreeSelection } from "../components/correspondence/tree/CorrespondenceTree";
import CorrespondenceTable, { type CorrSortKey, type SortOrder } from "../components/correspondence/CorrespondenceTable";
import IncomingTable from "../components/correspondence/IncomingTable";
import OutgoingTable from "../components/correspondence/OutgoingTable";
import ExcelImportModal from "../components/correspondence/ExcelImportModal";
import { DIRECTION_CONFIG, STATUS_OPTIONS, type CorrDoc, type Direction } from "../types/correspondence";

const DEBOUNCE_MS = 400;
const TYPE_LABEL: Record<Direction, string> = {
  INCOMING: "Công văn đến",
  OUTGOING: "Công văn đi",
  INTERNAL: "Công văn nội bộ",
};
const API_BASE: Record<Direction, string> = {
  INCOMING: "/correspondence/incoming",
  OUTGOING: "/correspondence/outgoing",
  INTERNAL: "/correspondence/internal",
};

function monthRange(year: number, month: number | null): { date_from: string; date_to: string } {
  if (month) {
    const last = new Date(year, month, 0).getDate();
    const mm = String(month).padStart(2, "0");
    return { date_from: `${year}-${mm}-01`, date_to: `${year}-${mm}-${last}` };
  }
  return { date_from: `${year}-01-01`, date_to: `${year}-12-31` };
}

function parseSelection(params: URLSearchParams): TreeSelection {
  const y = Number(params.get("year"));
  const d = (params.get("direction") || "").toUpperCase() as Direction;
  const m = Number(params.get("month"));
  return {
    year: Number.isFinite(y) && y > 1900 && y < 3000 ? y : null,
    direction: d === "INCOMING" || d === "OUTGOING" || d === "INTERNAL" ? d : null,
    month: Number.isFinite(m) && m >= 1 && m <= 12 ? m : null,
  };
}

interface FolderItem {
  id: string;
  name: string;
  parent_id: string | null;
  item_count: number;
}

function PersonalFolderTree({ folders, parentId, selectedId, onSelect, onCreateChild, onDelete }: {
  folders: FolderItem[]; parentId: string | null; selectedId: string | null;
  onSelect: (id: string) => void; onCreateChild: (id: string) => void; onDelete: (id: string) => void;
}) {
  return (
    <>
      {folders.filter((f) => f.parent_id === parentId).map((f) => (
        <div key={f.id} className="ml-3 border-l border-gray-200 pl-2">
          <div className={`group flex items-center rounded-md ${selectedId === f.id ? "bg-brand-50" : "hover:bg-gray-50"}`}>
            <button
              type="button"
              onClick={() => onSelect(f.id)}
              className={`flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-xs font-medium ${selectedId === f.id ? "text-brand-700" : "text-gray-700"}`}
            >
              <Folder size={14} className="shrink-0" />
              <span className="truncate">{f.name}</span>
              <span className="ml-auto text-gray-400">{f.item_count}</span>
            </button>
            <button type="button" className="p-1.5 text-gray-400 hover:text-brand-700" aria-label={`Tạo thư mục con trong ${f.name}`} onClick={() => onCreateChild(f.id)}>
              <FolderPlus size={14} />
            </button>
            <button type="button" className="p-1.5 text-gray-400 hover:text-red-600" aria-label={`Xóa thư mục ${f.name}`} onClick={() => onDelete(f.id)}>
              <Trash2 size={13} />
            </button>
          </div>
          <PersonalFolderTree folders={folders} parentId={f.id} selectedId={selectedId} onSelect={onSelect} onCreateChild={onCreateChild} onDelete={onDelete} />
        </div>
      ))}
    </>
  );
}

export default function CorrespondenceExplorer({ fixedDirection = null }: { fixedDirection?: Direction | null }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const { toast } = useToast();

  // ---- Tree state ----
  const [selection, setSelection] = useState<TreeSelection>(() => {
    const init = parseSelection(searchParams);
    return fixedDirection ? { ...init, direction: fixedDirection } : init;
  });
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [treeSearch, setTreeSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ---- Doc list state (reuse CorrespondenceList) ----
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeId, setTypeId] = useState("");
  const [signer, setSigner] = useState("");
  const [status, setStatus] = useState("");
  const [scope, setScope] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<CorrSortKey>("issue_date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [del, setDel] = useState<CorrDoc | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(() => searchParams.get("folder"));
  const [folderName, setFolderName] = useState("");
  const [folderParentId, setFolderParentId] = useState<string | null>(null);
  const [folderCreateOpen, setFolderCreateOpen] = useState(false);
  const [moveDoc, setMoveDoc] = useState<CorrDoc | null>(null);

  const direction: Direction | null = fixedDirection ?? selection.direction;
  const apiDir = direction ? DIRECTION_CONFIG[direction].api : null;
  const base = direction ? API_BASE[direction] : "/correspondence/incoming";
  const dirLabel = direction ? DIRECTION_CONFIG[direction].short : "công văn";

  // ---- Tree stats (1 request, theo issue_date, tôn trọng scope) ----
  const { data: treeData, isLoading: treeLoading, isError: treeError, refetch: refetchTree } = useQuery({
    queryKey: ["corr-tree", scope],
    queryFn: () => corrTreeStats(scope),
  });
  const treeItems = treeData?.items ?? [];
  const visibleItems = fixedDirection ? treeItems.filter((i) => i.direction === fixedDirection) : treeItems;
  const totalCount = useMemo(() => visibleItems.reduce((s, i) => s + i.count, 0), [visibleItems]);

  // Default: năm mới nhất -> loại (sidebar khóa sẵn hoặc INCOMING) -> tháng hiện tại (fallback tháng gần nhất).
  useEffect(() => {
    if (treeLoading || treeItems.length === 0) return;
    if (selection.year && direction) return;
    const pool = fixedDirection ? treeItems.filter((i) => i.direction === fixedDirection) : treeItems;
    if (pool.length === 0) return;
    const years = [...new Set(pool.map((i) => i.year))].sort((a, b) => b - a);
    const y = years[0];
    const dirs = TREE_DIRECTIONS.map((t) => t.dir).filter((d) => pool.some((i) => i.year === y && i.direction === d));
    const d = fixedDirection ?? (dirs.includes("INCOMING") ? "INCOMING" : dirs[0]);
    const months = treeItems.filter((i) => i.year === y && i.direction === d).map((i) => i.month).sort((a, b) => a - b);
    const cur = new Date().getMonth() + 1;
    const m = months.includes(cur) ? cur : months[months.length - 1] ?? null;
    const next = { year: y, direction: d, month: m };
    setSelection(next);
    setExpandedYears(new Set([y]));
    setExpandedTypes(new Set([`${y}-${d}`]));
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("year", String(y)); p.set("direction", d);
      if (m) p.set("month", String(m)); else p.delete("month");
      return p;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeLoading, treeItems.length]);

  // Sync khi Back/Forward. Khi sidebar đã khóa loại thì bỏ qua direction trên URL.
  useEffect(() => {
    const fromUrl = parseSelection(searchParams);
    const locked: TreeSelection = fixedDirection ? { ...fromUrl, direction: fixedDirection } : fromUrl;
    const f = searchParams.get("folder");
    if (JSON.stringify(locked) !== JSON.stringify(selection)) {
      setSelection(locked);
      setPage(1);
      if (locked.year) setExpandedYears((s) => new Set(s).add(locked.year!));
      if (locked.year && locked.direction) setExpandedTypes((s) => new Set(s).add(`${locked.year}-${locked.direction}`));
    }
    if (f !== folderId) setFolderId(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => { setSearchQuery(searchInput.trim()); setPage(1); }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const selectTree = (sel: TreeSelection) => {
    // Sidebar đã khóa loại -> ép direction. Click năm -> giữ loại hiện tại.
    const next: TreeSelection = fixedDirection
      ? { year: sel.year, direction: fixedDirection, month: sel.month }
      : !sel.direction && sel.year
        ? { year: sel.year, direction: direction ?? "INCOMING", month: null }
        : sel;
    setSelection(next);
    setPage(1);
    setFolderId(null);
    if (next.year) setExpandedYears((s) => new Set(s).add(next.year!));
    if (next.year && next.direction) setExpandedTypes((s) => new Set(s).add(`${next.year}-${next.direction}`));
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next.year) p.set("year", String(next.year)); else p.delete("year");
      if (next.direction) p.set("direction", next.direction); else p.delete("direction");
      if (next.month) p.set("month", String(next.month)); else p.delete("month");
      p.delete("folder");
      return p;
    }, { replace: true });
    setSidebarOpen(false);
  };

  const toggleYear = (y: number) =>
    setExpandedYears((s) => { const n = new Set(s); if (n.has(y)) n.delete(y); else n.add(y); return n; });
  const toggleType = (y: number, d: Direction) =>
    setExpandedTypes((s) => { const k = `${y}-${d}`; const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  // ---- Personal folders (giữ song song, theo direction đang chọn) ----
  const { data: folders = [] } = useQuery<Array<{ id: string; name: string; parent_id: string | null; item_count: number }>>({
    queryKey: ["corr-folders", direction],
    queryFn: () => corrFolders(direction!),
    enabled: !!direction,
  });
  const activeFolder = folders.find((f) => f.id === folderId) ?? null;
  const selectFolder = (id: string | null) => {
    setFolderId(id); setPage(1);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (id) p.set("folder", id); else p.delete("folder");
      return p;
    }, { replace: true });
  };

  const { data: types } = useQuery({
    queryKey: ["corr-types"],
    queryFn: () => listDocTypes(),
  });

  // ---- Doc list theo node thời gian ----
  const range = selection.year && selection.direction ? monthRange(selection.year, selection.month) : null;
  const filterCount = [typeId, signer, status, scope !== "all" ? scope : ""].filter(Boolean).length;
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["corr", direction, selection.year, selection.month, searchQuery, typeId, signer, status, scope, folderId, sortBy, sortOrder, page],
    queryFn: () => corrList(apiDir!, {
      q: searchQuery || undefined,
      type_id: typeId || undefined,
      signer: signer || undefined,
      status: status || undefined,
      scope: scope !== "all" ? scope : undefined,
      folder_id: folderId || undefined,
      date_from: range?.date_from,
      date_to: range?.date_to,
      sort_by: sortBy, sort_order: sortOrder, page, page_size: 20,
    }),
    enabled: !!apiDir && !!range,
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (id: string) => corrDelete(apiDir!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corr", direction] });
      qc.invalidateQueries({ queryKey: ["corr-tree"] });
      setDel(null);
      toast("success", "Đã xóa công văn.");
    },
    onError: () => toast("error", "Không xóa được công văn."),
  });
  const createFolder = useMutation({
    mutationFn: () => corrCreateFolder(folderName, direction!, folderParentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corr-folders", direction] });
      setFolderName(""); setFolderParentId(null); setFolderCreateOpen(false);
      toast("success", "Đã tạo thư mục.");
    },
    onError: () => toast("error", "Không tạo được thư mục."),
  });
  const deleteFolder = useMutation({
    mutationFn: (id: string) => corrDeleteFolder(id),
    onSuccess: (_d, deletedId) => {
      if (folderId === deletedId) selectFolder(null);
      qc.invalidateQueries({ queryKey: ["corr-folders", direction] });
      qc.invalidateQueries({ queryKey: ["corr", direction] });
      toast("success", "Đã xóa thư mục. Công văn vẫn được giữ lại.");
    },
    onError: () => toast("error", "Không xóa được thư mục."),
  });
  const moveToFolder = useMutation({
    mutationFn: (targetId: string) => corrMoveToFolder(targetId, [moveDoc!.id]),
    onSuccess: () => {
      setMoveDoc(null);
      qc.invalidateQueries({ queryKey: ["corr-folders", direction] });
      qc.invalidateQueries({ queryKey: ["corr", direction] });
      toast("success", "Đã chuyển công văn vào thư mục.");
    },
    onError: () => toast("error", "Không chuyển được công văn."),
  });

  const clearAll = () => { setSearchInput(""); setTypeId(""); setSigner(""); setStatus(""); setScope("all"); setPage(1); };
  const handleSort = (key: CorrSortKey) => {
    if (key === sortBy) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortOrder("asc"); }
    setPage(1);
  };

  const pageTitle = fixedDirection ? TYPE_LABEL[fixedDirection] : "Công văn";
  const pageSubtitle = fixedDirection
    ? "Duyệt theo Năm → Tháng (ngày phát hành)."
    : "Duyệt theo Năm → Loại → Tháng (ngày phát hành).";
  const title = selection.month && direction
    ? `${TYPE_LABEL[direction]} — Tháng ${selection.month}/${selection.year}`
    : selection.year && direction
      ? `${TYPE_LABEL[direction]} — Năm ${selection.year}`
      : pageTitle;
  const breadcrumb = fixedDirection
    ? [TYPE_LABEL[fixedDirection],
      ...(selection.year ? [String(selection.year)] : []),
      ...(selection.month ? [`Tháng ${selection.month}`] : []),
    ].join(" / ")
    : ["Công văn",
      ...(selection.year ? [String(selection.year)] : []),
      ...(direction ? [TYPE_LABEL[direction]] : []),
      ...(selection.month ? [`Tháng ${selection.month}`] : []),
    ].join(" / ");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="lg:hidden">
            <Button size="sm" onClick={() => setSidebarOpen((o) => !o)} aria-label="Mở cây công văn">
              <Menu size={15} /> Cây
            </Button>
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{pageTitle}</h1>
            <p className="mt-0.5 text-sm text-gray-500">{pageSubtitle}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => direction && setImportOpen(true)} disabled={!direction}>
            <Upload size={15} /> Nhập từ Excel
          </Button>
          {direction && (
            <Link
              to={folderId ? `${base}/new?folder=${encodeURIComponent(folderId)}` : `${base}/new`}
              title={activeFolder ? `Tạo công văn trong thư mục "${activeFolder.name}"` : "Tạo công văn mới"}
            >
              <Button variant="primary">
                <Plus size={15} /> {activeFolder ? `Thêm vào "${activeFolder.name}"` : "Thêm công văn"}
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Sidebar cây 280-320px */}
        <aside className={`${sidebarOpen ? "block" : "hidden"} w-full shrink-0 lg:block lg:w-[300px]`}>
          <Card className="space-y-3 p-3">
            {treeLoading ? (
              <p className="px-2 py-3 text-xs text-gray-500">Đang tải cây...</p>
            ) : treeError ? (
              <div className="px-2 py-3 text-center">
                <p className="text-xs font-medium text-gray-700">Không tải được cây.</p>
                <Button size="sm" className="mt-2" onClick={() => refetchTree()}>Thử lại</Button>
              </div>
            ) : (
              <CorrespondenceTree
                items={treeItems}
                selection={selection}
                expandedYears={expandedYears}
                expandedTypes={expandedTypes}
                treeSearch={treeSearch}
                onTreeSearch={setTreeSearch}
                onToggleYear={toggleYear}
                onToggleType={toggleType}
                onSelect={selectTree}
                totalCount={totalCount}
                onlyDirection={fixedDirection}
                rootLabel={fixedDirection ? TYPE_LABEL[fixedDirection] : "Công văn"}
              />
            )}
          </Card>
          {direction && (
            <Card className="mt-3 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-800">Thư mục của tôi ({TYPE_LABEL[direction]})</p>
                <Button size="sm" onClick={() => { setFolderParentId(null); setFolderCreateOpen(true); }}>
                  <FolderPlus size={14} /> Tạo thư mục
                </Button>
              </div>
              <div className="space-y-1">
                <Button size="sm" variant={folderId === null ? "primary" : "secondary"} onClick={() => selectFolder(null)}>
                  Tất cả {TYPE_LABEL[direction].toLowerCase()}
                </Button>
                <PersonalFolderTree
                  folders={folders}
                  parentId={null}
                  selectedId={folderId}
                  onSelect={selectFolder}
                  onCreateChild={(id) => { setFolderParentId(id); setFolderCreateOpen(true); }}
                  onDelete={(id) => deleteFolder.mutate(id)}
                />
              </div>
            </Card>
          )}
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-4">
          <Card className="space-y-1 p-4">
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500">{breadcrumb}{range ? ` · ${range.date_from} → ${range.date_to}` : ""}</p>
          </Card>

          {!direction || !range ? (
            <Card className="px-6 py-10 text-center">
              <p className="font-semibold text-gray-900">
                {fixedDirection ? "Chọn năm / tháng trong cây" : "Chọn năm / loại / tháng trong cây"}
              </p>
              <p className="mt-1 text-sm text-gray-500">{pageSubtitle}</p>
            </Card>
          ) : (
            <>
              <Card className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 focus-within:border-brand-600">
                    <Search size={16} className="shrink-0 text-gray-400" />
                    <input
                      className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                      placeholder="Tìm số văn bản, nơi nhận/gửi, người ký..."
                      aria-label={`Tìm văn bản ${dirLabel}`}
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                    />
                    {searchInput && (
                      <IconButton label="Xóa tìm kiếm" iconSize="sm" onClick={() => setSearchInput("")}>
                        <X size={15} />
                      </IconButton>
                    )}
                  </div>
                  <Button onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
                    <SlidersHorizontal size={15} /> Lọc
                    {filterCount > 0 && <Badge tone="brand" className="ml-1">{filterCount}</Badge>}
                  </Button>
                  <Select value={scope} onChange={(e) => { setScope(e.target.value); setPage(1); qc.invalidateQueries({ queryKey: ["corr-tree"] }); }} className="w-auto" aria-label="Phạm vi">
                    <option value="all">Tất cả</option>
                    <option value="mine">Của tôi</option>
                    <option value="department">Phòng tôi</option>
                  </Select>
                  <IconButton label="Tải lại" onClick={() => { refetch(); refetchTree(); }}>
                    <RefreshCw size={15} />
                  </IconButton>
                </div>
                {showFilters && (
                  <div className="grid grid-cols-1 gap-2 border-t border-gray-100 pt-3 sm:grid-cols-3">
                    <Select value={typeId} onChange={(e) => { setTypeId(e.target.value); setPage(1); }} aria-label="Lọc loại văn bản">
                      <option value="">Tất cả loại</option>
                      {(types || []).map((t: { id: string; code: string; name: string }) => (
                        <option key={t.id} value={t.id}>{t.code} · {t.name}</option>
                      ))}
                    </Select>
                    <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Lọc tình trạng">
                      <option value="">Tất cả tình trạng</option>
                      {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                    <div className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2">
                      <Search size={14} className="shrink-0 text-gray-400" />
                      <input
                        className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                        placeholder="Người ký..." aria-label="Lọc người ký" value={signer}
                        onChange={(e) => { setSigner(e.target.value); setPage(1); }}
                      />
                    </div>
                  </div>
                )}
                {(filterCount > 0 || searchQuery) && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{filterCount} bộ lọc đang dùng</span>
                    <LinkButton onClick={clearAll}>Xóa bộ lọc</LinkButton>
                  </div>
                )}
              </Card>

              {isError ? (
                <Card className="px-6 py-10 text-center">
                  <p className="font-semibold text-gray-900">Không tải được danh sách</p>
                  <Button size="sm" className="mt-3" onClick={() => refetch()}>Thử lại</Button>
                </Card>
              ) : isLoading && !data ? (
                <TableSkeleton rows={6} cols={6} />
              ) : (data?.items.length || 0) === 0 && !isFetching ? (
                <EmptyState
                  title={searchQuery || filterCount > 0 ? "Không tìm thấy văn bản" : "Chưa có công văn"}
                  description={
                    searchQuery || filterCount > 0
                      ? "Hãy thử thay đổi từ khóa hoặc bộ lọc."
                      : selection.month
                        ? `Không có ${TYPE_LABEL[direction!].toLowerCase()} trong tháng ${selection.month}/${selection.year}.`
                        : `Không có ${TYPE_LABEL[direction!].toLowerCase()} trong năm ${selection.year}.`
                  }
                  actionLabel={searchQuery || filterCount > 0 ? "Xóa bộ lọc" : "Thêm văn bản"}
                  onAction={searchQuery || filterCount > 0 ? clearAll : undefined}
                />
              ) : (
                <Card className="overflow-hidden">
                  {isFetching && <p className="border-b border-gray-100 px-4 py-1.5 text-xs text-gray-400">Đang cập nhật…</p>}
                  {direction === "INCOMING" ? (
                    <IncomingTable items={data?.items || []} base={base} onDelete={(d) => setDel(d)} sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} onMoveToFolder={setMoveDoc} />
                  ) : direction === "OUTGOING" ? (
                    <OutgoingTable items={data?.items || []} base={base} onDelete={(d) => setDel(d)} sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} onMoveToFolder={setMoveDoc} />
                  ) : (
                    <CorrespondenceTable items={data?.items || []} dir={direction!} base={base} onDelete={(d) => setDel(d)} sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} onMoveToFolder={setMoveDoc} />
                  )}
                  <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2.5 text-sm">
                    <span className="text-gray-500">Trang {data?.page} / {data?.total_pages} · {data?.total} văn bản</span>
                    <span className="flex gap-1.5">
                      <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Trang trước"><ChevronLeft size={15} /></Button>
                      <Button size="sm" disabled={!data || page >= (data.total_pages || 1)} onClick={() => setPage((p) => p + 1)} aria-label="Trang sau"><ChevronRight size={15} /></Button>
                    </span>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      <Modal open={del !== null} onClose={() => setDel(null)} title="Xóa văn bản?"
        footer={<><Button onClick={() => setDel(null)}>Hủy</Button><Button variant="primary" loading={remove.isPending} onClick={() => del && remove.mutate(del.id)}>Xóa</Button></>}>
        <p className="text-sm text-gray-600">Bạn có chắc chắn muốn xóa công văn “{del?.document_number}”? Hành động này không thể hoàn tác. Tệp đính kèm gốc vẫn được giữ lại.</p>
      </Modal>
      <Modal open={folderCreateOpen} onClose={() => setFolderCreateOpen(false)} title={folderParentId ? "Tạo thư mục con" : "Tạo thư mục công văn"}
        footer={<><Button onClick={() => setFolderCreateOpen(false)}>Hủy</Button><Button variant="primary" loading={createFolder.isPending} disabled={!folderName.trim()} onClick={() => createFolder.mutate()}>Tạo thư mục</Button></>}>
        <label className="block text-sm font-medium text-gray-700" htmlFor="folder-name">Tên thư mục</label>
        <input id="folder-name" autoFocus value={folderName} onChange={(e) => setFolderName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && folderName.trim()) createFolder.mutate(); }} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-600" placeholder="Ví dụ: Hồ sơ dự án A" />
      </Modal>
      <Modal open={moveDoc !== null} onClose={() => setMoveDoc(null)} title="Chuyển vào thư mục" footer={<Button onClick={() => setMoveDoc(null)}>Hủy</Button>}>
        <p className="mb-3 text-sm text-gray-600">Chọn thư mục cho công văn “{moveDoc?.document_number}”.</p>
        {folders.length === 0 ? <p className="text-sm text-gray-500">Hãy tạo thư mục trước.</p> : <div className="grid gap-2">{folders.map((folder) => <Button key={folder.id} className="justify-start" loading={moveToFolder.isPending} onClick={() => moveToFolder.mutate(folder.id)}><Folder size={15} /> {folder.name}</Button>)}</div>}
      </Modal>
      {direction && (
        <ExcelImportModal open={importOpen} onClose={() => setImportOpen(false)} direction={direction} dirLabel={dirLabel}
          onImported={() => { qc.invalidateQueries({ queryKey: ["corr", direction] }); qc.invalidateQueries({ queryKey: ["corr-tree"] }); }} />
      )}
    </div>
  );
}
