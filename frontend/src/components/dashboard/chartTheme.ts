/** Shared chart palette + Vietnamese label maps (presentation layer only). */
export const SERIES_COLORS = {
  incoming: '#2563eb',
  outgoing: '#16a34a',
  internal: '#7c3aed',
};

export const SERIES_LABELS: Record<string, string> = {
  incoming: 'Công văn đến',
  outgoing: 'Công văn đi',
  internal: 'Công văn nội bộ',
};

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6b7280',
  APPROVED: '#2563eb',
  PENDING_SIGNATURE: '#d97706',
  ISSUED: '#16a34a',
};

export const LEVEL_COLORS: Record<string, string> = {
  LOW: '#16a34a',
  MEDIUM: '#d97706',
  HIGH: '#dc2626',
};

export const TYPE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#4f46e5', '#a16207', '#6b7280'];

export function shortDate(iso: string): string {
  // 'YYYY-MM-DD' -> 'DD/MM'; 'YYYY-MM' -> 'MM/YYYY'.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  }
  if (/^\d{4}-\d{2}$/.test(iso)) {
    const [y, m] = iso.split('-');
    return `${m}/${y}`;
  }
  return iso;
}
