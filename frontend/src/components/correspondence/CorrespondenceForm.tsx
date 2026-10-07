import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, X, Link2, FileUp } from "lucide-react";
import Button from "../ui/Button";
import { IconButton, LinkButton } from "../ui/Button";
import { TextInput, TextArea, Select, Field } from "../ui/Input";
import { useToast } from "../ui/Toast";
import { uploadDocument } from "../../services/documentApi";
import { listDocTypes } from "../../services/correspondenceApi";
import { listDepartments } from "../../services/departmentApi";
import type { Department } from "../../types/department";
import { listReceivingUnits } from "../../services/receivingUnitApi";
import type { ReceivingUnit } from "../../types/receivingUnit";
import {
  LEVEL_OPTIONS,
  SECURITY_OPTIONS,
  HIGH_SECURITY_DEPARTMENTS,
  OUTGOING_HIGH_SECURITY_BASE,
  DIRECTION_CONFIG,
  VISIBILITY_OPTIONS,
  ISSUING_DEPARTMENT_OPTIONS,
  joinDeptList,
  type CorrDoc,
  type Direction,
  type DocType,
} from "../../types/correspondence";

export interface CorrFormValue {
  document_number: string;
  title: string;
  recipient: string;
  sender: string;
  quantity: string;
  signer: string;
  security_level: string;
  urgency_level: string;
  signed_date: string;
  received_date: string;
  effective_date: string;
  expiry_date: string;
  issuing_department: string;
  issuing_office: string;
  issue_date: string;
  document_type_id: string;
  processing_status: string;
  notes: string;
  is_important: boolean;
  visibility: string;
  department: string;
  attachment_ids: { document_id: string; name: string }[];
  links: { name: string; url: string }[];
}

interface Props {
  direction: Direction;
  initial?: CorrDoc | null;
  pending: boolean;
  serverError: string;
  createMode: boolean;
  /** Đến = single (1 nơi gửi), Đi/Nội bộ = multiple. Mặc định: INCOMING=false, còn lại=true. */
  multipleParty?: boolean;
  onSubmit: (value: CorrFormValue, and: "close" | "add" | "open") => void;
  onCancel: () => void;
}

const empty: CorrFormValue = {
  document_number: "",
  title: "",
  recipient: "",
  sender: "",
  quantity: "",
  signer: "",
  security_level: "",
  urgency_level: "",
  signed_date: "",
  received_date: "",
  effective_date: "",
  expiry_date: "",
  issuing_department: "",
  issuing_office: "",
  issue_date: "",
  document_type_id: "",
  processing_status: "DRAFT",
  notes: "",
  is_important: false,
  visibility: "ORGANIZATION",
  department: "",
  attachment_ids: [],
  links: [],
};

/** Nhiều nơi nhận/nơi gửi lưu chung 1 chuỗi, phân cách bằng "; ". */
export function splitParty(s: string): string[] {
  return (s || "")
    .split(/[;,\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function joinParty(list: string[]): string {
  return list.join("; ");
}

function toValue(d: CorrDoc): CorrFormValue {
  return {
    document_number: d.document_number,
    title: d.title || "",
    recipient: d.recipient || "",
    sender: d.sender || "",
    quantity:
      d.quantity !== null && d.quantity !== undefined ? String(d.quantity) : "",
    signer: d.signer || "",
    security_level: d.security_level || "",
    urgency_level: d.urgency_level || "",
    signed_date: d.signed_date || "",
    received_date: d.received_date || "",
    effective_date: d.effective_date || "",
    expiry_date: d.expiry_date || "",
    issuing_department: d.issuing_department || "",
    issuing_office: d.issuing_office || "",
    issue_date: d.issue_date || "",
    document_type_id: d.document_type_id || "",
    processing_status: d.processing_status,
    notes: d.notes || "",
    is_important: !!d.is_important,
    visibility: d.visibility || "ORGANIZATION",
    department: d.department || "",
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
  multipleParty,
  onSubmit,
  onCancel,
}: Props) {
  const { toast } = useToast();
  const [v, setV] = useState<CorrFormValue>(empty);
  const [errors, setErrors] = useState<string[]>([]);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [partyInput, setPartyInput] = useState("");
  const [deptInput, setDeptInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const { data: types } = useQuery<DocType[]>({
    queryKey: ["corr-types-active"],
    queryFn: () => listDocTypes(true),
  });
  const { data: deptOptions } = useQuery<Department[]>({
    queryKey: ["departments-active"],
    queryFn: () => listDepartments(true),
  });
  const { data: receivingUnits } = useQuery<ReceivingUnit[]>({
    queryKey: ["receiving-units-active"],
    queryFn: () => listReceivingUnits(true),
    enabled: direction === "INCOMING",
  });

  useEffect(() => {
    setV(initial ? toValue(initial) : empty);
    setErrors([]);
    setPartyInput("");
    setDeptInput("");
  }, [initial]);

  const set = (k: keyof CorrFormValue, val: string) =>
    setV((p) => ({ ...p, [k]: val }));

  // Chọn bảo mật Cao => tự đặt phạm vi DEPARTMENT + danh sách mặc định
  // (đi: phòng ban phát hành + 4 đơn vị; còn lại: 8 phòng ban).
  // User vẫn sửa được ở phần Chia sẻ sau đó.
  const onSecurityChange = (val: string) =>
    setV((p) => {
      if (val !== "HIGH") return { ...p, security_level: val };
      const base =
        isOutgoing && p.issuing_office.trim()
          ? [p.issuing_office.trim(), ...OUTGOING_HIGH_SECURITY_BASE]
          : isOutgoing
            ? [...OUTGOING_HIGH_SECURITY_BASE]
            : [...HIGH_SECURITY_DEPARTMENTS];
      return {
        ...p,
        security_level: val,
        visibility: "DEPARTMENT",
        department: joinDeptList(base),
      };
    });

  const partyLabel = DIRECTION_CONFIG[direction].partyLabel;
  const partyKey = DIRECTION_CONFIG[direction].partyKey;
  // Riêng công văn đến: form rút gọn (nhập tay số văn bản, không số lượng /
  // bộ phận phát hành / tình trạng xử lý, thêm tiêu đề + ngày tiếp nhận).
  // Riêng công văn đi (ngoài): nhập tay số văn bản, không người ký / số lượng /
  // mức khẩn cấp / tình trạng xử lý, thêm tiêu đề + phòng ban phát hành.
  const isIncoming = direction === "INCOMING";
  const isOutgoing = direction === "OUTGOING";
  const signerLabel = isIncoming ? "Đơn vị tiếp nhận *" : "Người ký *";
  // Công văn đến: chỉ 1 đơn vị phát hành -> ô text đơn.
  // Công văn nội bộ: chọn 1 đơn vị từ dropdown phòng ban.
  // Đi: nhiều nơi -> chip tag.
  const allowMultiple = multipleParty ?? (direction !== "INCOMING" && direction !== "INTERNAL");
  const partyList = allowMultiple ? splitParty(v[partyKey]) : [];

  const addParty = (raw?: string) => {
    const src = raw !== undefined ? raw : partyInput;
    // Cho phép paste "A, B; C" hoặc mỗi dòng 1 nơi nhận.
    const parts = src
      .split(/[;,\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setV((p) => {
      const cur = splitParty(p[partyKey]);
      const seen = new Set(cur.map((s) => s.toLowerCase()));
      const next = [...cur];
      for (const t of parts) {
        if (!seen.has(t.toLowerCase())) {
          next.push(t);
          seen.add(t.toLowerCase());
        }
      }
      return { ...p, [partyKey]: joinParty(next) };
    });
    setPartyInput("");
  };

  const removeParty = (idx: number) => {
    setV((p) => {
      const cur = splitParty(p[partyKey]);
      cur.splice(idx, 1);
      return { ...p, [partyKey]: joinParty(cur) };
    });
  };

  const deptList = splitParty(v.department);

  const addDept = (raw?: string) => {
    const src = raw !== undefined ? raw : deptInput;
    const parts = src
      .split(/[;,\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setV((p) => {
      const cur = splitParty(p.department);
      const seen = new Set(cur.map((s) => s.toLowerCase()));
      const next = [...cur];
      for (const t of parts) {
        if (!seen.has(t.toLowerCase())) {
          next.push(t);
          seen.add(t.toLowerCase());
        }
      }
      return { ...p, department: joinParty(next) };
    });
    setDeptInput("");
  };

  const removeDept = (idx: number) => {
    setV((p) => {
      const cur = splitParty(p.department);
      cur.splice(idx, 1);
      return { ...p, department: joinParty(cur) };
    });
  };

  // Dropdown "Đơn vị tiếp nhận" (văn bản đến) dùng danh mục đơn vị tiếp nhận.
  // Giữ lại giá trị cũ nếu không còn trong danh mục để không mất dữ liệu khi sửa.
  const unitNames = (receivingUnits || []).map((u) => u.name);
  const signerOptions =
    v.signer && !unitNames.includes(v.signer)
      ? [...unitNames, v.signer]
      : unitNames;

  // Dropdown "Bộ phận phát hành" (văn bản nội bộ): chọn tên công ty,
  // giữ giá trị cũ nếu không còn trong danh sách.
  const companyOptions =
    v.issuing_department &&
    !ISSUING_DEPARTMENT_OPTIONS.includes(v.issuing_department)
      ? [...ISSUING_DEPARTMENT_OPTIONS, v.issuing_department]
      : [...ISSUING_DEPARTMENT_OPTIONS];
  // Dropdown "Phòng ban phát hành" (văn bản đi) dùng danh mục phòng ban.
  const officeOptions = (deptOptions || []).map((d) => d.name);
  // Dropdown đơn vị nhận (văn bản nội bộ), giữ giá trị cũ nếu không còn
  // trong danh mục để không mất dữ liệu khi sửa.
  const internalRecipientOptions =
    v.recipient && !officeOptions.includes(v.recipient)
      ? [...officeOptions, v.recipient]
      : officeOptions;

  // Phòng ban đã khai báo (Cấu hình → Phòng ban) chưa được chọn.
  const deptAdded = new Set(deptList.map((s) => s.toLowerCase()));
  const deptSuggestions = (deptOptions || [])
    .map((d) => d.name)
    .filter((n) => !deptAdded.has(n.toLowerCase()));

  const onTypeChange = (id: string) => {
    setV((p) => {
      const t = (types || []).find((x) => x.id === id);
      const signer =
        !p.signer && t?.default_signer ? t.default_signer : p.signer;
      return { ...p, document_type_id: id, signer };
    });
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
    let normalized = { ...v };
    // Gộp tag phòng ban đang gõ dở (nếu quên Enter).
    const pendingDepts = deptInput
      .split(/[;,\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const mergeDepts = (base: string) => {
      const cur = splitParty(base);
      const seen = new Set(cur.map((s) => s.toLowerCase()));
      for (const t of pendingDepts) {
        if (!seen.has(t.toLowerCase())) {
          cur.push(t);
          seen.add(t.toLowerCase());
        }
      }
      return joinParty(cur);
    };
    if (allowMultiple) {
      // Gộp input nơi nhận đang gõ dở (nếu user quên Enter) rồi chuẩn hoá "; ".
      const pendingParts = partyInput
        .split(/[;,\n]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      if (pendingParts.length > 0) {
        const cur = splitParty(v[partyKey]);
        const seen = new Set(cur.map((s) => s.toLowerCase()));
        for (const t of pendingParts) {
          if (!seen.has(t.toLowerCase())) {
            cur.push(t);
            seen.add(t.toLowerCase());
          }
        }
        normalized = { ...v, [partyKey]: joinParty(cur) };
        setV(normalized);
        setPartyInput("");
      } else {
        // Chuẩn hoá khoảng trắng / dấu ;; thừa.
        normalized = {
          ...v,
          recipient: joinParty(splitParty(v.recipient)),
          sender: joinParty(splitParty(v.sender)),
        };
      }
    } else {
      // Single: chỉ trim, giữ nguyên 1 giá trị (công văn đến - nơi gửi).
      normalized = {
        ...v,
        recipient: v.recipient.trim(),
        sender: v.sender.trim(),
      };
    }
    // Chuẩn hoá phòng ban chia sẻ (luôn multi).
    if (pendingDepts.length > 0) {
      normalized = { ...normalized, department: mergeDepts(normalized.department) };
      setV(normalized);
      setDeptInput("");
    } else {
      normalized = {
        ...normalized,
        department: joinParty(splitParty(normalized.department)),
      };
    }
    // Văn bản nội bộ không có Riêng tư: ép về Toàn công ty nếu còn sót.
    if (direction === "INTERNAL" && normalized.visibility === "PRIVATE") {
      normalized = { ...normalized, visibility: "ORGANIZATION" };
    }
    const errs: string[] = [];
    if (!normalized.document_number.trim())
      errs.push("Số văn bản không được để trống.");
    if (direction !== "INCOMING" && !normalized.recipient.trim())
      errs.push(
        direction === "INTERNAL"
          ? "Vui lòng chọn đơn vị nhận."
          : "Nơi nhận không được để trống."
      );
    if (direction === "INCOMING" && !normalized.sender.trim())
      errs.push("Đơn vị phát hành không được để trống.");
    if (isIncoming && !normalized.signer.trim())
      errs.push("Vui lòng nhập đơn vị tiếp nhận.");
    if (!normalized.document_type_id) errs.push("Vui lòng chọn loại văn bản.");
    if (!isIncoming && !normalized.issuing_department.trim())
      errs.push(
        isOutgoing
          ? "Vui lòng nhập đơn vị phát hành."
          : "Vui lòng nhập bộ phận phát hành.",
      );
    if (
      normalized.effective_date &&
      normalized.expiry_date &&
      normalized.effective_date > normalized.expiry_date
    )
      errs.push("Ngày hiệu lực phải trước hoặc bằng ngày hết hiệu lực.");
    if (normalized.visibility === "DEPARTMENT" && !normalized.department.trim())
      errs.push("Chia sẻ theo phòng ban thì phải nhập phòng ban.");
    if (normalized.visibility === "DEPARTMENT" && normalized.department.length > 255)
      errs.push("Danh sách phòng ban quá dài (tối đa 255 ký tự). Hãy rút gọn.");
    if (
      normalized.recipient.length > 500 ||
      normalized.sender.length > 500
    )
      errs.push("Nơi nhận/nơi gửi quá dài (tối đa 500 ký tự). Hãy rút gọn.");
    setErrors(errs);
    if (errs.length > 0) return;
    onSubmit(normalized, and);
  };

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
            <TextInput
              value={v.document_number}
              onChange={(e) => set("document_number", e.target.value)}
              placeholder="CV001/2026/VICENZA"
            />
          </Field>
          <Field label="Tiêu đề công văn">
            <TextInput
              value={v.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="VD: V/v nghỉ lễ Quốc khánh"
            />
          </Field>
          <Field label={partyLabel}>
            {direction === "INTERNAL" ? (
              <Select
                value={v.recipient}
                onChange={(e) => set("recipient", e.target.value)}
              >
                <option value="">— Chọn đơn vị nhận —</option>
                {internalRecipientOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            ) : allowMultiple ? (
              <>
                <div className="rounded-md border border-gray-300 px-2 py-1.5 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
              {partyList.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {partyList.map((p, i) => (
                    <span
                      key={`${p}-${i}`}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-200"
                    >
                      <span className="max-w-[220px] truncate" title={p}>
                        {p}
                      </span>
                      <button
                        type="button"
                        aria-label={`Xóa ${p}`}
                        className="rounded-full p-0.5 hover:bg-brand-100"
                        onClick={() => removeParty(i)}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={partyInput}
                  onChange={(e) => setPartyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ";" || e.key === ",") {
                      e.preventDefault();
                      addParty();
                    } else if (
                      e.key === "Backspace" &&
                      !partyInput &&
                      partyList.length > 0
                    ) {
                      removeParty(partyList.length - 1);
                    }
                  }}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    if (/[;,\n]/.test(text)) {
                      e.preventDefault();
                      addParty(text);
                    }
                  }}
                  placeholder="Nhập từng nơi nhận rồi Enter — VD: Công ty ABC"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => addParty()}
                  disabled={!partyInput.trim()}
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-40"
                >
                  Thêm
                </button>
              </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Có nhiều nơi nhận thì nhập từng nơi rồi Enter (hoặc gõ dấu
                  phẩy). Có thể paste danh sách cách nhau bằng dấu phẩy, chấm
                  phẩy hoặc xuống dòng. Lưu trữ dạng “A; B; C”
                  {partyList.length > 0 && ` — đã nhập ${partyList.length} nơi.`}
                </p>
              </>
            ) : (
              <TextInput
                value={v[partyKey]}
                onChange={(e) => set(partyKey, e.target.value)}
                placeholder="VD: Sở XYZ"
              />
            )}
          </Field>
          {isIncoming && (
            <Field label={signerLabel}>
              {isIncoming ? (
                <Select
                  value={v.signer}
                  onChange={(e) => set("signer", e.target.value)}
                >
                  <option value="">— Chọn đơn vị tiếp nhận —</option>
                  {signerOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              ) : (
                <TextInput
                  value={v.signer}
                  onChange={(e) => set("signer", e.target.value)}
                  placeholder="Nguyễn Văn A"
                />
              )}
            </Field>
          )}
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
          {!isIncoming && !isOutgoing && (
            <Field label="Bộ phận phát hành *">
              <Select
                value={v.issuing_department}
                onChange={(e) => set("issuing_department", e.target.value)}
              >
                <option value="">— Chọn công ty —</option>
                {companyOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {isOutgoing && (
            <Field label="Đơn vị phát hành *">
              <TextInput
                value={v.issuing_department}
                onChange={(e) => set("issuing_department", e.target.value)}
                placeholder="VD: Tổng Công ty đầu tư phát triển Đô Thị - CTCP"
                list="issuing-department-options"
                autoComplete="off"
              />
              <datalist id="issuing-department-options">
                {ISSUING_DEPARTMENT_OPTIONS.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </Field>
          )}
          {isOutgoing && (
            <Field label="Phòng ban phát hành">
              <Select
                value={v.issuing_office}
                onChange={(e) => set("issuing_office", e.target.value)}
              >
                <option value="">— Chọn phòng ban —</option>
                {officeOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div className="flex items-center sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100">
              <input
                type="checkbox"
                checked={v.is_important}
                onChange={(e) =>
                  setV((p) => ({ ...p, is_important: e.target.checked }))
                }
                className="h-4 w-4 accent-red-600"
              />
              Đánh dấu công văn quan trọng
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Mức độ</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-gray-700">Mức độ bảo mật</p>
            <div className="mt-1.5 flex gap-4 text-sm">
              {SECURITY_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className="flex cursor-pointer items-center gap-1.5"
                >
                  <input
                    type="radio"
                    name="security"
                    checked={v.security_level === o.value}
                    onChange={() => onSecurityChange(o.value)}
                  />
                  {o.label}
                </label>
              ))}
              {v.security_level && (
                <LinkButton tone="muted" underline onClick={() => set("security_level", "")}>
                  Xóa
                </LinkButton>
              )}
            </div>
            {v.security_level === "HIGH" && (
              <p className="mt-1.5 text-xs text-amber-700">
                {isOutgoing ? (
                  <>
                    Bảo mật Cao: tự chia sẻ cho phòng ban phát hành, Ban giám
                    đốc, CT - HĐQT, Tổng giám đốc, Phòng Tổ chức hành chính.
                    Có thể sửa danh sách ở phần Chia sẻ.
                  </>
                ) : (
                  <>
                    Bảo mật Cao: tự chia sẻ cho 8 phòng ban mặc định (Ban giám
                    đốc công ty, Ban đầu tư, Phòng kế toán, Hội đồng quản trị,
                    Ban kiểm soát, Phòng tổ chức hành chính, Tổng giám đốc,
                    CT - HĐQT). Có thể sửa danh sách ở phần Chia sẻ.
                  </>
                )}
              </p>
            )}
          </div>
          {!isOutgoing && (
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
                  <LinkButton tone="muted" underline onClick={() => set("urgency_level", "")}>
                    Xóa
                  </LinkButton>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Chia sẻ</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Phạm vi chia sẻ">
            <Select
              value={v.visibility}
              onChange={(e) => set("visibility", e.target.value)}
            >
              {VISIBILITY_OPTIONS.filter(
                (o) => direction !== "INTERNAL" || o.value !== "PRIVATE",
              ).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          {v.visibility === "DEPARTMENT" && (
            <Field label="Phòng ban *">
              <div className="rounded-md border border-gray-300 px-2 py-1.5 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
                {deptList.length > 0 && (
                  <div className="mb-1.5 flex flex-wrap gap-1.5">
                    {deptList.map((d, i) => (
                      <span
                        key={`${d}-${i}`}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-200"
                      >
                        <span className="max-w-[220px] truncate" title={d}>
                          {d}
                        </span>
                        <button
                          type="button"
                          aria-label={`Xóa phòng ban ${d}`}
                          className="rounded-full p-0.5 hover:bg-brand-100"
                          onClick={() => removeDept(i)}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={deptInput}
                    onChange={(e) => setDeptInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ";" || e.key === ",") {
                        e.preventDefault();
                        addDept();
                      } else if (
                        e.key === "Backspace" &&
                        !deptInput &&
                        deptList.length > 0
                      ) {
                        removeDept(deptList.length - 1);
                      }
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (/[;,\n]/.test(text)) {
                        e.preventDefault();
                        addDept(text);
                      }
                    }}
                    placeholder="Nhập từng phòng ban rồi Enter — VD: Kế toán"
                    list="dept-suggestions"
                    autoComplete="off"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => addDept()}
                    disabled={!deptInput.trim()}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-40"
                  >
                    Thêm
                  </button>
                </div>
                <datalist id="dept-suggestions">
                  {deptSuggestions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                {deptSuggestions.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-gray-400">Chọn nhanh:</span>
                    {deptSuggestions.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => addDept(name)}
                        title={`Thêm ${name}`}
                        className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700"
                      >
                        + {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Chia sẻ cho nhiều phòng ban thì bấm chọn nhanh hoặc nhập từng
                phòng ban rồi Enter. Khai báo danh sách tại{" "}
                <Link
                  to="/departments"
                  className="font-medium text-brand-700 hover:underline"
                >
                  Cấu hình → Phòng ban
                </Link>
                {deptList.length > 0 && ` — đã nhập ${deptList.length} phòng ban.`}
              </p>
            </Field>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Thời gian</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {!isIncoming && (
            <Field label="Ngày ký">
              <TextInput
                type="date"
                value={v.signed_date}
                onChange={(e) => set("signed_date", e.target.value)}
              />
            </Field>
          )}
          <Field label="Ngày phát hành">
            <TextInput
              type="date"
              value={v.issue_date}
              onChange={(e) => set("issue_date", e.target.value)}
            />
          </Field>
          {isIncoming && (
            <Field label="Ngày tiếp nhận">
              <TextInput
                type="date"
                value={v.received_date}
                onChange={(e) => set("received_date", e.target.value)}
              />
            </Field>
          )}
          {!isIncoming && (
            <Field label="Ngày hiệu lực">
              <TextInput
                type="date"
                value={v.effective_date}
                onChange={(e) => set("effective_date", e.target.value)}
              />
            </Field>
          )}
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
        <h2 className="text-sm font-semibold text-gray-900">Ghi chú</h2>
        <div className="mt-2">
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
              <IconButton
                label={`Gỡ ${a.name}`}
                tone="danger"
                iconSize="sm"
                onClick={() =>
                  setV((p) => ({
                    ...p,
                    attachment_ids: p.attachment_ids.filter(
                      (x) => x.document_id !== a.document_id,
                    ),
                  }))
                }
              >
                <X size={14} />
              </IconButton>
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
              <IconButton
                label="Gỡ liên kết"
                tone="danger"
                iconSize="sm"
                onClick={() =>
                  setV((p) => ({
                    ...p,
                    links: p.links.filter((_, j) => j !== i),
                  }))
                }
              >
                <X size={14} />
              </IconButton>
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
            <Button variant="primary" loading={pending} onClick={() => submit("close")}>
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
          <Button loading={pending}
            onClick={() => submit("close")}
          >
            Lưu thay đổi
          </Button>
        )}
      </div>
    </div>
  );
}
