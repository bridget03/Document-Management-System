import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDocument,
  downloadViaBlob,
  updateDocument,
} from "../services/documentApi";
import api from "../services/api";
import { ExternalLink, Download, Eye, Pencil, ArrowLeft } from "lucide-react";
import { fileTypeLabel } from "../components/document-viewer/preview";
import { Card, Skeleton } from "../components/ui/Skeleton";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { TextInput, TextArea, Select, Field } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";
import FileTypeIcon from "../components/documents/FileTypeIcon";
import StatusBadge from "../components/documents/StatusBadge";
import DocumentViewer from "../components/document-viewer/DocumentViewer";
import type { Document } from "../types/document";

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-900">{children}</span>
    </div>
  );
}

export default function DocumentDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isError } = useQuery<Document>({
    queryKey: ["doc", id],
    queryFn: () => getDocument(id!),
  });
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState("");
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    api
      .get("/categories")
      .then((r) => setCats(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (data) {
      setDescription(data.description || "");
      setCategoryId(data.category_id || "");
      setTags(data.tags.map((t) => t.name).join(", "));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      updateDocument(id!, {
        description,
        category_id: categoryId || null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doc", id] });
      qc.invalidateQueries({ queryKey: ["docs"] });
      setEditing(false);
      toast("success", "Metadata updated.");
    },
    onError: (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      toast(
        "error",
        typeof detail === "string"
          ? detail
          : "Could not save. You may lack permission.",
      );
    },
  });

  const download = () => {
    if (!data) return;
    downloadViaBlob(data.id, data.original_name || data.name)
      .then(() => toast("success", "Download started."))
      .catch(() => toast("error", "Download failed."));
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <Card className="px-6 py-10 text-center">
        <p className="font-semibold text-gray-900">Document not found</p>
        <p className="mt-1 text-sm text-gray-500">It may have been deleted.</p>
        <Link
          to="/documents"
          className="mt-3 inline-block text-sm font-medium text-brand-700"
        >
          ← Back to documents
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        to="/documents"
        className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={14} /> Back to Documents
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <FileTypeIcon ext={data.file_extension} mime={data.mime_type} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-gray-900">
              {data.name}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {fileTypeLabel(data)}
              {data.file_size
                ? ` · ${(data.file_size / 1024 / 1024).toFixed(2)} MB`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/documents/${data.id}/preview`}>
            <Button variant="primary">
              <Eye size={15} /> Preview
            </Button>
          </Link>
          <Button onClick={download}>
            <Download size={15} /> Download
          </Button>
          {data.google_drive_url && (
            <a href={data.google_drive_url} target="_blank" rel="noreferrer">
              <Button>
                <ExternalLink size={15} /> Open in Drive
              </Button>
            </a>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <DocumentViewer doc={data} />
      </Card>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card className="space-y-4 p-5 xl:col-span-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Description</h2>
            <p className="mt-1 text-sm text-gray-600">
              {data.description || (
                <span className="text-gray-400">No description.</span>
              )}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Category</h2>
              <p className="mt-1 text-sm text-gray-600">
                {data.category?.name || "—"}
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Tags</h2>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {data.tags.length > 0 ? (
                  data.tags.map((t) => <Badge key={t.id}>{t.name}</Badge>)
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-3">
            <Button size="sm" onClick={() => setEditing((e) => !e)}>
              <Pencil size={14} />{" "}
              {editing ? "Cancel editing" : "Edit metadata"}
            </Button>
          </div>
          {editing && (
            <div className="space-y-3 rounded-lg bg-gray-50 p-4">
              <Field label="Category">
                <Select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">— None —</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tags (comma separated)">
                <TextInput
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="hop-dong, 2026"
                />
              </Field>
              <Field label="Description">
                <TextArea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
              <Button
                className="rounded-lg bg-slate-900 text-white font-medium shadow-sm transition-all
                      duration-200
                      hover:bg-slate-700
                      hover:shadow-md
                      active:scale-[0.99]
                      disabled:cursor-not-allowed
                      disabled:opacity-60
                    "
                variant="primary"
                size="sm"
                loading={save.isPending}
                onClick={() => save.mutate()}
              >
                Save changes
              </Button>
            </div>
          )}
        </Card>

        <Card className="h-fit">
          <h2 className="border-b border-gray-200 px-5 py-3.5 text-sm font-semibold text-gray-900">
            Document info
          </h2>
          <div className="divide-y divide-gray-100 px-5">
            <InfoRow label="Status">
              <StatusBadge status={data.sync_status} source={data.source} />
            </InfoRow>
            <InfoRow label="Source">
              {data.source === "GOOGLE_DRIVE" ? "Google Drive" : "Local upload"}
            </InfoRow>
            <InfoRow label="Created">
              {new Date(data.created_at).toLocaleString()}
            </InfoRow>
            <InfoRow label="Modified">
              {new Date(data.updated_at).toLocaleString()}
            </InfoRow>
          </div>
        </Card>
      </div>
    </div>
  );
}
