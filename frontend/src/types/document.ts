export interface Tag { id: string; name: string; }
export interface Document {
  id: string; name: string; original_name: string; description?: string | null;
  mime_type?: string; file_extension?: string; file_size?: number;
  storage_type: string; category_id?: string | null; category?: { id: string; name: string } | null;
  uploaded_by?: string;
  source: string; sync_status: string;
  google_drive_file_id?: string; google_drive_url?: string;
  created_at: string; updated_at: string; tags: Tag[];
}
export interface Paginated<T> { items: T[]; page: number; page_size: number; total: number; total_pages: number; }
export interface User { id: string; name: string; email: string; role: string; }
export interface DriveStatus { connected: boolean; email?: string; folder_id?: string; folder_name?: string; sync_scope?: string; selected_count?: number; last_sync?: string; }
export interface DriveItem {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
  size?: string;
  parents?: string[];
}
export interface SyncFile {
  id: string;
  google_drive_file_id: string;
  file_name?: string | null;
  mime_type?: string | null;
  google_drive_parent_id?: string | null;
}
export interface SyncLog {
  id: string; started_at: string; completed_at?: string; status: string;
  total_files: number; created_files: number; updated_files: number; failed_files: number; error_message?: string;
}
