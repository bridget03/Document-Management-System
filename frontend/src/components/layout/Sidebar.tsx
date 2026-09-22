import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { me } from "../../services/authApi";
import {
  LayoutDashboard,
  Files,
  Upload,
  HardDrive,
  Tags,
  FolderOpen,
  LogOut,
  Inbox,
  Send,
  Building2,
  BookMarked,
  Settings,
  Users,
  ScrollText,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { IconButton } from "../ui/Button";
import logoUrl from "../../assets/logo.jpeg";

const groups: {
  label: string;
  adminOnly?: boolean;
  items: {
    to: string;
    label: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
  }[];
}[] = [
  {
    // label: "Workspace",
    items: [
      {
        to: "/dashboard",
        label: "Tổng quan",
        icon: <LayoutDashboard size={17} />,
      },
    ],
  },
  {
    label: "Quản lý",
    items: [
      {
        to: "/categories",
        label: "Loại tài liệu",
        icon: <FolderOpen size={17} />,
      },
      { to: "/tags", label: "Thẻ", icon: <Tags size={17} /> },
    ],
  },
  {
    label: "Quản lý tài liệu",
    items: [
      { to: "/documents", label: "Tài liệu", icon: <Files size={17} /> },
      // { to: "/upload", label: "Tải lên", icon: <Upload size={17} /> },
      {
        to: "/correspondence/incoming",
        label: "Công văn đến",
        icon: <Inbox size={17} />,
      },
      {
        to: "/correspondence/outgoing",
        label: "Công văn đi",
        icon: <Send size={17} />,
      },
      {
        to: "/correspondence/internal",
        label: "Công văn nội bộ",
        icon: <Building2 size={17} />,
      },
    ],
  },
  {
    label: "Cấu hình",
    items: [
      {
        to: "/correspondence/types",
        label: "Loại công văn",
        icon: <BookMarked size={17} />,
      },
      {
        to: "/correspondence/settings",
        label: "Cấu hình công văn",
        icon: <Settings size={17} />,
        adminOnly: true,
      },
      {
        to: "/users",
        label: "Người dùng",
        icon: <Users size={17} />,
        adminOnly: true,
      },
      {
        to: "/audit",
        label: "Nhật ký hệ thống",
        icon: <ScrollText size={17} />,
        adminOnly: true,
      },
    ],
  },
  {
    label: "Tính năng mở rộng",
    items: [
      { to: "/drive", label: "Google Drive", icon: <HardDrive size={17} /> },
    ],
  },
];

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const nav = useNavigate();
  useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const u = await me();
      setAuth(u, token!);
      return u;
    },
    enabled: !!token && !user,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const initial = (user?.name || user?.email || "U")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-2.5 border-b border-gray-200 px-5 py-4">
        <img
          src={logoUrl}
          alt="Vicenza DMS logo"
          className="h-9 w-9 shrink-0 rounded-lg object-cover"
        />
        <span>
          <span className="block text-sm font-bold leading-tight text-gray-900">
            Vicenza - DMS
          </span>
          <span className="block text-xs leading-tight text-gray-500">
            Document Management System
          </span>
        </span>
      </div>

      <nav
        className="flex-1 space-y-5 overflow-auto px-3 py-4"
        aria-label="Primary"
      >
        {groups
          .filter((g) => user?.role === "ADMIN" || !g.adminOnly)
          .map((g) => (
            <div key={g.label}>
              <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {g.label}
              </p>
              <div className="space-y-0.5">
                {g.items
                  .filter((i) => user?.role === "ADMIN" || !i.adminOnly)
                  .map((i) => (
                    <NavLink
                      key={i.to}
                      to={i.to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150 ${
                          isActive
                            ? "bg-brand-50 font-medium text-brand-700"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        }`
                      }
                    >
                      {i.icon}
                      {i.label}
                    </NavLink>
                  ))}
              </div>
            </div>
          ))}
      </nav>

      <div className="border-t border-gray-200 p-3">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-gray-900">
              {user?.name || "User"}
            </span>
            <span className="block truncate text-xs text-gray-500">
              {user?.role === "ADMIN" ? "Administrator" : "Member"}
            </span>
          </span>
          <IconButton
            label="Log out"
            tone="danger"
            onClick={() => {
              logout();
              nav("/login");
            }}
          >
            <LogOut size={16} />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
