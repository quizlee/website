import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { FileText, Users, Share2 } from 'lucide-react';
import TeacherClassActivitiesPage from './ClassActivitiesPage';

interface TeacherStats {
  totalContent: number;
  totalStudents: number;
  totalShares: number;
}

export default function TeacherDashboardPage() {
  const { profile } = useAuthStore();
  const [stats, setStats] = useState<TeacherStats>({
    totalContent: 0,
    totalStudents: 0,
    totalShares: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!profile?.id) return;

      // Count content created by this teacher
      const { count: contentCount } = await supabase
        .from('content')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', profile.id);

      // Count students in teacher's school
      const { count: studentCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student')
        .eq('school_id', profile.school_id);

      // Count resources shared by this teacher
      const { count: shareCount } = await supabase
        .from('teacher_shares')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', profile.id);

      setStats({
        totalContent: contentCount || 0,
        totalStudents: studentCount || 0,
        totalShares: shareCount || 0,
      });
      setLoading(false);
    }

    if (profile?.id) fetchStats();
  }, [profile]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">


      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="text-center p-4">
          <div className="w-10 h-10 mx-auto bg-secondary-100 rounded-2xl flex items-center justify-center mb-2">
            <FileText size={20} className="text-secondary-600" />
          </div>
          <p className="text-xl font-extrabold text-surface-900">{stats.totalContent}</p>
          <p className="text-xs text-surface-500 font-medium">Questions Created</p>
        </Card>

        <Card className="text-center p-4">
          <div className="w-10 h-10 mx-auto bg-primary-100 rounded-2xl flex items-center justify-center mb-2">
            <Users size={20} className="text-primary-600" />
          </div>
          <p className="text-xl font-extrabold text-surface-900">{stats.totalStudents}</p>
          <p className="text-xs text-surface-500 font-medium">Active Students</p>
        </Card>

        <Card className="text-center p-4">
          <div className="w-10 h-10 mx-auto bg-indigo-100 rounded-2xl flex items-center justify-center mb-2">
            <Share2 size={20} className="text-indigo-600" />
          </div>
          <p className="text-xl font-extrabold text-surface-900">{stats.totalShares}</p>
          <p className="text-xs text-surface-500 font-medium">Resources Shared</p>
        </Card>
      </div>

      {/* Class Activities & Shared Materials */}
      <div className="pt-2">
        <TeacherClassActivitiesPage />
      </div>
    </div>
  );
}
