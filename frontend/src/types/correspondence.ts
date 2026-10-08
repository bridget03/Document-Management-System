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
    partyLabel: 'Đơn vị phát hành *', partyKey: 'sender',
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
  title?: string | null;
  recipient?: string | null;
  sender?: string | null;
  quantity?: number | null;
  signer?: string | null;
  security_level?: string | null;
  urgency_level?: string | null;
  signed_date?: string | null;
  received_date?: string | null;
  effective_date?: string | null;
  expiry_date?: string | null;
  issuing_department?: string | null;
  issuing_office?: string | null;
  issue_date?: string | null;
  document_type_id?: string | null;
  doc_type?: DocType | null;
  processing_status: string;
  notes?: string | null;
  is_important: boolean;
  visibility?: string | null;
  department?: string | null;
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

/** Mức độ BẢO MẬT chỉ còn Thấp / Cao (MEDIUM giữ lại để hiển thị dữ liệu cũ). */
export const SECURITY_OPTIONS = [
  { value: 'LOW', label: 'Thấp' },
  { value: 'HIGH', label: 'Cao' },
];

/** Công văn ĐI bảo mật Cao mặc định chia sẻ: phòng ban phát hành + 4 đơn vị này. */
export const OUTGOING_HIGH_SECURITY_BASE: string[] = [
  'Ban giám đốc',
  'CT - HĐQT',
  'Tổng giám đốc',
  'Phòng Tổ chức hành chính',
];

/** Công văn bảo mật Cao mặc định chia sẻ cho 8 phòng ban này. */
export const HIGH_SECURITY_DEPARTMENTS: string[] = [
  'Ban giám đốc công ty',
  'Ban đầu tư',
  'Phòng kế toán',
  'Hội đồng quản trị',
  'Ban kiểm soát',
  'Phòng tổ chức hành chính',
  'Tổng giám đốc',
  'CT - HĐQT',
];

export const VISIBILITY_OPTIONS = [
  { value: 'ORGANIZATION', label: 'Toàn công ty' },
  { value: 'DEPARTMENT', label: 'Phòng ban' },
  { value: 'PRIVATE', label: 'Riêng tư (chỉ tôi + admin)' },
];

export const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, c]) => ({ value, label: c.label }));

/**
 * 17 công ty trong tập đoàn — danh sách chọn sẵn cho ô "Bộ phận phát hành"
 * của công văn đi (vẫn cho phép nhập tự do nếu phát sinh đơn vị mới).
 */
export const ISSUING_DEPARTMENT_OPTIONS: string[] = [
  'Tổng Công ty đầu tư phát triển Đô Thị - CTCP',
  'Công ty cổ phần đầu tư phát triển Vicenza',
  'Công ty TNHH khai thác và chế biến khoán sản liên doanh Việt Nhật',
  'Công ty cổ phần tập đoàn Westminster Việt Nam',
  'Công ty cổ phần tập đoàn tư vấn xây dựng Kensington Việt Nam',
  'Công ty cổ phần tập đoàn Sentosa Việt Nam',
  'Công ty cổ phần tập đoàn Phúc Thành Invest',
  'Công ty cổ phần tập đoàn Phúc Thịnh Invest',
  'Công ty cổ phần tập đoàn Greenwich Việt Nam',
  'Công ty cổ phần tập đoàn McCarthy việt nam',
  'Công ty cổ phần tập đoàn CasaAmaini việt nam',
  'Công ty cổ phần tập đoàn đầu tư Đại Phúc Hưng Việt Nam',
  'Công ty cổ phần tập đoàn xây dựng Notting Hill Gate Việt Nam',
  'Công ty cổ phần tập đoàn lancaster Việt Nam',
  'Nhà máy gạch men cao cấp Vicenza',
  'Công ty cổ phần tập đoàn AMANI KINGDOM CAPITAL',
  'Công ty cổ phần tập đoàn công nghiệp Kingspalace',
];

/** Bộ cột file mẫu Excel theo từng loại công văn (đúng thứ tự). */
export const TEMPLATE_HEADERS: Record<Direction, string[]> = {
  INCOMING: [
    'Số văn bản', 'Tiêu đề công văn', 'Đơn vị phát hành', 'Đơn vị tiếp nhận',
    'Loại văn bản', 'Mức độ bảo mật', 'Ngày phát hành', 'Ngày tiếp nhận',
    'Ngày hết hiệu lực', 'Ghi chú',
  ],
  OUTGOING: [
    'Số văn bản', 'Tiêu đề công văn', 'Nơi nhận', 'Loại văn bản',
    'Đơn vị phát hành', 'Phòng ban phát hành', 'Mức độ bảo mật', 'Ngày ký',
    'Ngày phát hành', 'Ngày hiệu lực', 'Ngày hết hiệu lực', 'Ghi chú',
  ],
  INTERNAL: [
    'Số văn bản', 'Tiêu đề công văn', 'Bộ phận/người nhận', 'Đơn vị phát hành',
    'Loại văn bản', 'Mức độ bảo mật', 'Ngày ký', 'Ngày phát hành',
    'Ngày hiệu lực', 'Ngày hết hiệu lực', 'Ghi chú',
  ],
};

/** Cột bắt buộc khi upload (mỗi mục là các tên chấp nhận được: tên mới
 *  trước, tên cũ sau — file Excel cũ vẫn import được). */
export const TEMPLATE_REQUIRED: Record<Direction, string[][]> = {
  INCOMING: [
    ['Số văn bản'],
    ['Đơn vị phát hành', 'Nơi gửi'],
    ['Đơn vị tiếp nhận', 'Người ký'],
    ['Loại văn bản'],
  ],
  OUTGOING: [
    ['Số văn bản'],
    ['Nơi nhận'],
    ['Loại văn bản'],
    ['Đơn vị phát hành', 'Bộ phận phát hành'],
  ],
  INTERNAL: [
    ['Số văn bản'],
    ['Bộ phận/người nhận', 'Nơi nhận'],
    ['Đơn vị phát hành', 'Bộ phận phát hành'],
    ['Loại văn bản'],
  ],
};

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

/** Normalize one Excel row (by header, new + legacy names) into API field shape. */
export function normalizeExcelRow(raw: Record<string, unknown>, direction: Direction): Record<string, unknown> {
  // Lấy ô đầu tiên khác rỗng trong danh sách tên cột (tên mới trước, tên cũ sau).
  const pick = (...names: string[]): unknown => {
    for (const n of names) {
      const v = raw[n];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return undefined;
  };
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
  out.document_number = str(pick('Số văn bản'));
  out.title = str(pick('Tiêu đề công văn'));
  // Nơi nhận/nơi gửi/phòng ban: chấp nhận phẩy (,), chấm phẩy (;) hoặc
  // xuống dòng, chuẩn hoá về dạng lưu trữ "A; B; C".
  const multi = (v: unknown) => {
    const s = str(v);
    if (!s) return undefined;
    const list = s
      .split(/[;,\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    return list.length > 0 ? list.join('; ') : undefined;
  };
  out.recipient = multi(pick('Nơi nhận', 'Bộ phận/người nhận'));
  // "Đơn vị phát hành" là sender (đến) hoặc đơn vị phát hành (đi/nội bộ).
  out.sender = direction === 'INCOMING'
    ? multi(pick('Đơn vị phát hành', 'Nơi gửi'))
    : multi(pick('Nơi gửi'));
  out.quantity = num(pick('Số lượng văn bản'));
  out.signer = str(pick('Đơn vị tiếp nhận', 'Người ký'));
  if (pick('Mức độ bảo mật') !== undefined) {
    const key = normVi(String(pick('Mức độ bảo mật')));
    out.security_level = VI_LEVEL[key] || String(pick('Mức độ bảo mật')).trim().toUpperCase();
  }
  if (pick('Mức độ khẩn cấp') !== undefined) {
    const key = normVi(String(pick('Mức độ khẩn cấp')));
    out.urgency_level = VI_LEVEL[key] || String(pick('Mức độ khẩn cấp')).trim().toUpperCase();
  }
  out.signed_date = dt(pick('Ngày ký'));
  out.received_date = dt(pick('Ngày tiếp nhận'));
  out.effective_date = dt(pick('Ngày hiệu lực'));
  out.expiry_date = dt(pick('Ngày hết hiệu lực'));
  out.issuing_department = direction === 'INCOMING'
    ? undefined
    : str(pick('Đơn vị phát hành', 'Bộ phận phát hành'));
  out.issuing_office = str(pick('Phòng ban phát hành'));
  out.issue_date = dt(pick('Ngày phát hành'));
  out.document_type = str(pick('Loại văn bản'));
  if (pick('Tình trạng xử lý') !== undefined) {
    const key = normVi(String(pick('Tình trạng xử lý')));
    out.processing_status = VI_STATUS[key] || String(pick('Tình trạng xử lý')).trim().toUpperCase();
  }
  out.notes = str(pick('Ghi chú'));
  const linkUrl = str(pick('Liên kết tệp'));
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
  if (direction === 'INCOMING' && !data.sender) errs.push('Đơn vị phát hành không được để trống.');
  if (!data.signer && direction === 'INCOMING') errs.push('Vui lòng nhập đơn vị tiếp nhận.');
  if (!data.document_type_id) errs.push('Vui lòng chọn loại văn bản.');
  if (direction !== 'INCOMING' && !data.issuing_department) errs.push('Vui lòng nhập bộ phận phát hành.');
  return errs;
}

/** Tách chuỗi nơi nhận/nơi gửi "A, B; C" thành list để hiển thị chip. */
/** Dấu phân tách: phẩy (,), chấm phẩy (;) hoặc xuống dòng. Lưu trữ dạng "A; B; C". */
export function splitPartyList(s?: string | null): string[] {
  return (s || '')
    .split(/[;,\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Tách chuỗi phòng ban chia sẻ "Kế toán; Nhân sự" thành list. Dùng chung quy ước "; ". */
export function splitDeptList(s?: string | null): string[] {
  return splitPartyList(s);
}

export function joinDeptList(list: string[]): string {
  return list.join('; ');
}

export function fmtDateVN(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  if (isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
