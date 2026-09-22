import api from './api';
export const login = (email: string, password: string) => api.post('/auth/login', { email, password }).then(r => r.data);
export const me = () => api.get('/auth/me').then(r => r.data);
export const listUsers = () => api.get('/auth/users').then(r => r.data);
export const createUser = (payload: { name: string; email: string; password: string; role: string; department?: string }) =>
  api.post('/auth/users', payload).then(r => r.data);
export const updateUser = (id: string, payload: { name?: string; role?: string; is_active?: boolean; department?: string | null }) =>
  api.put(`/auth/users/${id}`, payload).then(r => r.data);
export const resetUserPassword = (id: string) =>
  api.post(`/auth/users/${id}/reset-password`).then(r => r.data);
