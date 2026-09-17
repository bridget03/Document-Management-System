import { useQuery } from '@tanstack/react-query';
import { listDocuments } from '../services/documentApi';
export function useDocuments(params: Record<string, unknown>) {
  return useQuery({ queryKey: ['docs', params], queryFn: () => listDocuments(params) });
}
