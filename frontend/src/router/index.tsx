import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import Documents from '../pages/Documents';
import DocumentDetail from '../pages/DocumentDetail';
import PreviewPage from '../pages/PreviewPage';
import CorrespondenceList from '../pages/CorrespondenceList';
import CorrespondenceFormPage from '../pages/CorrespondenceFormPage';
import CorrespondenceDetail from '../pages/CorrespondenceDetail';
import DocTypes from '../pages/DocTypes';
import CorrSettings from '../pages/CorrSettings';
import Upload from '../pages/Upload';
import GoogleDrive from '../pages/GoogleDrive';
import Categories from '../pages/Categories';
import Tags from '../pages/Tags';
import Layout from '../components/layout/AppLayout';
import { useAuthStore } from '../stores/authStore';

function Guard({ children }: { children: JSX.Element }) {
  const token = useAuthStore(s => s.token);
  if (!token) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
}

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Guard><Dashboard /></Guard>} />
        <Route path="/documents" element={<Guard><Documents /></Guard>} />
        <Route path="/documents/:id" element={<Guard><DocumentDetail /></Guard>} />
        <Route path="/documents/:id/preview" element={<Guard><PreviewPage /></Guard>} />
        <Route path="/upload" element={<Guard><Upload /></Guard>} />
        <Route path="/drive" element={<Guard><GoogleDrive /></Guard>} />
        <Route path="/categories" element={<Guard><Categories /></Guard>} />
        <Route path="/tags" element={<Guard><Tags /></Guard>} />
        <Route path="/correspondence/incoming" element={<Guard><CorrespondenceList direction="INCOMING" title="Văn bản đến" subtitle="Quản lý các văn bản nhận từ bên ngoài." base="/correspondence/incoming" /></Guard>} />
        <Route path="/correspondence/outgoing" element={<Guard><CorrespondenceList direction="OUTGOING" title="Văn bản đi" subtitle="Quản lý các văn bản phát hành từ doanh nghiệp." base="/correspondence/outgoing" /></Guard>} />
        <Route path="/correspondence/incoming/new" element={<Guard><CorrespondenceFormPage direction="INCOMING" title="Thêm văn bản đến" base="/correspondence/incoming" /></Guard>} />
        <Route path="/correspondence/outgoing/new" element={<Guard><CorrespondenceFormPage direction="OUTGOING" title="Thêm văn bản đi" base="/correspondence/outgoing" /></Guard>} />
        <Route path="/correspondence/incoming/:id" element={<Guard><CorrespondenceDetail direction="INCOMING" title="Văn bản đến" base="/correspondence/incoming" /></Guard>} />
        <Route path="/correspondence/outgoing/:id" element={<Guard><CorrespondenceDetail direction="OUTGOING" title="Văn bản đi" base="/correspondence/outgoing" /></Guard>} />
        <Route path="/correspondence/incoming/:id/edit" element={<Guard><CorrespondenceFormPage direction="INCOMING" title="Sửa văn bản đến" base="/correspondence/incoming" /></Guard>} />
        <Route path="/correspondence/outgoing/:id/edit" element={<Guard><CorrespondenceFormPage direction="OUTGOING" title="Sửa văn bản đi" base="/correspondence/outgoing" /></Guard>} />
        <Route path="/correspondence/types" element={<Guard><DocTypes /></Guard>} />
        <Route path="/correspondence/settings" element={<Guard><CorrSettings /></Guard>} />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}
