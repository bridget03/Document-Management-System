import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Files,
  Inbox,
  Send,
  Building2,
  ArrowRight,
  Clock,
} from "lucide-react";
import { getDashboardStats } from "../services/dashboardApi";
import { listDocuments } from "../services/documentApi";
import { driveStatus } from "../services/googleDriveApi";
import { useAuthStore } from "../stores/authStore";
import { Card, Skeleton } from "../components/ui/Skeleton";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import { fileTypeLabel } from "../components/document-viewer/preview";
import type { Document, Paginated } from "../types/document";
import { ChartCard, ChartSkeleton, KpiCard } from "../components/dashboard/ChartCard";
import DateFilter, { presetRange, type Preset, type Range } from "../components/dashboard/DateFilter";
import TrendChart from "../components/dashboard/TrendChart";
import TopOrgsChart from "../components/dashboard/TopOrgsChart";
import Donut from "../components/dashboard/Donut";
import TypeBars from "../components/dashboard/TypeBars";
import {
  STATUS_COLORS,
  LEVEL_COLORS,
} from "../components/dashboard/chartTheme";
import { STATUS_CONFIG, LEVEL_LABELS } from "../types/correspondence";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return "Good morning";
  if (h < 14) return "Good day";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const statusLabelMap = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label]),
);

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const [preset, setPreset] = useState<Preset>("30d");
  const [range, setRange] = useState<Range>(() => presetRange("30d"));

  const pickPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") setRange(presetRange(p));
  };

  const statsQ = useQuery({
    queryKey: ["dashboard-stats", range.from, range.to],
    queryFn: () => getDashboardStats(range.from, range.to),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const recentQ = useQuery<Paginated<Document>>({
    queryKey: ["stats-recent"],
    queryFn: () => listDocuments({ page: 1, page_size: 8 }),
  });
  const driveStatusQ = useQuery({
    queryKey: ["drive-status"],
    queryFn: driveStatus,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const stats = statsQ.data;
  const loading = statsQ.isLoading;
  const failed = statsQ.isError;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {greeting()}, {user?.name || "there"} — tổng quan tài liệu và công văn.
          </p>
        </div>
        <DateFilter
          preset={preset}
          onPreset={pickPreset}
          range={range}
          onCustom={(r) => setRange(r)}
        />
      </div>

      {failed ? (
        <Card className="px-6 py-10 text-center">
          <p className="font-semibold text-gray-900">Không thể tải dữ liệu dashboard</p>
          <p className="mt-1 text-sm text-gray-500">Vui lòng kiểm tra kết nối và thử lại.</p>
          <Button size="sm" className="mt-3" onClick={() => statsQ.refetch()}>
            Thử lại
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={<Files size={18} />}
              label="Tổng tài liệu"
              value={stats?.overview.total_documents ?? 0}
              loading={loading}
              to="/documents"
            />
            <KpiCard
              icon={<Inbox size={18} />}
              label="Công văn đến"
              value={stats?.overview.incoming ?? 0}
              loading={loading}
              to="/correspondence/incoming"
            />
            <KpiCard
              icon={<Send size={18} />}
              label="Công văn đi"
              value={stats?.overview.outgoing ?? 0}
              loading={loading}
              to="/correspondence/outgoing"
            />
            <KpiCard
              icon={<Building2 size={18} />}
              label="Công văn nội bộ"
              value={stats?.overview.internal ?? 0}
              loading={loading}
              to="/correspondence/internal"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ChartCard title="Xu hướng công văn" hint="Số văn bản tạo mới theo thời gian">
                {loading ? (
                  <ChartSkeleton />
                ) : (
                  <TrendChart data={stats?.trend || []} />
                )}
              </ChartCard>
            </div>
            <ChartCard title="Top đơn vị gửi / nhận">
              {loading ? (
                <ChartSkeleton />
              ) : (
                <TopOrgsChart
                  senders={stats?.top_senders || []}
                  recipients={stats?.top_recipients || []}
                  departments={stats?.top_departments || []}
                />
              )}
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <ChartCard title="Tình trạng xử lý">
              {loading ? (
                <ChartSkeleton />
              ) : (
                <Donut
                  title="Tình trạng xử lý"
                  data={(stats?.processing_status || []).map((s) => ({
                    key: s.status,
                    count: s.count,
                  }))}
                  colors={STATUS_COLORS}
                  labelMap={statusLabelMap}
                />
              )}
            </ChartCard>
            <ChartCard title="Mức độ bảo mật">
              {loading ? (
                <ChartSkeleton />
              ) : (
                <Donut
                  title="Mức độ bảo mật"
                  data={(stats?.security_levels || []).map((s) => ({
                    key: s.level,
                    count: s.count,
                  }))}
                  colors={LEVEL_COLORS}
                  labelMap={LEVEL_LABELS}
                />
              )}
            </ChartCard>
            <ChartCard title="Mức độ khẩn cấp">
              {loading ? (
                <ChartSkeleton />
              ) : (
                <Donut
                  title="Mức độ khẩn cấp"
                  data={(stats?.urgency_levels || []).map((s) => ({
                    key: s.level,
                    count: s.count,
                  }))}
                  colors={LEVEL_COLORS}
                  labelMap={LEVEL_LABELS}
                />
              )}
            </ChartCard>
          </div>

          <ChartCard
            title="Loại văn bản"
            hint="Top loại theo số lượng"
            action={
              <Link
                to="/correspondence/types"
                className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
              >
                Quản lý loại <ArrowRight size={13} />
              </Link>
            }
          >
            {loading ? <ChartSkeleton /> : <TypeBars data={stats?.document_types || []} />}
          </ChartCard>
        </>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-gray-900">
              Recent documents
            </h2>
            <Link
              to="/documents"
              className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
            >
              View all <ArrowRight size={13} />
            </Link>
          </div>
          {recentQ.isLoading ? (
            <div className="space-y-2.5 p-5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : (recentQ.data?.items.length || 0) === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500">
              No documents yet.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentQ.data?.items.map((d) => (
                <li key={d.id}>
                  <Link
                    to={`/documents/${d.id}`}
                    className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-gray-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900">
                        {d.name}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {fileTypeLabel(d)} ·{" "}
                        {d.category?.name || "Uncategorized"} ·{" "}
                        {new Date(d.updated_at).toLocaleDateString()}
                      </span>
                    </span>
                    <Badge
                      tone={
                        d.sync_status === "SYNCED"
                          ? "success"
                          : d.sync_status === "REMOTE_MISSING"
                            ? "warning"
                            : "neutral"
                      }
                      dot
                    >
                      {d.sync_status === "SYNCED"
                        ? "Synced"
                        : d.sync_status === "REMOTE_MISSING"
                          ? "Missing"
                          : d.source === "GOOGLE_DRIVE"
                            ? "Drive"
                            : "Local"}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="border-b border-gray-200 px-5 py-3.5 text-sm font-semibold text-gray-900">
            Sync overview
          </h2>
          <div className="space-y-2 px-5 py-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Google Drive</span>
              {driveStatusQ.data?.connected ? (
                <Badge tone="success" dot>
                  Connected
                </Badge>
              ) : (
                <Badge tone="neutral" dot>
                  Not connected
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Folder</span>
              <span className="font-medium text-gray-900">
                {driveStatusQ.data?.folder_name || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-gray-500">
                <Clock size={13} /> Last sync
              </span>
              <span className="font-medium text-gray-900">
                {driveStatusQ.data?.last_sync
                  ? new Date(driveStatusQ.data.last_sync).toLocaleString()
                  : "Never"}
              </span>
            </div>
            <Link to="/drive">
              <Button size="sm" className="mt-1 w-full">
                Open Google Drive
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {!loading && !failed && (stats?.overview.incoming || 0) + (stats?.overview.outgoing || 0) + (stats?.overview.internal || 0) === 0 && (
        <EmptyState
          title="Chưa có dữ liệu công văn"
          description="Thêm công văn đến/đi/nội bộ để xem biểu đồ thống kê."
        />
      )}
    </div>
  );
}
