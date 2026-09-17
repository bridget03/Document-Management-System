import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, X, Link2, FileUp, Wand2 } from "lucide-react";
import Button from "../ui/Button";
import { TextInput, TextArea, Select, Field } from "../ui/Input";
import { useToast } from "../ui/Toast";
import { uploadDocument } from "../../services/documentApi";
import { listDocTypes, nextNumber } from "../../services/correspondenceApi";
import {
  LEVEL_OPTIONS,
  STATUS_OPTIONS,
  type CorrDoc,
  type Direction,
  type DocType,
} from "../../types/correspondence";

export interface CorrFormValue {
  document_number: string;
  recipient: string;
  sender: string;
  quantity: string;
  signer: string;
  security_level: string;
  urgency_level: string;
  signed_date: string;
  effective_date: string;
  expiry_date: string;
  issuing_department: string;
  issue_date: string;
  document_type_id: string;
  processing_status: string;
  notes: string;
  attachment_ids: { document_id: string; name: string }[];
  links: { name: string; url: string }[];
}

interface Props {
  direction: Direction;
  initial?: CorrDoc | null;
  pending: boolean;
  serverError: string;
  createMode: boolean;
  onSubmit: (value: CorrFormValue, and: "close" | "add" | "open") => void;
  onCancel: () => void;
}

const empty: CorrFormValue = {
  document_number: "",
  recipient: "",
  sender: "",
  quantity: "",
  signer: "",
  security_level: "",
  urgency_level: "",
  signed_date: "",
  effective_date: "",
  expiry_date: "",
  issuing_department: "",
  issue_date: "",
  document_type_id: "",
  processing_status: "DRAFT",
  notes: "",
  attachment_ids: [],
  links: [],
};

function toValue(d: CorrDoc): CorrFormValue {
  return {
    document_number: d.document_number,
    recipient: d.recipient || "",
    sender: d.sender || "",
    quantity:
      d.quantity !== null && d.quantity !== undefined ? String(d.quantity) : "",
    signer: d.signer || "",
    security_level: d.security_level || "",
    urgency_level: d.urgency_level || "",
    signed_date: d.signed_date || "",
    effective_date: d.effective_date || "",
    expiry_date: d.expiry_date || "",
    issuing_department: d.issuing_department || "",
    issue_date: d.issue_date || "",
    document_type_id: d.document_type_id || "",
    processing_status: d.processing_status,
    notes: d.notes || "",
    attachment_ids: d.attachments.map((a) => ({
      document_id: a.document_id,
      name: a.document?.name || a.document_id,
    })),
    links: d.links.map((l) => ({ name: l.name, url: l.url })),
  };
}

export default function CorrespondenceForm({
  direction,
  initial,
  pending,
  serverError,
  createMode,
  onSubmit,
  onCancel,
}: Props) {
  const { toast } = useToast();
  const [v, setV] = useState<CorrFormValue>(empty);
  const [errors, setErrors] = useState<string[]>([]);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const { data: types } = useQuery<DocType[]>({
    queryKey: ["corr-types-active"],
    queryFn: () => listDocTypes(true),
  });

  useEffect(() => {
    setV(initial ? toValue(initial) : empty);
    setErrors([]);
  }, [initial]);

  const set = (k: keyof CorrFormValue, val: string) =>
    setV((p) => ({ ...p, [k]: val }));

  const onTypeChange = (id: string) => {
    setV((p) => {
      const t = (types || []).find((x) => x.id === id);
      const signer =
        !p.signer && t?.default_signer ? t.default_signer : p.signer;
      return { ...p, document_type_id: id, signer };
    });
  };

  const autoNumber = async () => {
    try {
      const r = await nextNumber(direction);
      set("document_number", r.next_number);
    } catch {
      toast("error", "Không lấy được số tiếp theo.");
    }
  };

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const form = new FormData();
        form.append("file", f);
        const doc = await uploadDocument(form);
        setV((p) => ({
          ...p,
          attachment_ids: [
            ...p.attachment_ids,
            { document_id: doc.id, name: doc.name || f.name },
          ],
        }));
      }
      toast("success", "Đã tải tệp lên.");
    } catch {
      toast("error", "Tải tệp thất bại.");
    } finally {
      setUploading(false);
    }
  };

  const addLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      toast("error", "URL phải bắt đầu bằng http(s)://");
      return;
    }
    setV((p) => ({
      ...p,
      links: [...p.links, { name: linkName.trim() || url, url }],
    }));
    setLinkName("");
    setLinkUrl("");
  };

  const submit = (and: "close" | "add" | "open" = "close") => {
    const errs: string[] = [];
    if (!v.document_number.trim()) errs.push("Số văn bản không được để trống.");
    if (direction === "OUTGOING" && !v.recipient.trim())
      errs.push("Nơi nhận không được để trống.");
    if (direction === "INCOMING" && !v.sender.trim())
      errs.push("Nơi gửi không được để trống.");
    if (!v.signer.trim()) errs.push("Vui lòng chọn/nhập người ký.");
    if (!v.document_type_id) errs.push("Vui lòng chọn loại văn bản.");
    if (!v.issuing_department.trim())
      errs.push("Vui lòng nhập bộ phận phát hành.");
    if (
      v.quantity.trim() &&
      (!/^\d+$/.test(v.quantity.trim()) || Number(v.quantity) < 0)
    )
      errs.push("Số lượng phải là số nguyên >= 0.");
    if (v.effective_date && v.expiry_date && v.effective_date > v.expiry_date)
      errs.push("Ngày hiệu lực phải trước hoặc bằng ngày hết hiệu lực.");
    setErrors(errs);
    if (errs.length > 0) return;
    onSubmit(v, and);
  };

  const partyLabel = direction === "OUTGOING" ? "Nơi nhận *" : "Nơi gửi *";
  const partyKey = direction === "OUTGOING" ? "recipient" : "sender";

  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <ul className="list-disc pl-5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {serverError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Không thể lưu văn bản. {serverError}
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">
          Thông tin cơ bản
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Số văn bản *">
            <div className="flex gap-2">
              <TextInput
                value={v.document_number}
                onChange={(e) => set("document_number", e.target.value)}
                placeholder="CV001/2026/VICENZA"
              />
              <Button
                size="sm"
                onClick={autoNumber}
                title="Tự sinh số tiếp theo"
              >
                <Wand2 size={14} /> Số mới
              </Button>
            </div>
          </Field>
          <Field label={partyLabel}>
            <TextInput
              value={v[partyKey]}
              onChange={(e) => set(partyKey, e.target.value)}
            />
          </Field>
          <Field label="Số lượng văn bản">
            <TextInput
              inputMode="numeric"
              value={v.quantity}
              onChange={(e) => set("quantity", e.target.value)}
              placeholder="1"
            />
          </Field>
          <Field label="Người ký *">
            <TextInput
              value={v.signer}
              onChange={(e) => set("signer", e.target.value)}
              placeholder="Nguyễn Văn A"
            />
          </Field>
          <Field label="Loại văn bản *">
            <Select
              value={v.document_type_id}
              onChange={(e) => onTypeChange(e.target.value)}
            >
              <option value="">— Chọn loại —</option>
              {(types || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} · {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bộ phận phát hành *">
            <TextInput
              value={v.issuing_department}
              onChange={(e) => set("issuing_department", e.target.value)}
              placeholder="Hành chính"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Mức độ</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-gray-700">Mức độ bảo mật</p>
            <div className="mt-1.5 flex gap-4 text-sm">
              {LEVEL_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className="flex cursor-pointer items-center gap-1.5"
                >
                  <input
                    type="radio"
                    name="security"
                    checked={v.security_level === o.value}
                    onChange={() => set("security_level", o.value)}
                  />
                  {o.label}
                </label>
              ))}
              {v.security_level && (
                <button
                  onClick={() => set("security_level", "")}
                  className="text-xs text-gray-400 underline"
                >
                  Xóa
                </button>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Mức độ khẩn cấp</p>
            <div className="mt-1.5 flex gap-4 text-sm">
              {LEVEL_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className="flex cursor-pointer items-center gap-1.5"
                >
                  <input
                    type="radio"
                    name="urgency"
                    checked={v.urgency_level === o.value}
                    onChange={() => set("urgency_level", o.value)}
                  />
                  {o.label}
                </label>
              ))}
              {v.urgency_level && (
                <button
                  onClick={() => set("urgency_level", "")}
                  className="text-xs text-gray-400 underline"
                >
                  Xóa
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Thời gian</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Ngày ký">
            <TextInput
              type="date"
              value={v.signed_date}
              onChange={(e) => set("signed_date", e.target.value)}
            />
          </Field>
          <Field label="Ngày phát hành">
            <TextInput
              type="date"
              value={v.issue_date}
              onChange={(e) => set("issue_date", e.target.value)}
            />
          </Field>
          <Field label="Ngày hiệu lực">
            <TextInput
              type="date"
              value={v.effective_date}
              onChange={(e) => set("effective_date", e.target.value)}
            />
          </Field>
          <Field label="Ngày hết hiệu lực">
            <TextInput
              type="date"
              value={v.expiry_date}
              onChange={(e) => set("expiry_date", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">
          Tình trạng xử lý
        </h2>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          {STATUS_OPTIONS.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-1.5"
            >
              <input
                type="radio"
                name="status"
                checked={v.processing_status === o.value}
                onChange={() => set("processing_status", o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>
        <div className="mt-4">
          <Field label="Ghi chú">
            <TextArea
              rows={3}
              value={v.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">
          Tập tin đính kèm
        </h2>
        <div className="mt-3 space-y-2">
          {v.attachment_ids.map((a) => (
            <div
              key={a.document_id}
              className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm"
            >
              <span className="flex-1 truncate text-gray-700">{a.name}</span>
              <button
                onClick={() =>
                  setV((p) => ({
                    ...p,
                    attachment_ids: p.attachment_ids.filter(
                      (x) => x.document_id !== a.document_id,
                    ),
                  }))
                }
                className="text-gray-400 hover:text-red-600"
                aria-label={`Gỡ ${a.name}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Plus size={14} /> Thêm tệp
            <input
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => {
                void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          {uploading && (
            <p className="text-xs text-gray-500">Đang tải tệp...</p>
          )}
        </div>
        <h2 className="mt-5 text-sm font-semibold text-gray-900">Liên kết</h2>
        <div className="mt-2 space-y-2">
          {v.links.map((l, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm"
            >
              <Link2 size={14} className="shrink-0 text-gray-400" />
              <span className="flex-1 truncate text-gray-700">
                {l.name} · <span className="text-gray-400">{l.url}</span>
              </span>
              <button
                onClick={() =>
                  setV((p) => ({
                    ...p,
                    links: p.links.filter((_, j) => j !== i),
                  }))
                }
                className="text-gray-400 hover:text-red-600"
                aria-label="Gỡ liên kết"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <TextInput
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              placeholder="Tên liên kết"
              className="min-w-[160px] flex-1"
            />
            <TextInput
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="min-w-[220px] flex-[2]"
            />
            <Button size="sm" onClick={addLink}>
              Thêm
            </Button>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onCancel}>Hủy</Button>
        {createMode ? (
          <>
            <Button loading={pending} onClick={() => submit("close")}>
              Lưu và đóng
            </Button>
            <Button loading={pending} onClick={() => submit("add")}>
              Lưu và thêm tiếp
            </Button>
            <Button loading={pending} onClick={() => submit("open")}>
              Lưu và mở
            </Button>
          </>
        ) : (
          <Button
            className="rounded-lg bg-slate-900 text-white font-medium shadow-sm transition-all
                      duration-200
                      hover:bg-slate-700
                      hover:shadow-md
                      active:scale-[0.99]
                      disabled:cursor-not-allowed
                      disabled:opacity-60
                    "
            loading={pending}
            onClick={() => submit("close")}
          >
            Lưu thay đổi
          </Button>
        )}
      </div>
    </div>
  );
}
