import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuthStore } from './stores/authStore';
import { AuthProvider } from './contexts/AuthProvider';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ToastContainer } from './components/ui/Toast';
import { Spinner } from './components/ui/Spinner';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import CompleteSetupPage from './pages/auth/CompleteSetupPage';

// Layouts
import StudentLayout from './layouts/StudentLayout';
import TeacherLayout from './layouts/TeacherLayout';
import AdminLayout from './layouts/AdminLayout';

// Student Pages
import StudentHomePage from './pages/student/HomePage';
import PracticePage from './pages/student/PracticePage';
import ActivityPanelPage from './pages/student/ActivityPanelPage';
import PlayPage from './pages/student/PlayPage';
import ResultPage from './pages/student/ResultPage';
import LeaderboardPage from './pages/student/LeaderboardPage';
import CompetePage from './pages/student/CompetePage';
import HistoryPage from './pages/student/HistoryPage';
import SettingsPage from './pages/student/SettingsPage';
import { getSavedTheme, applyTheme } from './lib/theme';

// Teacher Pages
import TeacherDashboardPage from './pages/teacher/DashboardPage';
import ContentManagerPage from './pages/teacher/ContentManagerPage';
import BulkImportPage from './pages/teacher/BulkImportPage';
import PendingApprovalPage from './pages/teacher/PendingApprovalPage';
import TeacherAccountPage from './pages/teacher/AccountPage';

// Admin Pages
import SetupPage from './pages/admin/SetupPage';
import AdminDashboardPage from './pages/admin/DashboardPage';
import TeacherVerificationPage from './pages/admin/TeacherVerificationPage';
import CurriculumPage from './pages/admin/CurriculumPage';
import ContentOversightPage from './pages/admin/ContentOversightPage';
import ActivityManagerPage from './pages/admin/ActivityManagerPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import AdminLeaderboardPage from './pages/admin/LeaderboardPage';
import ActivityLogPage from './pages/admin/ActivityLogPage';
import AdminBulkImportPage from './pages/admin/BulkImportPage';

function RootRedirector() {
  const { user, profile, loading, initialized } = useAuthStore();
  const navigate = useNavigate();
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    async function checkAdminSetup() {
      const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'admin_setup_complete')
        .single();

      if (data && data.value === 'false') {
        navigate('/admin/setup', { replace: true });
      } else {
        setCheckingSetup(false);
      }
    }
    checkAdminSetup();
  }, [navigate]);

  if (!initialized || loading || checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!profile || !profile.role) {
    const signupRole = localStorage.getItem('oauth_signup_role');
    if (signupRole === 'student') {
      return <Navigate to="/complete-setup" replace />;
    }
    return <Navigate to="/register" replace />;
  }

  // If student but missing school or class, send to complete-setup
  if (profile.role === 'student' && (!profile.school_id || !profile.class_id)) {
    return <Navigate to="/complete-setup" replace />;
  }

  const redirectMap = {
    student: '/student',
    teacher: profile.verification_status === 'approved' ? '/teacher' : '/teacher/pending',
    admin: '/1234/admin',
  };

  return <Navigate to={redirectMap[profile.role]} replace />;
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  const { user } = useAuthStore();

  useEffect(() => {
    applyTheme(getSavedTheme(user?.id));
  }, [user?.id]);

  return (
    <AuthProvider>
      <ScrollToTop />
      <Routes>
        {/* Setup Flow */}
        <Route path="/admin/setup" element={<SetupPage />} />

        {/* Public / Auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/complete-setup" element={<CompleteSetupPage />} />

        {/* Student Panel */}
        <Route
          path="/student"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<StudentHomePage />} />
           <Route path="choose" element={<Navigate to="/student" replace />} />
          <Route path="practice" element={<PracticePage />} />
          <Route path="activity" element={<ActivityPanelPage />} />
          <Route path="play" element={<PlayPage />} />
          <Route path="result" element={<ResultPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="compete" element={<CompetePage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="account" element={<SettingsPage key="account" defaultTab="account" />} />
          <Route path="settings" element={<SettingsPage key="settings" defaultTab="account" />} />
        </Route>

        {/* Teacher Panel */}
        <Route
          path="/teacher/pending"
          element={
            <ProtectedRoute requiredRole="teacher">
              <PendingApprovalPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher"
          element={
            <ProtectedRoute requiredRole="teacher" requireVerified={true}>
              <TeacherLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<TeacherDashboardPage />} />
          <Route path="content" element={<ContentManagerPage />} />
          <Route path="import" element={<BulkImportPage />} />
          <Route path="account" element={<TeacherAccountPage />} />
        </Route>

        {/* Admin Panel */}
        <Route
          path="/1234/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="teachers" element={<TeacherVerificationPage />} />
          <Route path="curriculum" element={<CurriculumPage />} />
          <Route path="activities" element={<ActivityManagerPage />} />
          <Route path="content" element={<ContentOversightPage />} />
          <Route path="import" element={<AdminBulkImportPage />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="leaderboard" element={<AdminLeaderboardPage />} />
          <Route path="activity-log" element={<ActivityLogPage />} />
        </Route>

        {/* Root Redirect */}
        <Route path="/" element={<RootRedirector />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ToastContainer />
    </AuthProvider>
  );
}
