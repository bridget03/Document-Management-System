import { useState } from 'react';
import { X } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 lg:block">
        <Sidebar />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-sm">
            <button
              onClick={() => setDrawer(false)}
              className="absolute right-2 top-3 rounded p-1.5 text-gray-500 hover:bg-gray-100"
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
            <Sidebar onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-60">
        <Header onMenu={() => setDrawer(true)} />
        <main className="mx-auto w-full max-w-6xl animate-fade-in px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
