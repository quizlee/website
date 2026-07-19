import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import type { LeaderboardEntry } from '../../lib/types';
import { Trophy, Medal, Award } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';

export default function LeaderboardPage() {
  const { profile } = useAuthStore();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      const query = supabase
        .from('leaderboard')
        .select('*')
        .order('points', { ascending: false })
        .limit(50);

      // Filter by school if user has one
      if (profile?.school_id) {
        query.eq('school_id', profile.school_id);
      }

      const { data } = await query;
      setEntries(data || []);
      setLoading(false);
    }

    fetchLeaderboard();
  }, [profile]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy size={20} className="text-warning-500" />;
    if (rank === 2) return <Medal size={20} className="text-surface-400" />;
    if (rank === 3) return <Award size={20} className="text-amber-600" />;
    return <span className="text-sm font-bold text-surface-400 w-5 text-center">{rank}</span>;
  };

  return (
    <div className="animate-fade-in relative">
      {/* Glassmorphic coming soon overlay */}
      <div className="absolute inset-0 z-50 bg-slate-50/20 backdrop-blur-[1.5px] flex items-start justify-center pointer-events-auto min-h-[500px]">
        <div className="sticky top-[30vh] bg-white/95 backdrop-blur-md px-8 py-6 rounded-3xl shadow-xl border border-white max-w-sm text-center flex flex-col items-center gap-4 mt-20">
          <div className="p-3 bg-primary-50 rounded-2xl border border-primary-100 animate-bounce">
            <Trophy className="text-primary" size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-surface-900 tracking-tight">Leaderboard</h2>
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-widest mt-1">Coming Soon</p>
          </div>
          <p className="text-xs text-surface-500 font-medium leading-relaxed">
            Compete against classmates, earn XP in matches, and climb to the top of your school leaderboard!
          </p>
        </div>
      </div>
      <h1 className="text-2xl font-extrabold text-surface-900 mb-2">Leaderboard 🏆</h1>
      <p className="text-surface-500 mb-8">
        {profile?.school_id ? 'Your school rankings' : 'Global rankings'}
      </p>

      {entries.length === 0 ? (
        <Card className="text-center py-12">
          <div className="text-5xl mb-4">🏅</div>
          <h2 className="text-xl font-bold text-surface-900 mb-2">No Rankings Yet</h2>
          <p className="text-surface-500">Play competitive mode activities to appear on the leaderboard!</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry, index) => {
            const isCurrentUser = entry.user_id === profile?.id;
            const rank = index + 1;

            return (
              <Card
                key={entry.user_id}
                className={`flex items-center gap-4 ${
                  isCurrentUser ? 'ring-2 ring-primary-400 bg-primary-50/50' : ''
                }`}
                padding="sm"
              >
                {/* Rank */}
                <div className="w-8 flex justify-center flex-shrink-0">
                  {getRankIcon(rank)}
                </div>

                {/* Avatar */}
                <Avatar
                  avatarUrl={entry.avatar_url}
                  initials={entry.username?.[0]?.toUpperCase() || entry.full_name?.[0]?.toUpperCase() || '?'}
                  className={`w-10 h-10 text-sm font-bold flex-shrink-0 ${
                    rank <= 3 ? 'bg-warning-100 text-warning-700' : 'bg-surface-100 text-surface-600'
                  }`}
                />

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-surface-900 truncate">
                    {entry.privacy === 'public'
                      ? entry.full_name || entry.username || 'Anonymous'
                      : entry.username || 'Hidden'}
                    {isCurrentUser && <span className="text-primary-500 ml-1">(You)</span>}
                  </p>
                  <p className="text-xs text-surface-400">
                    {entry.total_activities} activities played
                  </p>
                </div>

                {/* Points */}
                <div className="text-right flex-shrink-0">
                  <p className="font-extrabold text-surface-900">{entry.points}</p>
                  <p className="text-xs text-surface-400">points</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
