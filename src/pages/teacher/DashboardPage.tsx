import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { FileText, Users, TrendingUp } from 'lucide-react';

interface TeacherStats {
  totalContent: number;
  totalStudents: number;
  avgScore: number;
}

export default function TeacherDashboardPage() {
  const { profile } = useAuthStore();
  const [stats, setStats] = useState<TeacherStats>({
    totalContent: 0,
    totalStudents: 0,
    avgScore: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      // Count content created by this teacher
      const { count: contentCount } = await supabase
        .from('content')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', profile?.id);

      // Count students in teacher's school
      const { count: studentCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student')
        .eq('school_id', profile?.school_id);

      setStats({
        totalContent: contentCount || 0,
        totalStudents: studentCount || 0,
        avgScore: 0,
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
    <div className="animate-fade-in">
      <h1 className="text-2xl font-extrabold text-surface-900 mb-2">
        Welcome, {profile?.full_name?.split(' ')[0] || 'Teacher'}! 📚
      </h1>
      <p className="text-surface-500 mb-8">Here's your content overview</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="text-center">
          <div className="w-12 h-12 mx-auto bg-secondary-100 rounded-2xl flex items-center justify-center mb-3">
            <FileText size={24} className="text-secondary-600" />
          </div>
          <p className="text-2xl font-extrabold text-surface-900">{stats.totalContent}</p>
          <p className="text-sm text-surface-500 font-medium">Questions Created</p>
        </Card>

        <Card className="text-center">
          <div className="w-12 h-12 mx-auto bg-primary-100 rounded-2xl flex items-center justify-center mb-3">
            <Users size={24} className="text-primary-600" />
          </div>
          <p className="text-2xl font-extrabold text-surface-900">{stats.totalStudents}</p>
          <p className="text-sm text-surface-500 font-medium">Active Students</p>
        </Card>

        <Card className="text-center">
          <div className="w-12 h-12 mx-auto bg-accent-100 rounded-2xl flex items-center justify-center mb-3">
            <TrendingUp size={24} className="text-accent-600" />
          </div>
          <p className="text-2xl font-extrabold text-surface-900">—</p>
          <p className="text-sm text-surface-500 font-medium">Avg Score</p>
        </Card>
      </div>
    </div>
  );
}
