import api from './api';

const base = '/departments';

export const listDepartments = (activeOnly = false) =>
  api.get(base, { params: activeOnly ? { active_only: true } : {} }).then((r) => r.data);

export const createDepartment = (payload: unknown) =>
  api.post(base, payload).then((r) => r.data);

export const updateDepartment = (id: string, payload: unknown) =>
  api.put(`${base}/${id}`, payload).then((r) => r.data);

export const deleteDepartment = (id: string) =>
  api.delete(`${base}/${id}`).then((r) => r.data);
