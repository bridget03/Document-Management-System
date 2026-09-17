import api from './api';
export const listDocuments = (params: Record<string, unknown>) => api.get('/documents', { params }).then(r => r.data);
export const getDocument = (id: string) => api.get(`/documents/${id}`).then(r => r.data);
export const deleteDocument = (id: string) => api.delete(`/documents/${id}`).then(r => r.data);
export const updateDocument = (id: string, payload: unknown) => api.put(`/documents/${id}`, payload).then(r => r.data);
export const uploadDocument = (form: FormData, onProgress?: (p: number) => void) =>
  api.post('/documents/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => { if (e.total && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); },
  }).then(r => r.data);
export const downloadUrl = (id: string) => `${api.defaults.baseURL}/documents/${id}/download`;
export const previewUrl = (id: string) => `${api.defaults.baseURL}/documents/${id}/preview`;
// Authenticated fetchers (axios interceptor attaches the JWT).
export const fetchPreviewBlob = (id: string) =>
  api.get(`/documents/${id}/preview`, { responseType: 'blob' }).then((r) => r.data as Blob);
export const fetchPreviewText = (id: string) => fetchPreviewBlob(id).then((b) => b.text());
export const fetchPreviewBuffer = (id: string) => fetchPreviewBlob(id).then((b) => b.arrayBuffer());
/** Programmatic download that carries auth (plain <a href> cannot send JWT). */
export const downloadViaBlob = async (id: string, filename: string) => {
  const blob = await api.get(`/documents/${id}/download`, { responseType: 'blob' }).then((r) => r.data as Blob);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
