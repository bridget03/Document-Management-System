import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Menu,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import {
  corrDelete,
  corrList,
  corrTreeStats,
  listDocTypes,
} from "../services/correspondenceApi";
import { listTopics } from "../services/topicApi";
import type { Topic } from "../types/topic";
import { TableSkeleton } from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import Button, { IconButton, LinkButton } from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import { Select } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";
import { useAuthStore } from "../stores/authStore";
import CorrespondenceTree, {
  type TreeSelection,
} from "../components/correspondence/tree/CorrespondenceTree";
import DateFilter, {
  presetRange,
  type Preset,
  type Range,
} from "../components/dashboard/DateFilter";
import type {
  CorrSortKey,
  SortOrder,
} from "../components/correspondence/CorrespondenceTable";
import IncomingTable from "../components/correspondence/IncomingTable";
import OutgoingTable from "../components/correspondence/OutgoingTable";
import InternalTable from "../components/correspondence/InternalTable";
import ExcelImportModal from "../components/correspondence/ExcelImportModal";
import {
  DIRECTION_CONFIG,
  type CorrDoc,
  type Direction,
} from "../types/correspondence";

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

function monthRange(
  year: number,
  month: number | null,
): { date_from: string; date_to: string } {
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
    direction:
      d === "INCOMING" || d === "OUTGOING" || d === "INTERNAL" ? d : null,
    month: Number.isFinite(m) && m >= 1 && m <= 12 ? m : null,
  };
}

export default function CorrespondenceExplorer({
  fixedDirection = null,
}: {
  fixedDirection?: Direction | null;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const nav = useNavigate();
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
  // Thu gọn cây tài liệu (desktop). Nhớ lựa chọn trong localStorage.
  const [treeCollapsed, setTreeCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("corr-tree-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const toggleTreeCollapsed = () => {
    setTreeCollapsed((c) => {
      try {
        localStorage.setItem("corr-tree-collapsed", c ? "0" : "1");
      } catch {
        /* bỏ qua */
      }
      return !c;
    });
  };

  // ---- Doc list state (reuse CorrespondenceList) ----
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeId, setTypeId] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [importantOnly, setImportantOnly] = useState(false);
  const [scope, setScope] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<CorrSortKey>("issue_date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [del, setDel] = useState<CorrDoc | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const direction: Direction | null = fixedDirection ?? selection.direction;
  // Member read-only: chỉ admin (phòng tổ chức) được tạo/import công văn.
  const isAdmin = useAuthStore((s) => s.user?.role === "ADMIN");
  const apiDir = direction ? DIRECTION_CONFIG[direction].api : null;
  const base = direction ? API_BASE[direction] : "/correspondence/incoming";
  const dirLabel = direction ? DIRECTION_CONFIG[direction].short : "công văn";

  // ---- Tree stats (1 request, theo issue_date, tôn trọng scope) ----
  // Công văn đến: bỏ lọc phạm vi, luôn xem tất cả.
  const effScope = direction === "INCOMING" ? "all" : scope;
  const {
    data: treeData,
    isLoading: treeLoading,
    isError: treeError,
    refetch: refetchTree,
  } = useQuery({
    queryKey: ["corr-tree", effScope],
    queryFn: () => corrTreeStats(effScope),
  });
  const treeItems = treeData?.items ?? [];
  const visibleItems = fixedDirection
    ? treeItems.filter((i) => i.direction === fixedDirection)
    : treeItems;
  const totalCount = useMemo(
    () => visibleItems.reduce((s, i) => s + i.count, 0),
    [visibleItems],
  );

  // Vào module: hiện ngay danh sách mới thêm gần đây (không ép chọn cây).
  // User bấm node nào trên cây thì lọc theo node đó; nút "Mới thêm gần
  // đây" quay lại chế độ mặc định.

  // Sync khi Back/Forward. Khi sidebar đã khóa loại thì bỏ qua direction trên URL.
  useEffect(() => {
    const fromUrl = parseSelection(searchParams);
    const locked: TreeSelection = fixedDirection
      ? { ...fromUrl, direction: fixedDirection }
      : fromUrl;
    if (JSON.stringify(locked) !== JSON.stringify(selection)) {
      setSelection(locked);
      setPage(1);
      if (locked.year) setExpandedYears((s) => new Set(s).add(locked.year!));
      if (locked.year && locked.direction)
        setExpandedTypes((s) =>
          new Set(s).add(`${locked.year}-${locked.direction}`),
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, DEBOUNCE_MS);
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
    if (next.year) setExpandedYears((s) => new Set(s).add(next.year!));
    if (next.year && next.direction)
      setExpandedTypes((s) => new Set(s).add(`${next.year}-${next.direction}`));
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next.year) p.set("year", String(next.year));
        else p.delete("year");
        if (next.direction) p.set("direction", next.direction);
        else p.delete("direction");
        if (next.month) p.set("month", String(next.month));
        else p.delete("month");
        p.delete("folder");
        return p;
      },
      { replace: true },
    );
    setSidebarOpen(false);
  };

  // Về chế độ mặc định: danh sách mới thêm gần đây (không lọc cây).
  const showRecent = () => {
    setSelection({
      year: null,
      direction: fixedDirection ?? selection.direction,
      month: null,
    });
    setPage(1);
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete("year");
        p.delete("month");
        return p;
      },
      { replace: true },
    );
    setSidebarOpen(false);
  };

  const toggleYear = (y: number) =>
    setExpandedYears((s) => {
      const n = new Set(s);
      if (n.has(y)) n.delete(y);
      else n.add(y);
      return n;
    });
  const toggleType = (y: number, d: Direction) =>
    setExpandedTypes((s) => {
      const k = `${y}-${d}`;
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const { data: types } = useQuery({
    queryKey: ["corr-types"],
    queryFn: () => listDocTypes(),
  });
  const { data: topicOptions } = useQuery<Topic[]>({
    queryKey: ["topics-active"],
    queryFn: () => listTopics(true),
    enabled: direction === "INTERNAL",
  });

  // ---- Doc list theo node thời gian ----
  // Chưa chọn cây: hiện văn bản mới thêm gần đây (sắp theo ngày tạo).
  // Đã chọn cây: lọc theo tháng + sắp theo lựa chọn của user.
  const range =
    selection.year && selection.direction
      ? monthRange(selection.year, selection.month)
      : null;
  const hasSelection = !!range;
  const [datePreset, setDatePreset] = useState<Preset>("all");
  const [dateRange, setDateRange] = useState<Range>({});
  const effDateFrom = [range?.date_from, dateRange.from]
    .filter(Boolean)
    .sort()
    .pop();
  const effDateTo = [range?.date_to, dateRange.to].filter(Boolean).sort()[0];
  const pickDatePreset = (p: Preset) => {
    setDatePreset(p);
    if (p !== "custom") setDateRange(presetRange(p));
    setPage(1);
  };
  const filterCount = [
    typeId,
    topicFilter,
    effScope !== "all" ? effScope : "",
    importantOnly ? "important" : "",
    dateRange.from || dateRange.to ? "date" : "",
  ].filter(Boolean).length;
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: [
      "corr",
      direction,
      hasSelection ? selection.year : null,
      hasSelection ? selection.month : null,
      searchQuery,
      typeId,
      topicFilter,
      effScope,
      hasSelection ? sortBy : "recent",
      hasSelection ? sortOrder : "desc",
      page,
      importantOnly,
      effDateFrom,
      effDateTo,
    ],
    queryFn: () =>
      corrList(apiDir!, {
        q: searchQuery || undefined,
        type_id: typeId || undefined,
        topic: topicFilter || undefined,
        scope: effScope !== "all" ? effScope : undefined,
        is_important: importantOnly ? true : undefined,
        date_from: effDateFrom,
        date_to: effDateTo,
        sort_by: hasSelection ? sortBy : "created_at",
        sort_order: hasSelection ? sortOrder : "desc",
        page,
        page_size: 20,
      }),
    enabled: !!apiDir,
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
  const clearAll = () => {
    setSearchInput("");
    setTypeId("");
    setTopicFilter("");
    setImportantOnly(false);
    setScope("all");
    setDatePreset("all");
    setDateRange({});
    setPage(1);
  };
  const handleSort = (key: CorrSortKey) => {
    if (key === sortBy) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const pageTitle = fixedDirection ? TYPE_LABEL[fixedDirection] : "Công văn";
  const pageSubtitle = fixedDirection
    ? "Duyệt theo Năm → Tháng (ngày phát hành)."
    : "Duyệt theo Năm → Loại → Tháng (ngày phát hành).";
  const title =
    selection.month && direction
      ? `${TYPE_LABEL[direction]} — Tháng ${selection.month}/${selection.year}`
      : selection.year && direction
        ? `${TYPE_LABEL[direction]} — Năm ${selection.year}`
        : direction
          ? `${TYPE_LABEL[direction]} — Mới thêm gần đây`
          : pageTitle;
  const breadcrumb = fixedDirection
    ? [
        TYPE_LABEL[fixedDirection],
        ...(selection.year ? [String(selection.year)] : []),
        ...(selection.month ? [`Tháng ${selection.month}`] : []),
      ].join(" / ")
    : [
        "Công văn",
        ...(selection.year ? [String(selection.year)] : []),
        ...(direction ? [TYPE_LABEL[direction]] : []),
        ...(selection.month ? [`Tháng ${selection.month}`] : []),
      ].join(" / ");

  return (
    <div className="flex h-[calc(100dvh-112px)] min-h-[560px] flex-col gap-3">
      {/* Page header gọn (~64px): tiêu đề + breadcrumb | actions */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 lg:hidden">
            <Button
              size="sm"
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label="Mở cây công văn"
              aria-expanded={sidebarOpen}
            >
              <Menu size={15} /> Cây
            </Button>
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-gray-900">
              {title}
            </h1>
            <p className="truncate text-xs text-gray-500">
              {breadcrumb}
              {range ? ` · ${range.date_from} → ${range.date_to}` : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {isAdmin && (
            <Button
              onClick={() => direction && setImportOpen(true)}
              disabled={!direction}
            >
              <Upload size={15} /> Nhập từ Excel
            </Button>
          )}
          {isAdmin && direction && (
            <Link to={`${base}/new`} title="Tạo công văn mới">
              <Button variant="primary">
                <Plus size={15} /> Thêm công văn
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Body: cây trái (240px, collapse được) + bảng fill phần còn lại */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <aside
          aria-label="Cây công văn"
          className={`${sidebarOpen ? "block" : "hidden"} w-full shrink-0 lg:block ${treeCollapsed ? "lg:w-11" : "lg:w-60"}`}
        >
          {treeCollapsed ? (
            <div className="flex h-full flex-col items-center rounded-lg border border-gray-200 bg-white py-2">
              <IconButton
                label="Mở rộng cây công văn"
                aria-expanded={false}
                onClick={toggleTreeCollapsed}
                title="Mở rộng cây công văn"
              >
                <ChevronsRight size={16} />
              </IconButton>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden rounded-lg border border-gray-200 bg-white p-2.5">
              <div className="flex shrink-0 items-center justify-between gap-1">
                <span className="px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Cây công văn
                </span>
                <span className="hidden lg:inline-flex">
                  <IconButton
                    label="Thu gọn cây công văn"
                    aria-expanded={true}
                    onClick={toggleTreeCollapsed}
                    title="Thu gọn cây công văn"
                  >
                    <ChevronsLeft size={15} />
                  </IconButton>
                </span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                <button
                  type="button"
                  onClick={showRecent}
                  aria-current={!hasSelection}
                  className={`mb-1.5 flex w-full shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium ${
                    !hasSelection
                      ? "bg-brand-50 text-brand-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Clock size={14} className="shrink-0" />
                  <span className="truncate">Mới thêm gần đây</span>
                </button>
                {treeLoading ? (
                  <p className="px-2 py-3 text-xs text-gray-500">
                    Đang tải cây...
                  </p>
                ) : treeError ? (
                  <div className="px-2 py-3 text-center">
                    <p className="text-xs font-medium text-gray-700">
                      Không tải được cây.
                    </p>
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() => refetchTree()}
                    >
                      Thử lại
                    </Button>
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
                    rootLabel={
                      fixedDirection ? TYPE_LABEL[fixedDirection] : "Công văn"
                    }
                  />
                )}
              </div>
            </div>
          )}
        </aside>

        {/* Table workspace: toolbar + bảng scroll độc lập + pagination đáy */}
        <section
          aria-label="Danh sách công văn"
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white"
        >
          {!direction ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div>
                <p className="font-semibold text-gray-900">
                  {fixedDirection
                    ? "Chọn năm / tháng trong cây"
                    : "Chọn năm / loại / tháng trong cây"}
                </p>
                <p className="mt-1 text-sm text-gray-500">{pageSubtitle}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="shrink-0 space-y-2 border-b border-gray-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 focus-within:border-brand-600">
                    <Search size={16} className="shrink-0 text-gray-400" />
                      <input
                        className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                        placeholder="Tìm theo số văn bản, tên tiêu đề, nơi nhận/gửi, người ký..."
                        aria-label={`Tìm văn bản ${dirLabel}`}
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                    />
                    {searchInput && (
                      <IconButton
                        label="Xóa tìm kiếm"
                        iconSize="sm"
                        onClick={() => setSearchInput("")}
                      >
                        <X size={15} />
                      </IconButton>
                    )}
                  </div>
                  <Button
                    onClick={() => setShowFilters((s) => !s)}
                    aria-expanded={showFilters}
                  >
                    <SlidersHorizontal size={15} /> Lọc
                    {filterCount > 0 && (
                      <Badge tone="brand" className="ml-1">
                        {filterCount}
                      </Badge>
                    )}
                  </Button>
                </div>

                <>
                  <div className="grid grid-cols-1 gap-2 border-t border-gray-100 pt-3 sm:grid-cols-2">
                    {direction !== "INCOMING" && (
                      <Select
                        value={scope}
                        onChange={(e) => {
                          setScope(e.target.value);
                          setPage(1);
                          qc.invalidateQueries({ queryKey: ["corr-tree"] });
                        }}
                        aria-label="Phạm vi"
                      >
                        <option value="all">Tất cả</option>
                        <option value="mine">Của tôi</option>
                        <option value="department">Phòng tôi</option>
                      </Select>
                    )}
                      <Select
                        value={typeId}
                        onChange={(e) => {
                          setTypeId(e.target.value);
                          setPage(1);
                        }}
                        aria-label="Lọc loại văn bản"
                      >
                        <option value="">Tất cả loại</option>
                        {(types || []).map(
                          (t: { id: string; code: string; name: string }) => (
                            <option key={t.id} value={t.id}>
                              {t.code} · {t.name}
                            </option>
                          ),
                        )}
                      </Select>
                      {direction === "INTERNAL" && (
                        <Select
                          value={topicFilter}
                          onChange={(e) => {
                            setTopicFilter(e.target.value);
                            setPage(1);
                          }}
                          aria-label="Lọc vấn đề công văn"
                        >
                          <option value="">Tất cả vấn đề</option>
                          {(topicOptions || []).map((t) => (
                            <option key={t.id} value={t.name}>
                              {t.name}
                            </option>
                          ))}
                        </Select>
                      )}
                    </div>
                </>
                {showFilters && (
                  <div className="w-full border-t border-gray-100 pt-3">
                    <p className="mb-1.5 text-xs font-medium text-gray-500">
                      Lọc theo ngày phát hành
                    </p>
                    <DateFilter
                      preset={datePreset}
                      onPreset={pickDatePreset}
                      range={dateRange}
                      onCustom={(r) => {
                        setDateRange(r);
                        setPage(1);
                      }}
                      showPresets={false}
                    />
                  </div>
                )}

                <label className="flex w-fit py-4 cursor-pointer items-center gap-2 text-sm font-medium text-red-700">
                  <input
                    type="checkbox"
                    checked={importantOnly}
                    onChange={(e) => {
                      setImportantOnly(e.target.checked);
                      setPage(1);
                    }}
                    className="h-4 w-4 accent-red-600"
                  />
                  Chỉ xem công văn quan trọng
                </label>
                {(filterCount > 0 || searchQuery) && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{filterCount} bộ lọc đang dùng</span>
                    <LinkButton onClick={clearAll}>Xóa bộ lọc</LinkButton>
                  </div>
                )}
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                {isError ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                    <p className="font-semibold text-gray-900">
                      Không tải được danh sách
                    </p>
                    <Button size="sm" onClick={() => refetch()}>
                      Thử lại
                    </Button>
                  </div>
                ) : isLoading && !data ? (
                  <div className="flex-1 overflow-auto p-4">
                    <TableSkeleton rows={12} cols={6} />
                  </div>
                ) : (data?.items.length || 0) === 0 && !isFetching ? (
                  <div className="flex flex-1 items-center justify-center overflow-auto p-6">
                    <EmptyState
                      title={
                        searchQuery || filterCount > 0
                          ? "Không tìm thấy văn bản"
                          : "Chưa có công văn"
                      }
                      description={
                        searchQuery || filterCount > 0
                          ? "Hãy thử thay đổi từ khóa hoặc bộ lọc."
                          : selection.month
                            ? `Không có ${TYPE_LABEL[direction!].toLowerCase()} trong tháng ${selection.month}/${selection.year}.`
                            : selection.year
                              ? `Không có ${TYPE_LABEL[direction!].toLowerCase()} trong năm ${selection.year}.`
                              : `Chưa có ${TYPE_LABEL[direction!].toLowerCase()} nào.`
                      }
                      actionLabel={
                        searchQuery || filterCount > 0
                          ? "Xóa bộ lọc"
                          : "Thêm văn bản"
                      }
                      onAction={
                        searchQuery || filterCount > 0 ? clearAll : undefined
                      }
                    />
                  </div>
                ) : (
                  <>
                    {isFetching && (
                      <p className="shrink-0 border-b border-gray-100 px-4 py-1 text-xs text-gray-400">
                        Đang cập nhật…
                      </p>
                    )}
                    {direction === "INCOMING" ? (
                      <IncomingTable
                        items={data?.items || []}
                        base={base}
                        onDelete={(d) => setDel(d)}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                     onDuplicate={(d) => nav(`${base}/new`, { state: { cloneFrom: d } })}
                      />
                    ) : direction === "OUTGOING" ? (
                      <OutgoingTable
                        items={data?.items || []}
                        base={base}
                        onDelete={(d) => setDel(d)}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                     onDuplicate={(d) => nav(`${base}/new`, { state: { cloneFrom: d } })}
                      />
                    ) : (
                      <InternalTable
                        items={data?.items || []}
                        base={base}
                        onDelete={(d) => setDel(d)}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                     onDuplicate={(d) => nav(`${base}/new`, { state: { cloneFrom: d } })}
                      />
                    )}
                    <div className="flex shrink-0 items-center justify-between border-t border-gray-200 bg-white px-4 py-2 text-sm">
                      <span className="text-gray-500">
                        Trang {data?.page} / {data?.total_pages} · {data?.total}{" "}
                        văn bản
                      </span>
                      <span className="flex gap-1.5">
                        <Button
                          size="sm"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => p - 1)}
                          aria-label="Trang trước"
                        >
                          <ChevronLeft size={15} />
                        </Button>
                        <Button
                          size="sm"
                          disabled={!data || page >= (data.total_pages || 1)}
                          onClick={() => setPage((p) => p + 1)}
                          aria-label="Trang sau"
                        >
                          <ChevronRight size={15} />
                        </Button>
                      </span>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <Modal
        open={del !== null}
        onClose={() => setDel(null)}
        title="Xóa văn bản?"
        footer={
          <>
            <Button onClick={() => setDel(null)}>Hủy</Button>
            <Button
              variant="primary"
              loading={remove.isPending}
              onClick={() => del && remove.mutate(del.id)}
            >
              Xóa
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Bạn có chắc chắn muốn xóa công văn “{del?.document_number}”? Hành động
          này không thể hoàn tác. Tệp đính kèm gốc vẫn được giữ lại.
        </p>
      </Modal>
      {direction && (
        <ExcelImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          direction={direction}
          dirLabel={dirLabel}
          onImported={() => {
            qc.invalidateQueries({ queryKey: ["corr", direction] });
            qc.invalidateQueries({ queryKey: ["corr-tree"] });
          }}
        />
      )}
    </div>
  );
}
