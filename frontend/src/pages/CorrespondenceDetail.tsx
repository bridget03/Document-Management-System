import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Download,
  Eye,
  ExternalLink,
  Link2,
  Paperclip,
} from "lucide-react";
import { corrGet, corrDelete } from "../services/correspondenceApi";
import { downloadViaBlob } from "../services/documentApi";
import DocumentViewer from "../components/document-viewer/DocumentViewer";
import { Card, Skeleton } from "../components/ui/Skeleton";
import Button from "../components/ui/Button";
import { IconButton } from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import { useToast } from "../components/ui/Toast";
import { useState } from "react";
import {
  STATUS_CONFIG,
  LEVEL_LABELS,
  fmtDateVN,
  splitPartyList,
  DIRECTION_CONFIG,
  type CorrDoc,
  type Direction,
} from "../types/correspondence";

interface Props {
  direction: Direction;
  title: string;
  base: string;
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 py-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{children}</span>
    </div>
  );
}

export default function CorrespondenceDetail({
  direction,
  title,
  base,
}: Props) {
  const { id } = useParams();
  const apiDir = DIRECTION_CONFIG[direction].api;
  const nav = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [del, setDel] = useState(false);

  const { data, isLoading, isError, error } = useQuery<CorrDoc>({
    queryKey: ["corr-doc", id],
    queryFn: () => corrGet(apiDir, id!),
    retry: false,
  });

  const remove = useMutation({
    mutationFn: () => corrDelete(apiDir, id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corr", direction] });
      toast("success", "Đã xóa văn bản.");
      nav(base);
    },
    onError: () => toast("error", "Không xóa được văn bản."),
  });

  const downloadAll = async () => {
    if (!data || data.attachments.length === 0) {
      toast("error", "Văn bản không có tệp đính kèm.");
      return;
    }
    try {
      for (const a of data.attachments) {
        if (a.document) await downloadViaBlob(a.document.id, a.document.name);
      }
      toast("success", "Đã tải xuống tệp đính kèm.");
    } catch {
      toast("error", "Tải xuống thất bại.");
    }
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
    const errDetail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
    const msg = typeof errDetail === "string" ? errDetail : "Không tìm thấy văn bản";
    return (
      <Card className="mx-auto max-w-2xl px-6 py-10 text-center">
        <p className="font-semibold text-gray-900">{msg}</p>
        <Link
          to={base}
          className="mt-3 inline-block text-sm font-medium text-brand-700"
        >
          ← {title}
        </Link>
      </Card>
    );
  }

  const st = STATUS_CONFIG[data.processing_status] || {
    label: data.processing_status,
    tone: "neutral" as const,
  };
  const partyLabel = DIRECTION_CONFIG[direction].partyLabel.replace(" *", "");
  const party = data[DIRECTION_CONFIG[direction].partyKey];

  return (
    <div className="space-y-4">
      <Link
        to={base}
        className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={14} /> {title}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">
              {data.document_number}
            </h1>
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-gray-500">
            {data.doc_type
              ? `${data.doc_type.code} · ${data.doc_type.name}`
              : "Chưa phân loại"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`${base}/${data.id}/edit`}>
            <Button>
              <Pencil size={15} /> Chỉnh sửa
            </Button>
          </Link>
          <Button onClick={downloadAll}>
            <Download size={15} /> Tải xuống
          </Button>
          <Button onClick={() => setDel(true)}>
            <Trash2 size={15} /> Xóa
          </Button>
        </div>
      </div>

      {data.attachments.length > 0 && (
        <Card className="p-4 mb-4">
          <DocumentViewer doc={data.attachments[0].document as any} />
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <h2 className="text-sm font-semibold text-gray-900">
            Thông tin chung
          </h2>
          <div className="mt-2 divide-y divide-gray-100">
            <InfoRow label="Số văn bản">{data.document_number}</InfoRow>
            <InfoRow label="Loại văn bản">
              {data.doc_type
                ? `${data.doc_type.code} · ${data.doc_type.name}`
                : "—"}
            </InfoRow>
            <InfoRow label={partyLabel}>
              {direction === "INCOMING" ? (
                party || "—"
              ) : splitPartyList(party).length > 0 ? (
                <span className="flex flex-wrap gap-1.5">
                  {splitPartyList(party).map((p, i) => (
                    <span
                      key={`${p}-${i}`}
                      className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800"
                    >
                      {p}
                    </span>
                  ))}
                </span>
              ) : (
                "—"
              )}
            </InfoRow>
            <InfoRow label="Số lượng">{data.quantity ?? "—"}</InfoRow>
            <InfoRow label="Người ký">{data.signer || "—"}</InfoRow>
            <InfoRow label="Mức độ bảo mật">
              {data.security_level ? LEVEL_LABELS[data.security_level] : "—"}
            </InfoRow>
            <InfoRow label="Mức độ khẩn cấp">
              {data.urgency_level ? LEVEL_LABELS[data.urgency_level] : "—"}
            </InfoRow>
            <InfoRow label="Ngày ký">{fmtDateVN(data.signed_date)}</InfoRow>
            <InfoRow label="Ngày hiệu lực">
              {fmtDateVN(data.effective_date)}
            </InfoRow>
            <InfoRow label="Ngày hết hiệu lực">
              {fmtDateVN(data.expiry_date)}
            </InfoRow>
            <InfoRow label="Bộ phận phát hành">
              {data.issuing_department || "—"}
            </InfoRow>
            <InfoRow label="Ngày phát hành">
              {fmtDateVN(data.issue_date)}
            </InfoRow>
            <InfoRow label="Tình trạng xử lý">
              <Badge tone={st.tone}>{st.label}</Badge>
            </InfoRow>
            <InfoRow label="Chia sẻ">
              {data.visibility === "PRIVATE"
                ? "Riêng tư"
                : data.visibility === "DEPARTMENT"
                  ? `Phòng ban${data.department ? ` (${data.department})` : ""}`
                  : "Toàn công ty"}
            </InfoRow>
            <InfoRow label="Ghi chú">{data.notes || "—"}</InfoRow>
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              <Paperclip size={14} /> Tập tin đính kèm (
              {data.attachments.length})
            </h2>
            {data.attachments.length === 0 ? (
              <p className="mt-2 text-sm text-gray-400">
                Không có tệp đính kèm.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100">
                {data.attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-gray-800">
                        {a.document?.name || a.document_id}
                      </span>
                      <span className="block text-xs text-gray-400">
                        {a.document?.source === "GOOGLE_DRIVE"
                          ? "Google Drive"
                          : "Local Storage"}
                      </span>
                    </span>
                    {a.document && (
                      <span className="flex gap-1">
                        <Link
                          to={`/documents/${a.document.id}/preview`}
                          className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                          title="Preview"
                          aria-label={`Preview ${a.document.name}`}
                        >
                          <Eye size={14} />
                        </Link>
                        <IconButton
                          label={`Download ${a.document!.name}`}
                          onClick={() =>
                            downloadViaBlob(a.document!.id, a.document!.name)
                          }
                        >
                          <Download size={14} />
                        </IconButton>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <h2 className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              <Link2 size={14} /> Liên kết ({data.links.length})
            </h2>
            {data.links.length === 0 ? (
              <p className="mt-2 text-sm text-gray-400">Không có liên kết.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {data.links.map((l) => (
                  <li key={l.id}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800"
                    >
                      <ExternalLink size={13} />{" "}
                      <span className="truncate">{l.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-900">Metadata</h2>
            <div className="mt-2 divide-y divide-gray-100 text-sm">
              <InfoRow label="Người tạo">{data.creator?.name || "—"}</InfoRow>
              <InfoRow label="Ngày tạo">
                {new Date(data.created_at).toLocaleString()}
              </InfoRow>
              <InfoRow label="Ngày cập nhật">
                {new Date(data.updated_at).toLocaleString()}
              </InfoRow>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={del}
        onClose={() => setDel(false)}
        title="Xóa văn bản?"
        footer={
          <>
            <Button onClick={() => setDel(false)}>Hủy</Button>
            <Button
              variant="primary"
              loading={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Xóa
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Bạn có chắc chắn muốn xóa văn bản “{data.document_number}”? Hành động
          này không thể hoàn tác.
        </p>
      </Modal>
    </div>
  );
}
