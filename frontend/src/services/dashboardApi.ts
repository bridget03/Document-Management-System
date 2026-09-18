import api from './api';

export interface DashboardStats {
  from: string;
  to: string;
  overview: { total_documents: number; incoming: number; outgoing: number; internal: number };
  trend: { date: string; incoming: number; outgoing: number; internal: number }[];
  processing_status: { status: string; count: number }[];
  document_types: { id: string; code: string; name: string; count: number }[];
  security_levels: { level: string; count: number }[];
  urgency_levels: { level: string; count: number }[];
  top_senders: { name: string; count: number }[];
  top_recipients: { name: string; count: number }[];
  top_departments: { name: string; count: number }[];
}

export const getDashboardStats = (from?: string, to?: string) =>
  api.get('/dashboard/stats', { params: { from_date: from, to_date: to } }).then((r) => r.data as DashboardStats);
