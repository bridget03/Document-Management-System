export type Direction = 'INCOMING' | 'OUTGOING' | 'INTERNAL';
export type ApiDir = 'incoming' | 'outgoing' | 'internal';

export interface DirectionConfig {
  api: ApiDir;
  /** "Văn bản đến" */
  title: string;
  /** "đến" — dùng trong câu ("Nhập văn bản ... từ Excel") */
  short: string;
  /** "Nơi gửi *" */
  partyLabel: string;
  partyKey: 'recipient' | 'sender';
  /** Tên file template Excel */
  templateFile: string;
  /** Giá trị mẫu cho cột đối tác trong template */
  sampleParty: string;
}

export const DIRECTION_CONFIG: Record<Direction, DirectionConfig> = {
  INCOMING: {
    api: 'incoming', title: 'Văn bản đến', short: 'đến',
    partyLabel: 'Nơi gửi *', partyKey: 'sender',
    templateFile: 'Mau_nhap_van_ban_den.xlsx', sampleParty: 'Sở XYZ',
  },
  OUTGOING: {
    api: 'outgoing', title: 'Văn bản đi', short: 'đi',
    partyLabel: 'Nơi nhận *', partyKey: 'recipient',
    templateFile: 'Mau_nhap_van_ban_di.xlsx', sampleParty: 'Công ty ABC',
  },
  INTERNAL: {
    api: 'internal', title: 'Văn bản nội bộ', short: 'nội bộ',
    partyLabel: 'Bộ phận/người nhận *', partyKey: 'recipient',
    templateFile: 'Mau_nhap_van_ban_noi_bo.xlsx', sampleParty: 'Phòng Kế toán',
  },
};

export interface DocType {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: string;
  default_signer?: string | null;
}

export interface CorrLink {
  id: string;
  name: string;
  url: string;
}

export interface CorrAttachment {
  id: string;
  document_id: string;
  document?: {
    id: string;
    name: string;
    mime_type?: string | null;
    file_extension?: string | null;
    file_size?: number | null;
    source: string;
  } | null;
}

export interface CorrDoc {
  id: string;
  direction: string;
  document_number: string;
  recipient?: string | null;
  sender?: string | null;
  quantity?: number | null;
  signer?: string | null;
  security_level?: string | null;
  urgency_level?: string | null;
  signed_date?: string | null;
  effective_date?: string | null;
  expiry_date?: string | null;
  issuing_department?: string | null;
  issue_date?: string | null;
  document_type_id?: string | null;
  doc_type?: DocType | null;
  processing_status: string;
  notes?: string | null;
  created_by?: string | null;
  creator?: { id: string; name: string } | null;
  attachments: CorrAttachment[];
  links: CorrLink[];
  created_at: string;
  updated_at: string;
}

export interface PaginatedCorr {
  items: CorrDoc[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export const STATUS_CONFIG: Record<string, { label: string; tone: 'neutral' | 'success' | 'warning' | 'info' }> = {
  DRAFT: { label: 'Dự thảo', tone: 'neutral' },
  APPROVED: { label: 'Đã duyệt', tone: 'info' },
  PENDING_SIGNATURE: { label: 'Trình ký', tone: 'warning' },
  ISSUED: { label: 'Phát hành', tone: 'success' },
};

export const LEVEL_LABELS: Record<string, string> = { LOW: 'Thấp', MEDIUM: 'Trung bình', HIGH: 'Cao' };

export const LEVEL_OPTIONS = [
  { value: 'LOW', label: 'Thấp' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'HIGH', label: 'Cao' },
];

export const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, c]) => ({ value, label: c.label }));

/** Excel Vietnamese header -> field key (import + template). */
export const EXCEL_HEADERS: { header: string; key: string }[] = [
  { header: 'Số văn bản', key: 'document_number' },
  { header: 'Nơi nhận', key: 'recipient' },
  { header: 'Nơi gửi', key: 'sender' },
  { header: 'Số lượng văn bản', key: 'quantity' },
  { header: 'Người ký', key: 'signer' },
  { header: 'Mức độ bảo mật', key: 'security_level' },
  { header: 'Ngày ký', key: 'signed_date' },
  { header: 'Mức độ khẩn cấp', key: 'urgency_level' },
  { header: 'Ngày hiệu lực', key: 'effective_date' },
  { header: 'Ngày hết hiệu lực', key: 'expiry_date' },
  { header: 'Bộ phận phát hành', key: 'issuing_department' },
  { header: 'Ngày phát hành', key: 'issue_date' },
  { header: 'Loại văn bản', key: 'document_type' },
  { header: 'Tình trạng xử lý', key: 'processing_status' },
  { header: 'Ghi chú', key: 'notes' },
  { header: 'Liên kết tệp', key: 'link_url' },
];

const VI_LEVEL: Record<string, string> = {
  'thấp': 'LOW', 'thap': 'LOW',
  'trung bình': 'MEDIUM', 'trung binh': 'MEDIUM',
  'cao': 'HIGH',
};

const VI_STATUS: Record<string, string> = {
  'dự thảo': 'DRAFT', 'du thao': 'DRAFT',
  'đã duyệt': 'APPROVED', 'da duyet': 'APPROVED',
  'trình ký': 'PENDING_SIGNATURE', 'trinh ky': 'PENDING_SIGNATURE',
  'phát hành': 'ISSUED', 'phat hanh': 'ISSUED',
};

function normVi(s: string): string {
  return s.normalize('NFC').trim().toLowerCase();
}

/** Normalize one Excel row (by header) into API field shape. */
export function normalizeExcelRow(raw: Record<string, unknown>, direction: Direction): Record<string, unknown> {
  const byKey: Record<string, unknown> = {};
  for (const { header, key } of EXCEL_HEADERS) {
    const v = raw[header];
    if (v !== undefined && v !== null && String(v).trim() !== '') byKey[key] = v;
  }
  // Alias cho template nội bộ: "Bộ phận/người nhận" -> recipient.
  const alias = raw['Bộ phận/người nhận'];
  if (byKey.recipient === undefined && alias !== undefined && alias !== null && String(alias).trim() !== '') {
    byKey.recipient = alias;
  }
  const out: Record<string, unknown> = {};
  const str = (v: unknown) => (v === undefined || v === null ? undefined : String(v).trim() || undefined);
  const num = (v: unknown) => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : v;
  };
  const dt = (v: unknown): string | unknown => {
    if (v === undefined || v === null || v === '') return undefined;
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
    const s = String(v).trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return s.slice(0, 10);
  };
  out.document_number = str(byKey.document_number);
  out.recipient = str(byKey.recipient);
  out.sender = str(byKey.sender);
  out.quantity = num(byKey.quantity);
  out.signer = str(byKey.signer);
  if (byKey.security_level !== undefined) {
    const key = normVi(String(byKey.security_level));
    out.security_level = VI_LEVEL[key] || String(byKey.security_level).trim().toUpperCase();
  }
  if (byKey.urgency_level !== undefined) {
    const key = normVi(String(byKey.urgency_level));
    out.urgency_level = VI_LEVEL[key] || String(byKey.urgency_level).trim().toUpperCase();
  }
  out.signed_date = dt(byKey.signed_date);
  out.effective_date = dt(byKey.effective_date);
  out.expiry_date = dt(byKey.expiry_date);
  out.issuing_department = str(byKey.issuing_department);
  out.issue_date = dt(byKey.issue_date);
  out.document_type = str(byKey.document_type);
  if (byKey.processing_status !== undefined) {
    const key = normVi(String(byKey.processing_status));
    out.processing_status = VI_STATUS[key] || String(byKey.processing_status).trim().toUpperCase();
  }
  out.notes = str(byKey.notes);
  const linkUrl = str(byKey.link_url);
  if (linkUrl) out.links = [{ name: 'Liên kết tệp', url: linkUrl }];
  // Drop undefined keys so the payload stays clean.
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
}

/** Client-side required check mirroring backend (server revalidates everything). */
export function validateRowClient(data: Record<string, unknown>, direction: Direction): string[] {
  const errs: string[] = [];
  if (!data.document_number) errs.push('Số văn bản không được để trống.');
  if (direction !== 'INCOMING' && !data.recipient)
    errs.push(direction === 'INTERNAL' ? 'Bộ phận/người nhận không được để trống.' : 'Nơi nhận không được để trống.');
  if (direction === 'INCOMING' && !data.sender) errs.push('Nơi gửi không được để trống.');
  if (!data.signer) errs.push('Vui lòng chọn/nhập người ký.');
  if (!data.document_type_id) errs.push('Vui lòng chọn loại văn bản.');
  if (!data.issuing_department) errs.push('Vui lòng nhập bộ phận phát hành.');
  return errs;
}

export function fmtDateVN(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  if (isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
