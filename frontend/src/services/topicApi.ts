import api from './api';

const base = '/topics';

export const listTopics = (activeOnly = false) =>
  api.get(base, { params: activeOnly ? { active_only: true } : {} }).then((r) => r.data);

export const createTopic = (payload: unknown) =>
  api.post(base, payload).then((r) => r.data);

export const updateTopic = (id: string, payload: unknown) =>
  api.put(`${base}/${id}`, payload).then((r) => r.data);

export const deleteTopic = (id: string) =>
  api.delete(`${base}/${id}`).then((r) => r.data);
