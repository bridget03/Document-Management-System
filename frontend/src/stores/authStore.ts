import { create } from 'zustand';
import type { User } from '../types/document';

interface AuthState { user: User | null; token: string | null; setAuth: (u: User, t: string) => void; logout: () => void; }
export const useAuthStore = create<AuthState>((set) => ({
  user: null, token: localStorage.getItem('token'),
  setAuth: (user, token) => { localStorage.setItem('token', token); set({ user, token }); },
  logout: () => { localStorage.removeItem('token'); set({ user: null, token: null }); },
}));
