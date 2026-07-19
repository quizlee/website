import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import type { UserRole } from '../../lib/types';
import { Spinner } from '../ui/Spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  requireVerified?: boolean;
}

export function ProtectedRoute({
  children,
  requiredRole,
  requireVerified = false,
}: ProtectedRouteProps) {
  const { session, profile, loading, initialized } = useAuthStore();

  if (!initialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Not logged in
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // No profile or no role yet → send to onboarding
  if (!profile?.role) {
    const signupRole = localStorage.getItem('oauth_signup_role');
    if (signupRole === 'student') {
      return <Navigate to="/complete-setup" replace />;
    }
    return <Navigate to="/register" replace />;
  }

  // Student missing setup
  if (profile.role === 'student' && (!profile.school_id || !profile.class_id)) {
    return <Navigate to="/complete-setup" replace />;
  }

  // Account suspended or banned
  if (profile.status !== 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <div className="text-5xl mb-4">🚫</div>
          <h2 className="text-xl font-bold text-surface-900 mb-2">Account {profile.status}</h2>
          <p className="text-surface-600">
            Your account has been {profile.status}. Please contact the administrator for assistance.
          </p>
        </div>
      </div>
    );
  }

  // Role check
  if (requiredRole && profile.role !== requiredRole) {
    const redirectMap: Record<UserRole, string> = {
      student: '/student',
      teacher: '/teacher',
      admin: '/1234/admin',
    };
    return <Navigate to={redirectMap[profile.role]} replace />;
  }

  // Teacher verification check
  if (
    requireVerified &&
    profile.role === 'teacher' &&
    profile.verification_status !== 'approved'
  ) {
    return <Navigate to="/teacher/pending" replace />;
  }

  return <>{children}</>;
}
