import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  Folder,
  FolderPlus,
  Trash2,
} from "lucide-react";
import {
  corrList,
  corrDelete,
  corrCreateFolder,
  corrDeleteFolder,
  corrFolders,
  corrMoveToFolder,
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
import CorrespondenceTable, {
  type CorrSortKey,
  type SortOrder,
} from "../components/correspondence/CorrespondenceTable";
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

interface CorrFolder {
  id: string;
  name: string;
  parent_id: string | null;
  item_count: number;
}

interface FolderTreeProps {
  folders: CorrFolder[];
  parentId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateChild: (id: string) => void;
  onDelete: (id: string) => void;
}

function FolderTree({
  folders,
  parentId,
  selectedId,
  onSelect,
  onCreateChild,
  onDelete,
}: FolderTreeProps) {
  return folders
    .filter((folder) => folder.parent_id === parentId)
    .map((folder) => (
      <div key={folder.id} className="ml-3 border-l border-gray-200 pl-2">
        <div className="group flex items-center rounded-md hover:bg-gray-50">
          <button
            type="button"
            className={`flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-xs font-medium ${selectedId === folder.id ? "text-brand-700" : "text-gray-700"}`}
            onClick={() => onSelect(folder.id)}
          >
            <Folder size={14} className="shrink-0" />
            <span className="truncate">{folder.name}</span>
            <span className="ml-auto text-gray-400">{folder.item_count}</span>
          </button>
          <button
            type="button"
            className="p-1.5 text-gray-400 hover:text-brand-700"
            aria-label={`Tạo thư mục con trong ${folder.name}`}
            onClick={() => onCreateChild(folder.id)}
          >
            <FolderPlus size={14} />
          </button>
          <button
            type="button"
            className="p-1.5 text-gray-400 hover:text-red-600"
            aria-label={`Xóa thư mục ${folder.name}`}
            onClick={() => onDelete(folder.id)}
          >
            <Trash2 size={13} />
          </button>
        </div>
        <FolderTree
          folders={folders}
          parentId={folder.id}
          selectedId={selectedId}
          onSelect={onSelect}
          onCreateChild={onCreateChild}
          onDelete={onDelete}
        />
      </div>
    ));
}

export default function CorrespondenceList({
  direction,
  title,
  subtitle,
  base,
}: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const cfg = DIRECTION_CONFIG[direction];
  const apiDir = cfg.api;
  const dirLabel = cfg.short;
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeId, setTypeId] = useState("");
  const [signer, setSigner] = useState("");
  const [status, setStatus] = useState("");
  const [importantOnly, setImportantOnly] = useState(false);
  const [scope, setScope] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<CorrSortKey>("issue_date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [del, setDel] = useState<CorrDoc | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(() =>
    searchParams.get("folder"),
  );
  const [folderName, setFolderName] = useState("");
  const [folderParentId, setFolderParentId] = useState<string | null>(null);
  const [folderCreateOpen, setFolderCreateOpen] = useState(false);
  const [moveDoc, setMoveDoc] = useState<CorrDoc | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  // Giữ ngữ cảnh thư mục trong URL (?folder=) để nút "Thêm mới công văn"
  // truyền sang trang tạo, và nút Quay lại / reload vẫn giữ đúng thư mục.
  const selectFolder = (id: string | null) => {
    setFolderId(id);
    setPage(1);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set("folder", id);
        else next.delete("folder");
        return next;
      },
      { replace: true },
    );
  };

  // Đồng bộ khi user dùng nút Back/Forward hoặc quay về từ trang tạo (?folder=).
  useEffect(() => {
    const fromUrl = searchParams.get("folder");
    if (fromUrl !== folderId) {
      setFolderId(fromUrl);
      setPage(1);
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

  const { data: types } = useQuery({
    queryKey: ["corr-types"],
    queryFn: () => listDocTypes(),
  });
  const { data: folders = [] } = useQuery<CorrFolder[]>({
    queryKey: ["corr-folders", direction],
    queryFn: () => corrFolders(direction),
  });

  const filterCount = [
    typeId,
    signer,
    status,
    scope !== "all" ? scope : "",
    importantOnly ? "important" : "",
  ].filter(Boolean).length;
  const activeFolder = folders.find((f) => f.id === folderId) ?? null;
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: [
      "corr",
      direction,
      searchQuery,
      typeId,
      signer,
      status,
      scope,
      folderId,
      sortBy,
      sortOrder,
      page,
      importantOnly,
    ],
    queryFn: () =>
      corrList(apiDir, {
        q: searchQuery || undefined,
        type_id: typeId || undefined,
        signer: signer || undefined,
        status: status || undefined,
        scope: scope !== "all" ? scope : undefined,
        folder_id: folderId || undefined,
        is_important: importantOnly ? true : undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
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

  const createFolder = useMutation({
    mutationFn: () => corrCreateFolder(folderName, direction, folderParentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corr-folders", direction] });
      setFolderName("");
      setFolderParentId(null);
      setFolderCreateOpen(false);
      toast("success", "Đã tạo thư mục.");
    },
    onError: () => toast("error", "Không tạo được thư mục."),
  });

  const deleteFolder = useMutation({
    mutationFn: (id: string) => corrDeleteFolder(id),
    onSuccess: (_data, deletedId) => {
      // Nếu đang đứng trong thư mục vừa xóa thì về "Tất cả" (kèm URL).
      if (folderId === deletedId) selectFolder(null);
      qc.invalidateQueries({ queryKey: ["corr-folders", direction] });
      qc.invalidateQueries({ queryKey: ["corr", direction] });
      toast("success", "Đã xóa thư mục. Công văn vẫn được giữ lại.");
    },
    onError: () => toast("error", "Không xóa được thư mục."),
  });

  const moveToFolder = useMutation({
    mutationFn: (targetFolderId: string) =>
      corrMoveToFolder(targetFolderId, [moveDoc!.id]),
    onSuccess: () => {
      setMoveDoc(null);
      qc.invalidateQueries({ queryKey: ["corr-folders", direction] });
      qc.invalidateQueries({ queryKey: ["corr", direction] });
      toast("success", "Đã chuyển công văn vào thư mục.");
    },
    onError: () => toast("error", "Không chuyển được công văn."),
  });

  const clearAll = () => {
    setSearchInput("");
    setTypeId("");
    setSigner("");
    setStatus("");
    setImportantOnly(false);
    setScope("all");
    setPage(1);
  };

  const handleSort = (key: CorrSortKey) => {
    if (key === sortBy) {
      setSortOrder((order) => (order === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortOrder("asc");
    }
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
          <Link
            to={
              folderId
                ? `${base}/new?folder=${encodeURIComponent(folderId)}`
                : `${base}/new`
            }
            title={
              activeFolder
                ? `Tạo công văn trong thư mục "${activeFolder.name}"`
                : "Tạo công văn mới"
            }
          >
            <Button variant="primary">
              <Plus size={15} />{" "}
              {activeFolder
                ? `Thêm mới vào "${activeFolder.name}"`
                : "Thêm mới công văn"}
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
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-red-700">
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
      </Card>

      <Card className="p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-800">Thư mục của tôi</p>
          <Button
            size="sm"
            onClick={() => {
              setFolderParentId(null);
              setFolderCreateOpen(true);
            }}
          >
            <FolderPlus size={14} /> Tạo thư mục
          </Button>
        </div>
        <div className="space-y-1">
          <Button
            size="sm"
            variant={folderId === null ? "primary" : "secondary"}
            onClick={() => selectFolder(null)}
          >
            Tất cả công văn
          </Button>
          <FolderTree
            folders={folders}
            parentId={null}
            selectedId={folderId}
            onSelect={(id) => selectFolder(id)}
            onCreateChild={(id) => {
              setFolderParentId(id);
              setFolderCreateOpen(true);
            }}
            onDelete={(id) => deleteFolder.mutate(id)}
          />
        </div>
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
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              onMoveToFolder={setMoveDoc}
            />
          ) : direction === "OUTGOING" ? (
            <OutgoingTable
              items={data?.items || []}
              base={base}
              onDelete={(d) => setDel(d)}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              onMoveToFolder={setMoveDoc}
            />
          ) : (
            <CorrespondenceTable
              items={data?.items || []}
              dir={direction}
              base={base}
              onDelete={(d) => setDel(d)}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              onMoveToFolder={setMoveDoc}
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

      <Modal
        open={folderCreateOpen}
        onClose={() => setFolderCreateOpen(false)}
        title={folderParentId ? "Tạo thư mục con" : "Tạo thư mục công văn"}
        footer={
          <>
            <Button onClick={() => setFolderCreateOpen(false)}>Hủy</Button>
            <Button
              variant="primary"
              loading={createFolder.isPending}
              disabled={!folderName.trim()}
              onClick={() => createFolder.mutate()}
            >
              Tạo thư mục
            </Button>
          </>
        }
      >
        <label
          className="block text-sm font-medium text-gray-700"
          htmlFor="folder-name"
        >
          Tên thư mục
        </label>
        <input
          id="folder-name"
          autoFocus
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && folderName.trim()) createFolder.mutate();
          }}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-600"
          placeholder="Ví dụ: Hồ sơ dự án A"
        />
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
