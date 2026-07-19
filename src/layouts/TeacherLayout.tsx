import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import {
  LayoutDashboard,
  FileText,
  Upload,
  LogOut,
  User,
} from 'lucide-react';

const navItems = [
  { to: '/teacher', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/teacher/content', icon: FileText, label: 'Content Manager', end: false },
  { to: '/teacher/import', icon: Upload, label: 'Bulk Import', end: false },
  { to: '/teacher/account', icon: User, label: 'Account', end: false },
];

export default function TeacherLayout() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-50/50 via-white to-primary-50/30">
      {/* Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col bg-white border-r border-surface-200 shadow-sm z-40">
        {/* Brand */}
        <div className="p-6 border-b border-surface-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary-500 rounded-xl flex items-center justify-center shadow">
              <span className="text-xl">📚</span>
            </div>
            <div>
              <span className="text-xl font-extrabold text-surface-900">Quizlee</span>
              <p className="text-xs text-secondary-600 font-semibold">Teacher Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-secondary-50 text-secondary-700 shadow-sm'
                    : 'text-surface-500 hover:bg-surface-50 hover:text-surface-700'
                }`
              }
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-surface-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-secondary-100 flex items-center justify-center text-secondary-600 font-bold overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                profile?.full_name?.[0]?.toUpperCase() || '?'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-surface-800 truncate">
                {profile?.full_name || 'Teacher'}
              </p>
              <p className="text-xs text-surface-400">Teacher</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-surface-400 hover:text-danger-600 transition-colors w-full px-2 py-1.5 rounded-lg hover:bg-danger-50 cursor-pointer"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-surface-200 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <span className="text-xl">📚</span>
          <span className="font-extrabold text-surface-900">Quizlee</span>
          <span className="text-xs bg-secondary-100 text-secondary-700 px-2 py-0.5 rounded-full font-semibold">Teacher</span>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-surface-400 hover:text-danger-600 cursor-pointer"
        >
          <LogOut size={18} />
        </button>
      </header>

      {/* Mobile Tab Nav */}
      <nav className="lg:hidden flex items-center gap-1 px-4 py-2 bg-white border-b border-surface-100 sticky top-[57px] z-30 overflow-x-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-secondary-50 text-secondary-700'
                  : 'text-surface-400'
              }`
            }
          >
            <item.icon size={16} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Content */}
      <main className="lg:ml-64 min-h-screen">
        <div className="max-w-5xl mx-auto p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
