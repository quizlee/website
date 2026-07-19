import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import type { ActivityAttempt } from '../../lib/types';
import { Clock, Target, Star } from 'lucide-react';

export default function HistoryPage() {
  const { profile } = useAuthStore();
  const [attempts, setAttempts] = useState<ActivityAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      if (!profile?.id) return;

      const { data, error } = await supabase
        .from('activity_attempts')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching history:', error);
        setLoading(false);
        return;
      }

      if (data && data.length > 20) {
        const keepList = data.slice(0, 20);
        const deleteIds = data.slice(20).map(item => item.id);

        // Delete older activities in background
        supabase
          .from('activity_attempts')
          .delete()
          .in('id', deleteIds)
          .then(({ error: deleteError }) => {
            if (deleteError) {
              console.error('Error deleting old activities:', deleteError);
            }
          });

        setAttempts(keepList);
      } else {
        setAttempts(data || []);
      }
      setLoading(false);
    }

    fetchHistory();
  }, [profile]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const activityEmoji: Record<string, string> = {
    quiz: '🧠',
    flashcard: '📄',
    matching: '🔗',
    picture: '🖼️',
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-extrabold text-surface-900 mb-2">History 📋</h1>
      <p className="text-surface-500 mb-8">Your past activities</p>

      {attempts.length === 0 ? (
        <Card className="text-center py-12">
          <div className="text-5xl mb-4">📭</div>
          <h2 className="text-xl font-bold text-surface-900 mb-2">No Activities Yet</h2>
          <p className="text-surface-500">Start playing to see your history here!</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {attempts.map((attempt) => {
            const percentage = attempt.total_questions > 0
              ? Math.round((attempt.score / attempt.total_questions) * 100)
              : 0;

            return (
              <Card key={attempt.id} className="flex items-center gap-4" padding="sm">
                <div className="w-12 h-12 bg-surface-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                  {activityEmoji[attempt.activity_type] || '❓'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-surface-900 capitalize">
                      {attempt.activity_type}
                    </p>
                    <Badge
                      variant={attempt.mode === 'competitive' ? 'danger' : 'info'}
                      size="sm"
                    >
                      {attempt.mode}
                    </Badge>
                  </div>
                  <p className="text-xs text-surface-400">{formatDate(attempt.created_at)}</p>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-sm">
                      <Target size={12} className="text-primary-500" />
                      <span className="font-bold text-surface-800">{percentage}%</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-sm">
                      <Clock size={12} className="text-accent-500" />
                      <span className="font-bold text-surface-800">{attempt.time_taken_seconds}s</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-sm">
                      <Star size={12} className="text-warning-500" />
                      <span className="font-bold text-surface-800">+{attempt.points_earned}</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
