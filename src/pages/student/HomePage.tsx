import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { toast } from '../../components/ui/Toast';
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

  const handlePlayHero = () => {
    toast('Daily Activity is coming soon! 🚀', 'info');
  };

  // Weekly Goal helpers
  // const weeklyTarget = 5;
  // const progressPercent = Math.min(Math.round((weeklyCount / weeklyTarget) * 100), 100);
  // const xpEarnedThisWeek = weeklyCount * 50;
  // const today = new Date();
  // const dayOfWeek = today.getDay();
  // const daysLeft = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

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
          <div className="group relative p-3 sm:p-5 rounded-3xl bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/40 border border-indigo-100/80 shadow-md hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-4 overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="w-10 h-10 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
              <Flame size={22} className="stroke-[2.5] fill-white/20 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-indigo-900/60 leading-tight">
                Activities Completed
              </p>
              <p className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 font-headline-md mt-0.5">
                {stats.activitiesCompletedToday}
              </p>
            </div>
          </div>

          {/* Card 2: Average Accuracy */}
          <div className="group relative p-3 sm:p-5 rounded-3xl bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 border border-emerald-100/80 shadow-md hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-4 overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="w-10 h-10 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
              <Target size={22} className="stroke-[2.5]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-emerald-900/60 leading-tight">
                Average Accuracy
              </p>
              <p className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600 font-headline-md mt-0.5">
                {stats.avgAccuracy}%
              </p>
            </div>
          </div>

          {/* Card 3: XP Earned Today */}
          <div className="group relative p-3 sm:p-5 rounded-3xl bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 border border-amber-100/80 shadow-md hover:shadow-xl hover:shadow-amber-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-4 overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="w-10 h-10 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
              <Zap size={22} className="stroke-[2.5] fill-white/30" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-amber-900/60 leading-tight">
                XP Earned Today
              </p>
              <p className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600 font-headline-md mt-0.5">
                {stats.xpEarnedToday.toLocaleString()} <span className="text-sm sm:text-lg">XP</span>
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
          <h3 className="hidden sm:block text-2xl font-extrabold text-on-background">Play Zone</h3>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-gutter">
          {activities.map((activity) => {
            const cardColor = activity.color || '#6366f1';
            return (
              <div
                key={activity.key}
                onClick={handleActivityClick}
                className="bg-white rounded-2xl p-3 sm:p-5 bouncy cursor-pointer group border border-surface-200 shadow-md flex flex-col sm:flex-row items-start gap-3 sm:gap-4 h-full relative hover:border-primary/50"
              >
                <div
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-md shrink-0 self-start sm:self-center text-2xl sm:text-3xl drop-shadow-md"
                  style={{ background: `linear-gradient(135deg, ${cardColor}cc, ${cardColor})` }}
                >
                  {activity.emoji || '🎮'}
                </div>
                <div className="flex-grow">
                  <h4 className="font-bold text-on-background group-hover:text-primary-600 transition-colors text-sm sm:text-base md:text-lg">{activity.label}</h4>
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
