import api from './api';
export const driveStatus = () => api.get('/google-drive/status').then(r => r.data);
export const driveAuth = () => api.get('/google-drive/auth').then(r => r.data);
export const driveSync = () => api.post('/google-drive/sync').then(r => r.data);
export const driveLogs = () => api.get('/google-drive/sync-logs').then(r => r.data);
export const driveFolders = () => api.get('/google-drive/folders').then(r => r.data);
export const saveDriveConfig = (payload: unknown) => api.post('/google-drive/config', payload).then(r => r.data);
export const driveItems = (parentId?: string | null) =>
  api.get('/google-drive/items', { params: parentId ? { parent_id: parentId } : {} }).then(r => r.data);
export const listSyncFiles = () => api.get('/google-drive/sync-files').then(r => r.data);
export const saveSyncFiles = (files: { file_id: string; file_name?: string; mime_type?: string; parent_id?: string | null }[]) =>
  api.post('/google-drive/sync-files', { files }).then(r => r.data);
export const removeSyncFile = (fileId: string) => api.delete(`/google-drive/sync-files/${fileId}`).then(r => r.data);
