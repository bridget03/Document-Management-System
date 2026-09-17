import { useQuery } from '@tanstack/react-query';
import { me } from '../services/authApi';
import { useAuthStore } from '../stores/authStore';
export function useAuth() {
  const { user, token } = useAuthStore();
  const query = useQuery({ queryKey: ['me'], queryFn: me, enabled: !!token });
  return { user: query.data || user, ...query };
}
