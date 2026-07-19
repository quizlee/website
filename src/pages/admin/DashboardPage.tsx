import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Users, GraduationCap, School, BookOpen, MessageSquare } from 'lucide-react';

interface AdminStats {
  students: number;
  teachers: number;
  schools: number;
  questions: number;
  attempts: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats>({
    students: 0,
    teachers: 0,
    schools: 0,
    questions: 0,
    attempts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const [
        { count: students },
        { count: teachers },
        { count: schools },
        { count: questions },
        { count: attempts },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
        supabase.from('schools').select('*', { count: 'exact', head: true }),
        supabase.from('content').select('*', { count: 'exact', head: true }),
        supabase.from('activity_attempts').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        students: students || 0,
        teachers: teachers || 0,
        schools: schools || 0,
        questions: questions || 0,
        attempts: attempts || 0,
      });
      setLoading(false);
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-surface-900">Platform Analytics</h1>
        <p className="text-sm text-surface-500">Monitor overall engagement and content bank sizes</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* Total Students */}
        <Card className="flex items-center gap-4" padding="sm">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 flex-shrink-0">
            <GraduationCap size={20} />
          </div>
          <div>
            <p className="text-xl font-extrabold text-surface-900">{stats.students}</p>
            <p className="text-xs text-surface-500 font-medium">Students</p>
          </div>
        </Card>

        {/* Total Teachers */}
        <Card className="flex items-center gap-4" padding="sm">
          <div className="w-10 h-10 bg-secondary-100 rounded-lg flex items-center justify-center text-secondary-600 flex-shrink-0">
            <Users size={20} />
          </div>
          <div>
            <p className="text-xl font-extrabold text-surface-900">{stats.teachers}</p>
            <p className="text-xs text-surface-500 font-medium">Teachers</p>
          </div>
        </Card>

        {/* Total Schools */}
        <Card className="flex items-center gap-4" padding="sm">
          <div className="w-10 h-10 bg-accent-100 rounded-lg flex items-center justify-center text-accent-600 flex-shrink-0">
            <School size={20} />
          </div>
          <div>
            <p className="text-xl font-extrabold text-surface-900">{stats.schools}</p>
            <p className="text-xs text-surface-500 font-medium">Schools</p>
          </div>
        </Card>

        {/* Total Questions */}
        <Card className="flex items-center gap-4" padding="sm">
          <div className="w-10 h-10 bg-warning-100 rounded-lg flex items-center justify-center text-warning-600 flex-shrink-0">
            <BookOpen size={20} />
          </div>
          <div>
            <p className="text-xl font-extrabold text-surface-900">{stats.questions}</p>
            <p className="text-xs text-surface-500 font-medium">Questions</p>
          </div>
        </Card>

        {/* Total Attempts */}
        <Card className="flex items-center gap-4" padding="sm">
          <div className="w-10 h-10 bg-success-100 rounded-lg flex items-center justify-center text-success-600 flex-shrink-0">
            <MessageSquare size={20} />
          </div>
          <div>
            <p className="text-xl font-extrabold text-surface-900">{stats.attempts}</p>
            <p className="text-xs text-surface-500 font-medium">Attempts</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
