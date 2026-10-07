import api from './api';

const base = '/receiving-units';

export const listReceivingUnits = (activeOnly = false) =>
  api.get(base, { params: activeOnly ? { active_only: true } : {} }).then((r) => r.data);

export const createReceivingUnit = (payload: unknown) =>
  api.post(base, payload).then((r) => r.data);

export const updateReceivingUnit = (id: string, payload: unknown) =>
  api.put(`${base}/${id}`, payload).then((r) => r.data);

export const deleteReceivingUnit = (id: string) =>
  api.delete(`${base}/${id}`).then((r) => r.data);
