import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  Clock,
  Zap,
  Loader2,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

interface ActivityAttempt {
  id: string;
  user_id: string;
  activity_type: string;
  mode: string;
  score: number;
  total_questions: number;
  time_taken_seconds: number;
  points_earned: number;
  created_at: string;
}

export default function RecentPage() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [attempts, setAttempts] = useState<ActivityAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'practice' | 'competitive'>('all');

  const fetchHistory = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('activity_attempts')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching activity history:', error);
        return;
      }

      setAttempts(data || []);
    } catch (err) {
      console.error('Error in fetchHistory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [profile?.id]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return `Today, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
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

  const filteredAttempts = attempts.filter((item) => {
    if (filterMode === 'all') return true;
    return item.mode === filterMode;
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-12">
      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-surface-200 pb-3">
        <div className="flex items-center gap-2">
          {(['all', 'practice', 'competitive'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-4 py-1.5 rounded-full text-xs font-extrabold capitalize transition-all cursor-pointer ${
                filterMode === mode
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Activity List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : filteredAttempts.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center bg-surface-50/50 border-2 border-dashed border-surface-200">
          <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center text-3xl mb-4">
            📭
          </div>
          <h3 className="text-lg font-bold text-surface-900 mb-1">No Activity History Found</h3>
          <p className="text-sm text-surface-500 max-w-sm mb-6 font-medium">
            {filterMode === 'all'
              ? "You haven't completed any learning activities yet. Start a quick quiz or flashcard practice!"
              : `No ${filterMode} mode activities recorded yet.`}
          </p>
          <Button
            onClick={() => navigate('/student/practice')}
            icon={<ArrowRight size={16} />}
          >
            Explore Practice Activities
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredAttempts.map((attempt) => {
            const percentage =
              attempt.total_questions > 0
                ? Math.round((attempt.score / attempt.total_questions) * 100)
                : 0;

            return (
              <Card
                key={attempt.id}
                className="p-4 sm:p-5 hover:border-primary-200 hover:shadow-md transition-all duration-200 group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left info */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-surface-100 border border-surface-200 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                      {activityEmoji[attempt.activity_type] || '🎯'}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="font-bold text-surface-950 text-base capitalize">
                          {attempt.activity_type} Session
                        </h4>
                        <span
                          className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                            attempt.mode === 'competitive'
                              ? 'bg-danger-50 text-danger-700 border-danger-200'
                              : 'bg-primary-50 text-primary-700 border-primary-200'
                          }`}
                        >
                          {attempt.mode}
                        </span>
                      </div>
                      <p className="text-xs text-surface-500 font-semibold">
                        {formatDate(attempt.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Right Metrics */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 border-surface-100 pt-3 sm:pt-0">
                    <div className="text-center min-w-[65px]">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-surface-400">
                        Accuracy
                      </span>
                      <div className="flex items-center justify-center gap-1 text-sm font-black text-surface-900 mt-1">
                        <CheckCircle2 size={14} className="text-emerald-500" />
                        <span>{percentage}%</span>
                      </div>
                    </div>

                    <div className="text-center min-w-[65px]">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-surface-400">
                        Time
                      </span>
                      <div className="flex items-center justify-center gap-1 text-sm font-black text-surface-900 mt-1">
                        <Clock size={14} className="text-indigo-500" />
                        <span>{attempt.time_taken_seconds || 0}s</span>
                      </div>
                    </div>

                    <div className="text-center min-w-[65px]">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-surface-400">
                        XP Gained
                      </span>
                      <div className="flex items-center justify-center gap-1 text-sm font-black text-warning-700 mt-1">
                        <Zap size={14} className="fill-warning-500 text-warning-500" />
                        <span>+{attempt.points_earned || 0}</span>
                      </div>
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
