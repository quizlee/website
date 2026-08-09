import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  FileText,
  Trophy,
  ClipboardList,
  Settings,
  LogOut,
  Gamepad2,
} from 'lucide-react';

const navItems = [
  { to: '/1234/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/1234/admin/teachers', icon: UserCheck, label: 'Teacher Verification', end: false },
  { to: '/1234/admin/activities', icon: Gamepad2, label: 'Activity Manager', end: false },
  { to: '/1234/admin/content', icon: FileText, label: 'Content Oversight', end: false },
  { to: '/1234/admin/users', icon: Users, label: 'User Management', end: false },
  { to: '/1234/admin/leaderboard', icon: Trophy, label: 'Leaderboard', end: false },
  { to: '/1234/admin/activity-log', icon: ClipboardList, label: 'Activity Log', end: false },
  { to: '/1234/admin/settings', icon: Settings, label: 'Settings', end: false },
];

export default function AdminLayout() {
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Sidebar — hover expandable */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-16 hover:w-60 transition-all duration-300 ease-in-out flex-col bg-surface-900 text-white z-50 group shadow-xl overflow-hidden">
        {/* Brand */}
        <div className="p-4 border-b border-surface-700 flex items-center gap-3.5 overflow-hidden whitespace-nowrap">
          <Settings size={20} className="text-surface-400 shrink-0" />
          <span className="font-bold text-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200">Admin Panel</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2.5 flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors overflow-hidden whitespace-nowrap ${
                  isActive
                    ? 'bg-surface-700 text-white'
                    : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'
                }`
              }
            >
              <item.icon size={20} className="shrink-0" />
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-2.5 border-t border-surface-700">
          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex items-center gap-3.5 text-sm text-surface-400 hover:text-danger-400 transition-colors w-full px-3.5 py-2.5 rounded-lg hover:bg-surface-800 cursor-pointer overflow-hidden whitespace-nowrap"
          >
            <LogOut size={20} className="shrink-0" />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">Sign out</span>
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
      <main className="lg:ml-16 min-h-screen">
        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
