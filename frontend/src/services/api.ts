import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api' });
api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

let redirecting = false;
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Hết hạn/không hợp lệ: dọn session và đưa về login (tránh loop khi đang ở /login).
    if (err?.response?.status === 401 && !redirecting && window.location.pathname !== '/login') {
      redirecting = true;
      try {
        useAuthStore.getState().logout();
      } catch {
        localStorage.removeItem('token');
      }
      window.location.href = '/login?expired=1';
    }
    return Promise.reject(err);
  },
);
export default api;
