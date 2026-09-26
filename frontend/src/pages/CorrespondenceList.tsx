import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  Search,
  Plus,
  Upload,
  X,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  corrList,
  corrDelete,
  listDocTypes,
} from "../services/correspondenceApi";
import { Card, TableSkeleton } from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import Button from "../components/ui/Button";
import { IconButton, LinkButton } from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import { Select } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";
import CorrespondenceTable from "../components/correspondence/CorrespondenceTable";
import IncomingTable from "../components/correspondence/IncomingTable";
import OutgoingTable from "../components/correspondence/OutgoingTable";
import ExcelImportModal from "../components/correspondence/ExcelImportModal";
import {
  STATUS_OPTIONS,
  DIRECTION_CONFIG,
  type CorrDoc,
  type Direction,
} from "../types/correspondence";

const DEBOUNCE_MS = 400;

interface Props {
  direction: Direction;
  title: string;
  subtitle: string;
  base: string;
}

export default function CorrespondenceList({
  direction,
  title,
  subtitle,
  base,
}: Props) {
  const cfg = DIRECTION_CONFIG[direction];
  const apiDir = cfg.api;
  const dirLabel = cfg.short;
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeId, setTypeId] = useState("");
  const [signer, setSigner] = useState("");
  const [status, setStatus] = useState("");
  const [scope, setScope] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [del, setDel] = useState<CorrDoc | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: types } = useQuery({
    queryKey: ["corr-types"],
    queryFn: () => listDocTypes(),
  });

  const filterCount = [typeId, signer, status, scope !== "all" ? scope : ""].filter(Boolean).length;
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["corr", direction, searchQuery, typeId, signer, status, scope, page],
    queryFn: () =>
      corrList(apiDir, {
        q: searchQuery || undefined,
        type_id: typeId || undefined,
        signer: signer || undefined,
        status: status || undefined,
        scope: scope !== "all" ? scope : undefined,
        page,
        page_size: 20,
      }),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (id: string) => corrDelete(apiDir, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corr", direction] });
      setDel(null);
      toast("success", "Đã xóa công văn.");
    },
    onError: () => toast("error", "Không xóa được công văn."),
  });

  const clearAll = () => {
    setSearchInput("");
    setTypeId("");
    setSigner("");
    setStatus("");
    setScope("all");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setImportOpen(true)}>
            <Upload size={15} /> Nhập từ Excel
          </Button>
          <Link to={`${base}/new`}>
            <Button variant="primary"
            >
              <Plus size={15} /> Thêm mới công văn
            </Button>
          </Link>
        </div>
      </div>

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
          <Select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              setPage(1);
            }}
            className="w-auto"
            aria-label="Phạm vi"
          >
            <option value="all">Tất cả</option>
            <option value="mine">Của tôi</option>
            <option value="department">Phòng tôi</option>
          </Select>
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 gap-2 border-t border-gray-100 pt-3 sm:grid-cols-3">
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
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              aria-label="Lọc tình trạng"
            >
              <option value="">Tất cả tình trạng</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <div className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2">
              <Search size={14} className="shrink-0 text-gray-400" />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                placeholder="Người ký..."
                aria-label="Lọc người ký"
                value={signer}
                onChange={(e) => {
                  setSigner(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        )}
        {(filterCount > 0 || searchQuery) && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{filterCount} bộ lọc đang dùng</span>
            <LinkButton onClick={clearAll}>
              Xóa bộ lọc
            </LinkButton>
          </div>
        )}
      </Card>

      {isError ? (
        <Card className="px-6 py-10 text-center">
          <p className="font-semibold text-gray-900">
            Không tải được danh sách
          </p>
          <Button size="sm" className="mt-3" onClick={() => refetch()}>
            Thử lại
          </Button>
        </Card>
      ) : isLoading && !data ? (
        <TableSkeleton rows={6} cols={6} />
      ) : (data?.items.length || 0) === 0 && !isFetching ? (
        <EmptyState
          title={
            searchQuery || filterCount > 0
              ? "Không tìm thấy văn bản"
              : "Chưa có văn bản"
          }
          description={
            searchQuery || filterCount > 0
              ? "Hãy thử thay đổi từ khóa hoặc bộ lọc."
              : "Bắt đầu bằng cách thêm văn bản đầu tiên."
          }
          actionLabel={
            searchQuery || filterCount > 0 ? "Xóa bộ lọc" : "Thêm văn bản"
          }
          onAction={searchQuery || filterCount > 0 ? clearAll : undefined}
        />
      ) : (
        <Card className="overflow-hidden">
          {isFetching && (
            <p className="border-b border-gray-100 px-4 py-1.5 text-xs text-gray-400">
              Đang cập nhật…
            </p>
          )}
          {direction === "INCOMING" ? (
            <IncomingTable
              items={data?.items || []}
              base={base}
              onDelete={(d) => setDel(d)}
            />
          ) : direction === "OUTGOING" ? (
            <OutgoingTable
              items={data?.items || []}
              base={base}
              onDelete={(d) => setDel(d)}
            />
          ) : (
            <CorrespondenceTable
              items={data?.items || []}
              dir={direction}
              base={base}
              onDelete={(d) => setDel(d)}
            />
          )}
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2.5 text-sm">
            <span className="text-gray-500">
              Trang {data?.page} / {data?.total_pages} · {data?.total} văn bản
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
        </Card>
      )}

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

      <ExcelImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        direction={direction}
        dirLabel={dirLabel}
        onImported={() =>
          qc.invalidateQueries({ queryKey: ["corr", direction] })
        }
      />
    </div>
  );
}
