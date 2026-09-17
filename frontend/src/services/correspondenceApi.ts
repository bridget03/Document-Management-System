import api from './api';

const base = '/correspondence';

export const corrList = (direction: 'incoming' | 'outgoing', params: Record<string, unknown>) =>
  api.get(`${base}/${direction}`, { params }).then((r) => r.data);

export const corrGet = (direction: 'incoming' | 'outgoing', id: string) =>
  api.get(`${base}/${direction}/${id}`).then((r) => r.data);

export const corrCreate = (direction: 'incoming' | 'outgoing', payload: unknown) =>
  api.post(`${base}/${direction}`, payload).then((r) => r.data);

export const corrUpdate = (direction: 'incoming' | 'outgoing', id: string, payload: unknown) =>
  api.put(`${base}/${direction}/${id}`, payload).then((r) => r.data);

export const corrDelete = (direction: 'incoming' | 'outgoing', id: string) =>
  api.delete(`${base}/${direction}/${id}`).then((r) => r.data);

export const corrRemoveAttachment = (direction: string, id: string, attId: string) =>
  api.delete(`${base}/${direction}/${id}/attachments/${attId}`).then((r) => r.data);

export const corrRemoveLink = (direction: string, id: string, linkId: string) =>
  api.delete(`${base}/${direction}/${id}/links/${linkId}`).then((r) => r.data);

export const corrImport = (direction: 'incoming' | 'outgoing', rows: unknown[]) =>
  api.post(`${base}/${direction}/import`, { rows }).then((r) => r.data);

export const listDocTypes = (activeOnly = false) =>
  api.get(`${base}/types`, { params: activeOnly ? { active_only: true } : {} }).then((r) => r.data);

export const createDocType = (payload: unknown) => api.post(`${base}/types`, payload).then((r) => r.data);

export const updateDocType = (id: string, payload: unknown) => api.put(`${base}/types/${id}`, payload).then((r) => r.data);

export const deleteDocType = (id: string) => api.delete(`${base}/types/${id}`).then((r) => r.data);

export const getNumberSettings = () => api.get(`${base}/settings`).then((r) => r.data);

export const saveNumberSettings = (direction: string, payload: unknown) =>
  api.put(`${base}/settings/${direction}`, payload).then((r) => r.data);

export const nextNumber = (direction: string) =>
  api.get(`${base}/next-number`, { params: { direction } }).then((r) => r.data);

export const listDepartments = () => api.get(`${base}/departments`).then((r) => r.data);

export const listSigners = () => api.get(`${base}/signers`).then((r) => r.data);
