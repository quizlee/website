import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import type { Activity } from '../../lib/types';
import { Target, Zap, Flame } from 'lucide-react';

interface Stats {
  totalActivities: number;
  activitiesCompletedToday: number;
  avgAccuracy: number;
  xpEarnedToday: number;
  totalPoints: number;
  schoolRank: number | null;
}

export default function StudentHomePage() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();

  // Student stats state
  const [stats, setStats] = useState<Stats>({
    totalActivities: 0,
    activitiesCompletedToday: 0,
    avgAccuracy: 0,
    xpEarnedToday: 0,
    totalPoints: profile?.points || 0,
    schoolRank: null,
  });

  // Activities from DB (admin-managed)
  const [activities, setActivities] = useState<Activity[]>([]);
  
  // Fetch play zone activities from DB
  useEffect(() => {
    supabase
      .from('activities')
      .select('*')
      .eq('is_active', true)
      .eq('zone', 'play')
      .order('sort_order')
      .then(({ data }) => {
        if (data) setActivities(data as Activity[]);
      });
  }, []);

  // Fetch student stats
  useEffect(() => {
    async function fetchStats() {
      if (!profile?.id) return;

      const { data: attemptsData } = await supabase
        .from('activity_attempts')
        .select('*')
        .eq('user_id', profile.id);

      const totalPlayed = attemptsData ? attemptsData.length : 0;
      const avgScore = totalPlayed > 0
        ? Math.round(
            attemptsData!.reduce(
              (acc, curr) => acc + (curr.total_questions > 0 ? (curr.score / curr.total_questions) * 100 : 0),
              0
            ) / totalPlayed
          )
        : 0;

      const todayStr = new Date().toDateString();
      const todayAttempts = attemptsData ? attemptsData.filter(a => new Date(a.created_at).toDateString() === todayStr) : [];
      const activitiesCompletedToday = todayAttempts.length;
      const xpEarnedToday = todayAttempts.reduce((acc, curr) => acc + (curr.points_earned || 0), 0);

      const { data: rankData } = await supabase
        .from('leaderboard')
        .select('school_rank')
        .eq('user_id', profile.id)
        .single();

      setStats({
        totalActivities: totalPlayed,
        activitiesCompletedToday,
        avgAccuracy: avgScore,
        xpEarnedToday,
        totalPoints: profile.points || 0,
        schoolRank: rankData?.school_rank || null,
      });
    }

    if (profile?.id) {
      fetchStats();
    }
  }, [profile]);


  const handleActivityClick = () => {
    navigate('/student/practice');
  };

  if (!profile?.class_id) {
    return (
      <div className="flex justify-center items-center py-12 animate-fade-in">
        <div className="bg-white rounded-2xl p-8 max-w-lg text-center border border-surface-200 shadow-md">
          <span className="text-5xl mb-4 block">🏫</span>
          <h2 className="font-headline-md text-headline-sm text-on-background mb-3">Class Not Selected</h2>
          <p className="font-body-md text-on-surface-variant mb-6 font-semibold">
            Please select your class in your account settings first so we can load your curriculum.
          </p>
          <button 
            onClick={() => navigate('/student/account')}
            className="bg-gradient-to-br from-primary to-indigo-600 text-white px-6 py-3 rounded-2xl font-bold bouncy shadow-md shadow-primary/30 hover:scale-105 transition-all cursor-pointer"
          >
            Go to Account Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-10">
      {/* Overview Stat Cards at Top */}
      <section>
        <div className="grid grid-cols-3 gap-2.5 sm:gap-5">
          {/* Card 1: Activities Completed Today */}
          <div className="group relative p-3 sm:p-5 rounded-3xl overflow-hidden transition-all duration-300 hover:-translate-y-1 aspect-square sm:aspect-auto flex flex-col items-center justify-center sm:flex-row sm:items-start sm:justify-start text-center sm:text-left gap-1.5 sm:gap-4"
            style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)', boxShadow: '0 6px 24px 0 #6366f155' }}>
            {/* Shine overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none rounded-3xl" />
            <div className="absolute bottom-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="w-9 h-9 sm:w-13 sm:h-13 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 border border-white/30">
              <Flame size={18} className="stroke-[2.5] text-white fill-white/30 animate-pulse sm:hidden" />
              <Flame size={22} className="stroke-[2.5] text-white fill-white/30 animate-pulse hidden sm:block" />
            </div>
            <div className="min-w-0 relative z-10">
              <p className="text-[9px] sm:text-xs font-black uppercase tracking-wider text-white/70 leading-tight">
                <span className="sm:hidden">Activities</span>
                <span className="hidden sm:inline">Activities Completed</span>
              </p>
              <p className="text-xl sm:text-3xl font-black text-white mt-0.5">
                {stats.activitiesCompletedToday}
              </p>
            </div>
          </div>

          {/* Card 2: Average Accuracy */}
          <div className="group relative p-3 sm:p-5 rounded-3xl overflow-hidden transition-all duration-300 hover:-translate-y-1 aspect-square sm:aspect-auto flex flex-col items-center justify-center sm:flex-row sm:items-start sm:justify-start text-center sm:text-left gap-1.5 sm:gap-4"
            style={{ background: 'linear-gradient(135deg, #10b981, #0d9488)', boxShadow: '0 6px 24px 0 #10b98155' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none rounded-3xl" />
            <div className="absolute bottom-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="w-9 h-9 sm:w-13 sm:h-13 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 border border-white/30">
              <Target size={18} className="stroke-[2.5] text-white sm:hidden" />
              <Target size={22} className="stroke-[2.5] text-white hidden sm:block" />
            </div>
            <div className="min-w-0 relative z-10">
              <p className="text-[9px] sm:text-xs font-black uppercase tracking-wider text-white/70 leading-tight">
                <span className="sm:hidden">Accuracy</span>
                <span className="hidden sm:inline">Average Accuracy</span>
              </p>
              <p className="text-xl sm:text-3xl font-black text-white mt-0.5">
                {stats.avgAccuracy}%
              </p>
            </div>
          </div>

          {/* Card 3: XP Earned Today */}
          <div className="group relative p-3 sm:p-5 rounded-3xl overflow-hidden transition-all duration-300 hover:-translate-y-1 aspect-square sm:aspect-auto flex flex-col items-center justify-center sm:flex-row sm:items-start sm:justify-start text-center sm:text-left gap-1.5 sm:gap-4"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', boxShadow: '0 6px 24px 0 #f59e0b55' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none rounded-3xl" />
            <div className="absolute bottom-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="w-9 h-9 sm:w-13 sm:h-13 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 border border-white/30">
              <Zap size={18} className="stroke-[2.5] text-white fill-white/30 sm:hidden" />
              <Zap size={22} className="stroke-[2.5] text-white fill-white/30 hidden sm:block" />
            </div>
            <div className="min-w-0 relative z-10">
              <p className="text-[9px] sm:text-xs font-black uppercase tracking-wider text-white/70 leading-tight">
                <span className="sm:hidden">XP Today</span>
                <span className="hidden sm:inline">XP Earned Today</span>
              </p>
              <p className="text-xl sm:text-3xl font-black text-white mt-0.5">
                {stats.xpEarnedToday.toLocaleString()} <span className="text-xs sm:text-lg">XP</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Daily Activity Hero Section — hidden for now, will enable later */}
      {/* <section className="mb-12">
        <div className="relative w-full rounded-3xl overflow-hidden shadow-xl min-h-[330px] md:min-h-[360px] flex items-stretch bg-[#F1F5F9] border border-white/60">
          ...
        </div>
      </section> */}

      {/* Play Zone */}
      <section className="mb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h3 className="text-2xl font-extrabold text-on-background">Play Zone</h3>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-gutter">
          {activities.map((activity) => {
            const cardColor = activity.color || '#6366f1';
            return (
              <div
                key={activity.key}
                onClick={handleActivityClick}
                className="group relative rounded-3xl p-3 sm:p-5 bouncy cursor-pointer flex flex-col sm:flex-row items-start gap-3 sm:gap-4 h-full overflow-hidden transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: '#ffffff',
                  border: `1.5px solid ${cardColor}50`,
                  boxShadow: `0 4px 20px 0 rgba(0,0,0,0.10), 0 2px 8px 0 ${cardColor}25`,
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 10px 36px 0 rgba(0,0,0,0.13), 0 4px 16px 0 ${cardColor}40`)}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = `0 4px 20px 0 rgba(0,0,0,0.10), 0 2px 8px 0 ${cardColor}25`)}
              >
                {/* Glow blob */}
                <div
                  className="absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl pointer-events-none opacity-40"
                  style={{ background: cardColor }}
                />
                <div
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shrink-0 self-start sm:self-center text-2xl sm:text-3xl"
                  style={{
                    background: `linear-gradient(135deg, ${cardColor}cc, ${cardColor})`,
                    boxShadow: `0 4px 14px 0 ${cardColor}60, 0 1px 4px 0 ${cardColor}40`,
                  }}
                >
                  {activity.emoji || '🎮'}
                </div>
                <div className="flex-grow relative z-10">
                  <h4
                    className="font-extrabold transition-colors text-sm sm:text-base md:text-lg"
                    style={{ color: cardColor }}
                  >
                    {activity.label}
                  </h4>
                  <p className="text-xs sm:text-sm text-on-surface-variant leading-snug font-semibold mt-0.5 line-clamp-2">{activity.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
