import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Clock, LogOut } from 'lucide-react';

export default function PendingApprovalPage() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  // If approved already, send to teacher dashboard
  if (profile?.verification_status === 'approved') {
    navigate('/teacher');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-secondary-50 via-white to-primary-50">
      <div className="w-full max-w-md animate-slide-up text-center">
        <Card className="p-8">
          <div className="w-16 h-16 bg-warning-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Clock size={32} className="text-warning-600 animate-pulse" />
          </div>

          <h1 className="text-2xl font-bold text-surface-900 mb-2">Account Pending Verification</h1>
          <p className="text-surface-600 mb-6 text-sm">
            Hello, <strong>{profile?.full_name || 'Teacher'}</strong>. Your teacher account has been registered
            and is currently in the verification queue.
          </p>

          {profile?.rejection_reason && (
            <div className="bg-danger-50 border-2 border-danger-100 rounded-xl p-4 text-left mb-6">
              <h3 className="text-xs font-bold text-danger-700 uppercase tracking-wider mb-1">Previous Rejection Reason</h3>
              <p className="text-sm text-danger-800">{profile.rejection_reason}</p>
            </div>
          )}

          <div className="bg-surface-50 rounded-xl p-4 mb-6 text-sm text-surface-500 text-left space-y-1">
            <p><strong>School Claimed:</strong> {profile?.school_id ? 'Yes' : 'None'}</p>
            <p><strong>Subjects:</strong> {profile?.subjects_claimed?.join(', ') || 'None'}</p>
          </div>

          <Button
            variant="ghost"
            onClick={handleLogout}
            icon={<LogOut size={16} />}
            className="w-full"
          >
            Sign Out
          </Button>
        </Card>
      </div>
    </div>
  );
}
