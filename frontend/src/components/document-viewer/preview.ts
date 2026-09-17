import type { Document } from '../../types/document';

export type PreviewType =
  | 'pdf'
  | 'image'
  | 'text'
  | 'csv'
  | 'spreadsheet'
  | 'docx'
  | 'unsupported';

const NATIVE_GOOGLE_MIMES = new Set([
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'application/vnd.google-apps.drawing',
  'application/vnd.google-apps.form',
]);

/** Native types the backend exports to PDF for preview (Forms excluded). */
const EXPORTABLE_NATIVE_MIMES = new Set([
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'application/vnd.google-apps.drawing',
]);

const NATIVE_LABELS: Record<string, string> = {
  'application/vnd.google-apps.document': 'Google Docs',
  'application/vnd.google-apps.spreadsheet': 'Google Sheets',
  'application/vnd.google-apps.presentation': 'Google Slides',
  'application/vnd.google-apps.drawing': 'Google Drawing',
  'application/vnd.google-apps.form': 'Google Form',
};

/** Decide which viewer to use from stored metadata only (no fetch). */
export function getPreviewType(doc: Pick<Document, 'file_extension' | 'mime_type'>): PreviewType {
  if (doc.mime_type && EXPORTABLE_NATIVE_MIMES.has(doc.mime_type)) return 'pdf';
  if (doc.mime_type && NATIVE_GOOGLE_MIMES.has(doc.mime_type)) return 'unsupported';
  const ext = (doc.file_extension || '').toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'image';
  if (ext === 'txt') return 'text';
  if (ext === 'csv') return 'csv';
  if (['xls', 'xlsx'].includes(ext)) return 'spreadsheet';
  if (ext === 'docx') return 'docx';
  if ((doc.mime_type || '').startsWith('image/')) return 'image';
  return 'unsupported';
}

/** Human-readable type label even when the file has no extension (e.g. Google Docs). */
export function fileTypeLabel(doc: Pick<Document, 'file_extension' | 'mime_type'>): string {
  if (doc.mime_type && NATIVE_LABELS[doc.mime_type]) return NATIVE_LABELS[doc.mime_type];
  const ext = (doc.file_extension || '').toLowerCase();
  if (ext) return ext.toUpperCase();
  if (doc.mime_type) {
    const sub = doc.mime_type.split('/').pop() || '';
    if (sub) return sub.toUpperCase();
  }
  return '—';
}

/** Max rows rendered in table previews to avoid UI lag on huge files. */
export const MAX_PREVIEW_ROWS = 200;
