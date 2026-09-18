import { NavLink, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import logoUrl from "../../assets/logo.jpeg";

const groups: {
  label: string;
  items: { to: string; label: string; icon: React.ReactNode }[];
}[] = [
  {
    label: "Workspace",
    items: [
      {
        to: "/dashboard",
        label: "Overview",
        icon: <LayoutDashboard size={17} />,
      },
      { to: "/documents", label: "Documents", icon: <Files size={17} /> },
      { to: "/upload", label: "Upload", icon: <Upload size={17} /> },
    ],
  },
  {
    label: "Organization",
    items: [
      {
        to: "/categories",
        label: "Categories",
        icon: <FolderOpen size={17} />,
      },
      { to: "/tags", label: "Tags", icon: <Tags size={17} /> },
    ],
  },
  {
    label: "Quản lý công văn",
    items: [
      {
        to: "/correspondence/incoming",
        label: "Công văn đến",
        icon: <Inbox size={17} />,
      },
      {
        to: "/correspondence/outgoing",
        label: "Văn bản đi",
        icon: <Send size={17} />,
      },
      {
        to: "/correspondence/internal",
        label: "Văn bản nội bộ",
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
      },
    ],
  },
  {
    label: "Integrations",
    items: [
      { to: "/drive", label: "Google Drive", icon: <HardDrive size={17} /> },
    ],
  },
];

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const nav = useNavigate();
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
        {groups.map((g) => (
          <div key={g.label}>
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {g.label}
            </p>
            <div className="space-y-0.5">
              {g.items.map((i) => (
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
          <button
            onClick={() => {
              logout();
              nav("/login");
            }}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
