import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  BookOpen,
  FileText,
  Trophy,
  ClipboardList,
  Settings,
  LogOut,
  Upload,
  Gamepad2,
} from 'lucide-react';

const navItems = [
  { to: '/1234/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/1234/admin/teachers', icon: UserCheck, label: 'Teacher Verification', end: false },
  { to: '/1234/admin/activities', icon: Gamepad2, label: 'Activity Manager', end: false },
  { to: '/1234/admin/curriculum', icon: BookOpen, label: 'Curriculum', end: false },
  { to: '/1234/admin/content', icon: FileText, label: 'Content Oversight', end: false },
  { to: '/1234/admin/import', icon: Upload, label: 'Bulk Import', end: false },
  { to: '/1234/admin/users', icon: Users, label: 'User Management', end: false },
  { to: '/1234/admin/leaderboard', icon: Trophy, label: 'Leaderboard', end: false },
  { to: '/1234/admin/activity-log', icon: ClipboardList, label: 'Activity Log', end: false },
];

export default function AdminLayout() {
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Sidebar — functional, minimal */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-60 flex-col bg-surface-900 text-white z-40">
        {/* Brand */}
        <div className="p-5 border-b border-surface-700">
          <div className="flex items-center gap-2">
            <Settings size={20} className="text-surface-400" />
            <span className="font-bold text-lg">Admin Panel</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-surface-700 text-white'
                    : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-surface-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-surface-400 hover:text-danger-400 transition-colors w-full px-3 py-2 rounded-lg hover:bg-surface-800 cursor-pointer"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden flex items-center justify-between p-3 bg-surface-900 text-white sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-surface-400" />
          <span className="font-bold">Admin Panel</span>
        </div>
        <button onClick={handleLogout} className="p-2 text-surface-400 hover:text-danger-400 cursor-pointer">
          <LogOut size={18} />
        </button>
      </header>

      {/* Mobile nav */}
      <nav className="lg:hidden flex items-center gap-1 px-3 py-2 bg-surface-800 sticky top-[49px] z-30 overflow-x-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-surface-600 text-white'
                  : 'text-surface-400 hover:text-surface-200'
              }`
            }
          >
            <item.icon size={14} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Content */}
      <main className="lg:ml-60 min-h-screen">
        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
