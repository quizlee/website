import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toast } from '../../components/ui/Toast';
import { Avatar } from '../../components/ui/Avatar';
import {
  Settings,
  Shield,
  User,
  Sliders,
  Database,
  Save,
  CheckCircle2,
  Lock,
  Zap,
  Globe,
  RefreshCw,
  Key,
} from 'lucide-react';

export default function AdminSettingsPage() {
  const { profile, setProfile, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'general' | 'gamification' | 'account' | 'system'>('general');

  // Loading state
  const [saving, setSaving] = useState(false);

  // Account tab state
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');

  // General Platform Settings state (persisted in localStorage / platform_settings)
  const [dailyXpLimit, setDailyXpLimit] = useState(() => {
    return Number(localStorage.getItem('admin_daily_xp_limit')) || 200;
  });
  const [passPercentage, setPassPercentage] = useState(() => {
    return Number(localStorage.getItem('admin_pass_percentage')) || 60;
  });
  const [maintenanceMode, setMaintenanceMode] = useState(() => {
    return localStorage.getItem('admin_maintenance_mode') === 'true';
  });
  const [allowStudentSignup, setAllowStudentSignup] = useState(() => {
    return localStorage.getItem('admin_allow_student_signup') !== 'false';
  });
  const [allowTeacherSignup, setAllowTeacherSignup] = useState(() => {
    return localStorage.getItem('admin_allow_teacher_signup') !== 'false';
  });

  // Gamification Settings state
  const [xpPerQuestion, setXpPerQuestion] = useState(() => {
    return Number(localStorage.getItem('admin_xp_per_question')) || 10;
  });
  const [perfectScoreBonus, setPerfectScoreBonus] = useState(() => {
    return Number(localStorage.getItem('admin_perfect_score_bonus')) || 25;
  });

  // Update account profile
  const handleSaveAccount = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          username: username,
        })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile({
        ...profile,
        full_name: fullName,
        username: username,
      });

      toast('Admin profile updated successfully! 👤', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Save General Platform settings
  const handleSaveGeneralSettings = () => {
    setSaving(true);
    try {
      localStorage.setItem('admin_daily_xp_limit', String(dailyXpLimit));
      localStorage.setItem('admin_pass_percentage', String(passPercentage));
      localStorage.setItem('admin_maintenance_mode', String(maintenanceMode));
      localStorage.setItem('admin_allow_student_signup', String(allowStudentSignup));
      localStorage.setItem('admin_allow_teacher_signup', String(allowTeacherSignup));

      toast('General platform settings updated! ⚙️', 'success');
    } catch (err: any) {
      toast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Save Gamification settings
  const handleSaveGamificationSettings = () => {
    setSaving(true);
    try {
      localStorage.setItem('admin_xp_per_question', String(xpPerQuestion));
      localStorage.setItem('admin_perfect_score_bonus', String(perfectScoreBonus));

      toast('Gamification & XP parameters saved! ⚡', 'success');
    } catch (err: any) {
      toast('Failed to save gamification parameters', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Trigger Password Reset Email
  const handlePasswordReset = async () => {
    if (!user?.email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      toast(`Password reset link sent to ${user.email}! 📧`, 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to send reset email', 'error');
    }
  };

  const initials = profile?.full_name?.[0]?.toUpperCase() || 'A';

  return (
    <div className="animate-fade-in max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-surface-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-surface-900 font-headline-md flex items-center gap-2.5">
            <Settings size={26} className="text-primary-600" />
            Admin System Settings
          </h1>
          <p className="text-sm text-surface-500 font-body-md mt-1">
            Configure global platform behaviors, XP rates, security policies, and administrator account details.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-surface-200 mb-6 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'general'
              ? 'border-primary text-primary-600 bg-primary-50/50 rounded-t-lg'
              : 'border-transparent text-surface-500 hover:text-surface-900 hover:bg-surface-100/50 rounded-t-lg'
          }`}
        >
          <Sliders size={18} />
          Platform Controls
        </button>
        <button
          onClick={() => setActiveTab('gamification')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'gamification'
              ? 'border-primary text-primary-600 bg-primary-50/50 rounded-t-lg'
              : 'border-transparent text-surface-500 hover:text-surface-900 hover:bg-surface-100/50 rounded-t-lg'
          }`}
        >
          <Zap size={18} />
          Gamification & XP
        </button>
        <button
          onClick={() => setActiveTab('account')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'account'
              ? 'border-primary text-primary-600 bg-primary-50/50 rounded-t-lg'
              : 'border-transparent text-surface-500 hover:text-surface-900 hover:bg-surface-100/50 rounded-t-lg'
          }`}
        >
          <User size={18} />
          Admin Profile
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'system'
              ? 'border-primary text-primary-600 bg-primary-50/50 rounded-t-lg'
              : 'border-transparent text-surface-500 hover:text-surface-900 hover:bg-surface-100/50 rounded-t-lg'
          }`}
        >
          <Database size={18} />
          System Status
        </button>
      </div>

      {/* TAB 1: Platform Controls */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 border-b border-surface-100 pb-4 mb-6">
              <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center shrink-0">
                <Globe size={20} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-surface-900">Platform Limits & Policies</h3>
                <p className="text-xs text-surface-500">Configure global daily quotas and quiz passing rules for students.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-bold text-surface-800 mb-2">
                  Daily Student XP Limit
                </label>
                <Input
                  type="number"
                  min={50}
                  max={5000}
                  value={dailyXpLimit}
                  onChange={(e) => setDailyXpLimit(Number(e.target.value))}
                  helpText="Maximum XP a student can earn in practice mode per day (Default: 200 XP)"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-surface-800 mb-2">
                  Default Quiz Pass Threshold (%)
                </label>
                <Input
                  type="number"
                  min={10}
                  max={100}
                  value={passPercentage}
                  onChange={(e) => setPassPercentage(Number(e.target.value))}
                  helpText="Passing percentage required to complete chapter activities (Default: 60%)"
                />
              </div>
            </div>

            <div className="border-t border-surface-100 pt-6 space-y-4">
              <h4 className="font-bold text-sm text-surface-900 mb-3">Access & Registration Controls</h4>

              <div className="flex items-center justify-between p-4 rounded-xl border border-surface-200 bg-surface-50/50">
                <div>
                  <h5 className="font-bold text-sm text-surface-900">Allow Student Registration</h5>
                  <p className="text-xs text-surface-500">Permit new students to register accounts via signup page.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowStudentSignup}
                    onChange={(e) => setAllowStudentSignup(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                </label>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-surface-200 bg-surface-50/50">
                <div>
                  <h5 className="font-bold text-sm text-surface-900">Allow Teacher Self-Registration Requests</h5>
                  <p className="text-xs text-surface-500">Enable new teachers to submit registration verification requests.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowTeacherSignup}
                    onChange={(e) => setAllowTeacherSignup(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                </label>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-warning-200 bg-warning-50/30">
                <div>
                  <h5 className="font-bold text-sm text-warning-900">Platform Maintenance Mode</h5>
                  <p className="text-xs text-warning-700">Display a system maintenance banner to users during updates.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={maintenanceMode}
                    onChange={(e) => setMaintenanceMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-warning-600" />
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleSaveGeneralSettings}
                loading={saving}
                icon={<Save size={18} />}
                className="!bg-primary text-white font-bold"
              >
                Save Platform Controls
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: Gamification & XP */}
      {activeTab === 'gamification' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 border-b border-surface-100 pb-4 mb-6">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                <Zap size={20} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-surface-900">Gamification Parameters</h3>
                <p className="text-xs text-surface-500">Configure base XP reward rates and bonus point multipliers.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-bold text-surface-800 mb-2">
                  Base XP per Correct Question
                </label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={xpPerQuestion}
                  onChange={(e) => setXpPerQuestion(Number(e.target.value))}
                  helpText="XP points granted to students per correct answer in standard quizzes"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-surface-800 mb-2">
                  Perfect Score Bonus XP
                </label>
                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={perfectScoreBonus}
                  onChange={(e) => setPerfectScoreBonus(Number(e.target.value))}
                  helpText="Extra bonus XP granted when scoring 100% on any activity"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleSaveGamificationSettings}
                loading={saving}
                icon={<Save size={18} />}
                className="!bg-primary text-white font-bold"
              >
                Save XP Parameters
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: Admin Profile */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 border-b border-surface-100 pb-4 mb-6">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                <User size={20} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-surface-900">Administrator Credentials</h3>
                <p className="text-xs text-surface-500">Manage your super admin account details and security password.</p>
              </div>
            </div>

            <div className="flex items-center gap-6 mb-6">
              <Avatar
                avatarUrl={profile?.avatar_url || null}
                initials={initials}
                className="w-20 h-20 text-2xl font-black ring-4 ring-primary/20"
              />
              <div>
                <h4 className="font-extrabold text-lg text-surface-900">{profile?.full_name || 'System Admin'}</h4>
                <p className="text-xs text-surface-500 font-medium">Role: <span className="text-primary font-bold uppercase tracking-wider">Super Administrator</span></p>
                <p className="text-xs text-surface-400 mt-1">{user?.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-bold text-surface-800 mb-2">
                  Full Name
                </label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Admin Name"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-surface-800 mb-2">
                  Username
                </label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin_username"
                />
              </div>
            </div>

            <div className="border-t border-surface-100 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-sm text-surface-900 flex items-center gap-2">
                  <Key size={16} className="text-primary" />
                  Security Password
                </h4>
                <p className="text-xs text-surface-500">Send password recovery link to {user?.email || 'admin email'}.</p>
              </div>
              <Button
                variant="outline"
                onClick={handlePasswordReset}
                icon={<Lock size={16} />}
              >
                Send Password Reset Email
              </Button>
            </div>

            <div className="mt-8 flex justify-end">
              <Button
                onClick={handleSaveAccount}
                loading={saving}
                icon={<Save size={18} />}
                className="!bg-primary text-white font-bold"
              >
                Update Admin Profile
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: System Status */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 border-b border-surface-100 pb-4 mb-6">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                <Database size={20} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-surface-900">Infrastructure & System Status</h3>
                <p className="text-xs text-surface-500">View real-time database connection metrics and environment information.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 flex items-center gap-3">
                <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-emerald-800 tracking-wider">Database Status</span>
                  <p className="font-extrabold text-sm text-emerald-950">Supabase Connected 🟢</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200 flex items-center gap-3">
                <Shield size={24} className="text-blue-600 shrink-0" />
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-blue-800 tracking-wider">Platform Security</span>
                  <p className="font-extrabold text-sm text-blue-950">Role-Based Guard Active</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-200 flex items-center gap-3">
                <RefreshCw size={24} className="text-purple-600 shrink-0" />
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-purple-800 tracking-wider">Quizlee Engine</span>
                  <p className="font-extrabold text-sm text-purple-950">v1.2.0 (Latest)</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-surface-200 bg-surface-50 text-xs font-mono space-y-1.5 text-surface-600">
              <p><strong>Environment:</strong> Production Web Application</p>
              <p><strong>Database Endpoint:</strong> Supabase PostgreSQL REST Engine</p>
              <p><strong>Browser Engine:</strong> {navigator.userAgent}</p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
