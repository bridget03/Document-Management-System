import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Card } from "../ui/Skeleton";
import Badge from "../ui/Badge";
import { STATUS_CONFIG, DIRECTION_CONFIG, fmtDateVN, type Direction } from "../../types/correspondence";
import type { DashboardStats } from "../../services/dashboardApi";

type Item = DashboardStats["expiring_soon"][number];

const DIR_BASE: Record<string, string> = {
  INCOMING: "/correspondence/incoming",
  OUTGOING: "/correspondence/outgoing",
  INTERNAL: "/correspondence/internal",
};

function daysTone(days: number): "danger" | "warning" | "brand" {
  if (days <= 3) return "danger";
  if (days <= 7) return "warning";
  return "brand";
}

function daysLabel(days: number): string {
  if (days === 0) return "Hết hạn hôm nay";
  return `Còn ${days} ngày`;
}

export default function ExpiringSoon({ items }: { items: Item[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-3">
      <div
        role="alert"
        className="flex items-center gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3"
      >
        <AlertTriangle size={18} className="shrink-0 text-amber-600" />
        <p className="text-sm font-medium text-amber-900">
          Có {items.length} công văn sắp hết hiệu lực trong 10 ngày tới.
        </p>
      </div>
      <Card className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="px-5 py-3">Số văn bản</th>
              <th className="px-5 py-3">Chiều</th>
              <th className="px-5 py-3">Tình trạng</th>
              <th className="px-5 py-3">Ngày hết hạn</th>
              <th className="px-5 py-3 text-right">Còn lại</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((it) => {
              const st = STATUS_CONFIG[it.processing_status] || {
                label: it.processing_status,
                tone: "neutral" as const,
              };
              const dirTitle =
                DIRECTION_CONFIG[it.direction as Direction]?.title || it.direction;
              return (
                <tr key={it.id} className="hover:bg-gray-50">
                  <td className="px-5 py-2.5">
                    <Link
                      to={`${DIR_BASE[it.direction] || "/correspondence/incoming"}/${it.id}`}
                      className="font-medium text-brand-700 hover:text-brand-800"
                    >
                      {it.document_number}
                    </Link>
                  </td>
                  <td className="px-5 py-2.5 text-gray-600">{dirTitle}</td>
                  <td className="px-5 py-2.5">
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-gray-600">
                    {fmtDateVN(it.expiry_date)}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <Badge tone={daysTone(it.days_left)}>{daysLabel(it.days_left)}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
