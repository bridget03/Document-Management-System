import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  Search,
  Upload,
  X,
  SlidersHorizontal,
  Eye,
  Download,
  Trash2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  listDocuments,
  deleteDocument,
  downloadViaBlob,
} from "../services/documentApi";
import api from "../services/api";
import { Card, TableSkeleton } from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import Button from "../components/ui/Button";
import { IconButton, LinkButton, MenuItem } from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import { Select } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";
import FileTypeIcon from "../components/documents/FileTypeIcon";
import StatusBadge from "../components/documents/StatusBadge";
import { fileTypeLabel } from "../components/document-viewer/preview";
import type { Document } from "../types/document";

const DEBOUNCE_MS = 400;

const SORTS = [
  {
    value: "created_desc",
    label: "Newest first",
    sort_by: "created_at",
    sort_order: "desc",
  },
  {
    value: "created_asc",
    label: "Oldest first",
    sort_by: "created_at",
    sort_order: "asc",
  },
  { value: "name_asc", label: "Name A–Z", sort_by: "name", sort_order: "asc" },
  {
    value: "size_desc",
    label: "Largest first",
    sort_by: "file_size",
    sort_order: "desc",
  },
];

function fmtSize(n?: number): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function Documents() {
  const [params] = useSearchParams();
  // Typing state stays local so the input node is never remounted by queries.
  const [searchInput, setSearchInput] = useState(() => params.get("q") || "");
  const [searchQuery, setSearchQuery] = useState(() => params.get("q") || "");
  const [fileExt, setFileExt] = useState("");
  const [source, setSource] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tagId, setTagId] = useState("");
  const [syncStatus, setSyncStatus] = useState("");
  const [scope, setScope] = useState("all");
  const [sort, setSort] = useState("created_desc");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();
  const nav = useNavigate();

  // One-way sync from header search (?q=): updates value, never remounts input.
  const headerQ = params.get("q") || "";
  useEffect(() => {
    setSearchInput(headerQ);
    setSearchQuery(headerQ);
    setPage(1);
  }, [headerQ]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const sortCfg = SORTS.find((s) => s.value === sort) || SORTS[0];
  const filterCount = [fileExt, source, categoryId, tagId, syncStatus, scope !== "all" ? scope : ""].filter(
    Boolean,
  ).length;

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: [
      "docs",
      searchQuery,
      fileExt,
      source,
      categoryId,
      tagId,
      syncStatus,
      scope,
      sort,
      page,
    ],
    queryFn: () =>
      listDocuments({
        q: searchQuery || undefined,
        file_extension: fileExt || undefined,
        source: source || undefined,
        category_id: categoryId || undefined,
        tag_id: tagId || undefined,
        sync_status: syncStatus || undefined,
        scope: scope !== "all" ? scope : undefined,
        sort_by: sortCfg.sort_by,
        sort_order: sortCfg.sort_order,
        page,
        page_size: 20,
      }),
    placeholderData: keepPreviousData,
  });

  const del = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["docs"] });
      setDeleteId(null);
      toast("success", "Document deleted.");
    },
    onError: () => toast("error", "Could not delete document."),
  });

  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [allTags, setAllTags] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    api
      .get("/categories")
      .then((r) => setCats(r.data))
      .catch(() => {});
  }, []);
  useEffect(() => {
    api
      .get("/tags")
      .then((r) => setAllTags(r.data))
      .catch(() => {});
  }, []);

  const clearAll = () => {
    setSearchInput("");
    setFileExt("");
    setSource("");
    setCategoryId("");
    setTagId("");
    setSyncStatus("");
    setPage(1);
  };

  const setFilter = (fn: (v: string) => void) => (v: string) => {
    fn(v);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Documents</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Manage, organize and access your documents.
          </p>
        </div>
        <Link to="/upload">
          <Button variant="primary">
            <Upload size={15} /> Upload document
          </Button>
        </Link>
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 focus-within:border-brand-600">
            <Search size={16} className="shrink-0 text-gray-400" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
              placeholder="Search documents..."
              aria-label="Search documents"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <IconButton
                label="Clear search"
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
            <SlidersHorizontal size={15} /> Filters
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
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="w-auto"
            aria-label="Sort documents"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 gap-2 border-t border-gray-100 pt-3 sm:grid-cols-2 lg:grid-cols-5">
            <Select
              value={categoryId}
              onChange={(e) => setFilter(setCategoryId)(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select
              value={tagId}
              onChange={(e) => setFilter(setTagId)(e.target.value)}
              aria-label="Filter by tag"
            >
              <option value="">All tags</option>
              {allTags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Select
              value={fileExt}
              onChange={(e) => setFilter(setFileExt)(e.target.value)}
              aria-label="Filter by type"
            >
              <option value="">All types</option>
              <option value="pdf">PDF</option>
              <option value="docx">Word</option>
              <option value="xlsx">Excel</option>
              <option value="png">Image</option>
              <option value="txt">TXT</option>
            </Select>
            <Select
              value={source}
              onChange={(e) => setFilter(setSource)(e.target.value)}
              aria-label="Filter by source"
            >
              <option value="">All sources</option>
              <option value="LOCAL_UPLOAD">Local</option>
              <option value="GOOGLE_DRIVE">Drive</option>
            </Select>
            <Select
              value={syncStatus}
              onChange={(e) => setFilter(setSyncStatus)(e.target.value)}
              aria-label="Filter by sync status"
            >
              <option value="">All statuses</option>
              <option value="NOT_SYNCED">Not synced</option>
              <option value="SYNCED">Synced</option>
              <option value="REMOTE_MISSING">Missing</option>
              <option value="FAILED">Failed</option>
            </Select>
          </div>
        )}

        {(filterCount > 0 || searchQuery) && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>
              {filterCount > 0
                ? `${filterCount} filter${filterCount === 1 ? "" : "s"} applied`
                : `Results for “${searchQuery}”`}
            </span>
            <LinkButton onClick={clearAll}>
              Clear all
            </LinkButton>
          </div>
        )}
      </Card>

      {isError ? (
        <Card className="px-6 py-10 text-center">
          <p className="font-semibold text-gray-900">
            Unable to load documents
          </p>
          <p className="mt-1 text-sm text-gray-500">
            We couldn&apos;t retrieve the document list.
          </p>
          <Button size="sm" className="mt-3" onClick={() => refetch()}>
            Try again
          </Button>
        </Card>
      ) : isLoading && !data ? (
        <TableSkeleton rows={6} cols={5} />
      ) : (data?.items.length || 0) === 0 && !isFetching ? (
        <EmptyState
          title={
            searchQuery || filterCount > 0
              ? "No documents found"
              : "No documents yet"
          }
          description={
            searchQuery || filterCount > 0
              ? "Try a different keyword or remove some filters."
              : "Upload your first document to get started."
          }
          actionLabel={
            searchQuery || filterCount > 0 ? "Clear filters" : "Upload document"
          }
          onAction={
            searchQuery || filterCount > 0 ? clearAll : () => nav("/upload")
          }
        />
      ) : (
        <Card className="overflow-hidden">
          {isFetching && (
            <p className="border-b border-gray-100 px-4 py-1.5 text-xs text-gray-400">
              Updating…
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Size</th>
                  <th className="px-4 py-2.5 font-medium">Modified</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.items.map((d: Document) => (
                  <tr key={d.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <Link
                        to={`/documents/${d.id}`}
                        className="flex items-center gap-3"
                      >
                        <FileTypeIcon
                          ext={d.file_extension}
                          mime={d.mime_type}
                        />
                        <span className="min-w-0">
                          <span className="block max-w-[320px] truncate font-medium text-gray-900">
                            {d.name}
                          </span>
                          <span className="block text-xs text-gray-500">
                            {fileTypeLabel(d)}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                      {d.category?.name || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                      {fmtSize(d.file_size)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                      {new Date(d.updated_at).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <StatusBadge status={d.sync_status} source={d.source} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="relative inline-block">
                        <IconButton
                          label={`Actions for ${d.name}`}
                          aria-expanded={menuId === d.id}
                          onClick={() =>
                            setMenuId(menuId === d.id ? null : d.id)
                          }
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
                                to={`/documents/${d.id}/preview`}
                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                onClick={() => setMenuId(null)}
                              >
                                <Eye size={14} /> Preview
                              </Link>
                              <MenuItem
                                onClick={() => {
                                  setMenuId(null);
                                  downloadViaBlob(
                                    d.id,
                                    d.original_name || d.name,
                                  )
                                    .then(() =>
                                      toast("success", "Download started."),
                                    )
                                    .catch(() =>
                                      toast("error", "Download failed."),
                                    );
                                }}
                              >
                                <Download size={14} /> Download
                              </MenuItem>
                              <MenuItem
                                tone="danger"
                                onClick={() => {
                                  setMenuId(null);
                                  setDeleteId(d.id);
                                }}
                              >
                                <Trash2 size={14} /> Delete
                              </MenuItem>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2.5 text-sm">
            <span className="text-gray-500">
              Page {data?.page} of {data?.total_pages} · {data?.total} documents
            </span>
            <span className="flex gap-1.5">
              <Button
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft size={15} />
              </Button>
              <Button
                size="sm"
                disabled={!data || page >= (data.total_pages || 1)}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next page"
              >
                <ChevronRight size={15} />
              </Button>
            </span>
          </div>
        </Card>
      )}

      <Modal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Delete document"
        footer={
          <>
            <Button onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="primary" loading={del.isPending}
              onClick={() => deleteId && del.mutate(deleteId)}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete this document? Files stored on Google
          Drive are kept — only the DMS record is removed.
        </p>
      </Modal>
    </div>
  );
}
