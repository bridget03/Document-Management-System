import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { me } from "../services/authApi";
import Login from "../pages/Login";
import Users from "../pages/Users";
import Audit from "../pages/Audit";
import Dashboard from "../pages/Dashboard";
import Documents from "../pages/Documents";
import DocumentDetail from "../pages/DocumentDetail";
import PreviewPage from "../pages/PreviewPage";
import CorrespondenceList from "../pages/CorrespondenceList";
import CorrespondenceFormPage from "../pages/CorrespondenceFormPage";
import CorrespondenceDetail from "../pages/CorrespondenceDetail";
import IncomingList from "../pages/IncomingList";
import OutgoingList from "../pages/OutgoingList";
import IncomingFormPage from "../pages/IncomingFormPage";
import OutgoingFormPage from "../pages/OutgoingFormPage";
import IncomingDetail from "../pages/IncomingDetail";
import OutgoingDetail from "../pages/OutgoingDetail";
import DocTypes from "../pages/DocTypes";
import CorrSettings from "../pages/CorrSettings";
import Upload from "../pages/Upload";
import GoogleDrive from "../pages/GoogleDrive";
import Categories from "../pages/Categories";
import Tags from "../pages/Tags";
import Layout from "../components/layout/AppLayout";
import { useAuthStore } from "../stores/authStore";

function Guard({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
}

function AdminGuard({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const q = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const u = await me();
      setAuth(u, token!);
      return u;
    },
    enabled: !!token && !user,
    retry: false,
  });
  if (!token || q.isError) return <Navigate to="/login" />;
  if (!user) return <Layout><div className="p-6 text-sm text-gray-500">Đang tải…</div></Layout>;
  if (user.role !== "ADMIN") return <Navigate to="/dashboard" />;
  return <Layout>{children}</Layout>;
}

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <Guard>
              <Dashboard />
            </Guard>
          }
        />
        <Route
          path="/documents"
          element={
            <Guard>
              <Documents />
            </Guard>
          }
        />
        <Route
          path="/documents/:id"
          element={
            <Guard>
              <DocumentDetail />
            </Guard>
          }
        />
        <Route
          path="/documents/:id/preview"
          element={
            <Guard>
              <PreviewPage />
            </Guard>
          }
        />
        <Route
          path="/upload"
          element={
            <Guard>
              <Upload />
            </Guard>
          }
        />
        <Route
          path="/drive"
          element={
            <Guard>
              <GoogleDrive />
            </Guard>
          }
        />
        <Route
          path="/categories"
          element={
            <Guard>
              <Categories />
            </Guard>
          }
        />
        <Route
          path="/tags"
          element={
            <Guard>
              <Tags />
            </Guard>
          }
        />
        <Route path="/correspondence/incoming" element={<Guard><IncomingList /></Guard>} />
        <Route path="/correspondence/outgoing" element={<Guard><OutgoingList /></Guard>} />
        <Route path="/correspondence/incoming/new" element={<Guard><IncomingFormPage /></Guard>} />
        <Route path="/correspondence/outgoing/new" element={<Guard><OutgoingFormPage /></Guard>} />
        <Route path="/correspondence/incoming/:id" element={<Guard><IncomingDetail /></Guard>} />
        <Route path="/correspondence/outgoing/:id" element={<Guard><OutgoingDetail /></Guard>} />
        <Route path="/correspondence/incoming/:id/edit" element={<Guard><IncomingFormPage /></Guard>} />
        <Route path="/correspondence/outgoing/:id/edit" element={<Guard><OutgoingFormPage /></Guard>} />
        <Route
          path="/correspondence/internal"
          element={
            <Guard>
              <CorrespondenceList
                direction="INTERNAL"
                title="Công văn nội bộ"
                subtitle="Quản lý các văn bản lưu hành trong doanh nghiệp."
                base="/correspondence/internal"
              />
            </Guard>
          }
        />
        <Route
          path="/correspondence/internal/new"
          element={
            <Guard>
              <CorrespondenceFormPage
                direction="INTERNAL"
                title="Thêm công văn nội bộ"
                base="/correspondence/internal"
              />
            </Guard>
          }
        />
        <Route
          path="/correspondence/internal/:id"
          element={
            <Guard>
              <CorrespondenceDetail
                direction="INTERNAL"
                title="Văn bản nội bộ"
                base="/correspondence/internal"
              />
            </Guard>
          }
        />
        <Route
          path="/correspondence/internal/:id/edit"
          element={
            <Guard>
              <CorrespondenceFormPage
                direction="INTERNAL"
                title="Sửa văn bản nội bộ"
                base="/correspondence/internal"
              />
            </Guard>
          }
        />
        <Route
          path="/correspondence/types"
          element={
            <Guard>
              <DocTypes />
            </Guard>
          }
        />
        <Route
          path="/correspondence/settings"
          element={
            <AdminGuard>
              <CorrSettings />
            </AdminGuard>
          }
        />
        <Route
          path="/users"
          element={
            <AdminGuard>
              <Users />
            </AdminGuard>
          }
        />
        <Route
          path="/audit"
          element={
            <AdminGuard>
              <Audit />
            </AdminGuard>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}
