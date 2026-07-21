import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { toast } from '../../components/ui/Toast';
import type { Subject, Chapter, Activity } from '../../lib/types';
import { Sparkles, Play, BookOpen, Lock, Trophy } from 'lucide-react';

interface Stats {
  totalActivities: number;
  totalPoints: number;
  schoolRank: number | null;
}

export default function StudentHomePage() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();

  // Student stats state
  const [stats, setStats] = useState<Stats>({
    totalActivities: 0,
    totalPoints: profile?.points || 0,
    schoolRank: null,
  });

  // Curriculum dropdowns state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  
  // Persistence state
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedQuestionCount, setSelectedQuestionCount] = useState<string>(() => {
    return localStorage.getItem('home_question_count') || '10';
  });
  
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // Activities from DB (admin-managed)
  const [activities, setActivities] = useState<Activity[]>([]);
  const [availableActivityTypes, setAvailableActivityTypes] = useState<string[]>([]);
  
  // Weekly Goal progress state
  const [weeklyCount, setWeeklyCount] = useState(0);

  // Save selected question count to localStorage
  useEffect(() => {
    localStorage.setItem('home_question_count', selectedQuestionCount);
  }, [selectedQuestionCount]);

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
      const { count } = await supabase
        .from('activity_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile?.id);

      const { data: rankData } = await supabase
        .from('leaderboard')
        .select('school_rank')
        .eq('user_id', profile?.id)
        .single();

      setStats({
        totalActivities: count || 0,
        totalPoints: profile?.points || 0,
        schoolRank: rankData?.school_rank || null,
      });
    }

    if (profile?.id) {
      fetchStats();
    }
  }, [profile]);

  // Fetch subjects for the student's class
  useEffect(() => {
    if (!profile?.class_id) return;
    setLoadingSubjects(true);

    supabase
      .from('subjects')
      .select('*')
      .eq('class_id', profile.class_id)
      .eq('school_id', profile?.school_id)
      .order('name')
      .then(({ data }) => {
        if (data) {
          setSubjects(data);
        }
        setLoadingSubjects(false);
      });
  }, [profile]);

  // Fetch chapters and available activity types for the selected subject
  useEffect(() => {
    if (!selectedSubject) {
      setChapters([]);
      setAvailableActivityTypes([]);
      return;
    }

    async function loadChaptersAndTypes() {
      try {
        const { data: chapterData } = await supabase
          .from('chapters')
          .select('*')
          .eq('subject_id', selectedSubject)
          .order('sort_order')
          .order('created_at');

        if (chapterData) {
          setChapters(chapterData);
          const chapterIds = chapterData.map(c => c.id);
          if (chapterIds.length > 0) {
            const { data: contentData } = await supabase
              .from('content')
              .select('activity_type')
              .in('chapter_id', chapterIds);

            if (contentData) {
              const types = Array.from(new Set(contentData.map((item: any) => item.activity_type)));
              setAvailableActivityTypes(types);
            } else {
              setAvailableActivityTypes([]);
            }
          } else {
            setAvailableActivityTypes([]);
          }
        } else {
          setChapters([]);
          setAvailableActivityTypes([]);
        }
      } catch (err) {
        console.error('Failed to load chapters:', err);
      }
    }

    loadChaptersAndTypes();
  }, [selectedSubject]);

  // Fetch weekly attempts count
  useEffect(() => {
    if (!profile?.id) return;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    supabase
      .from('activity_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .gte('created_at', oneWeekAgo.toISOString())
      .then(({ count }) => {
        setWeeklyCount(count || 0);
      });
  }, [profile]);

  const handleActivityClick = (type: string) => {
    if (!selectedSubject) {
      toast('Please select a subject first! 📚', 'error');
      return;
    }

    if (chapters.length === 0) {
      toast('No chapters available for the selected subject! 📚', 'error');
      return;
    }

    const chapterIds = chapters.map(c => c.id);
    const params = new URLSearchParams();
    chapterIds.forEach((id) => params.append('chapters', id));
    params.set('type', type);
    params.set('mode', 'practice');
    params.set('count', selectedQuestionCount);
    navigate(`/student/play?${params.toString()}`);
  };

  const handlePlayHero = () => {
    toast('Daily Activity is coming soon! 🚀', 'info');
  };

  // Weekly Goal helpers
  const weeklyTarget = 5;
  const progressPercent = Math.min(Math.round((weeklyCount / weeklyTarget) * 100), 100);
  const xpEarnedThisWeek = weeklyCount * 50;

  // Days left in week helper
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
  const daysLeft = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

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
    <div className="animate-fade-in">
      {/* Hero Section */}
      <section className="mb-12">
        <div className="relative w-full rounded-3xl overflow-hidden shadow-xl min-h-[330px] md:min-h-[360px] flex items-stretch bg-[#F1F5F9] border border-white/60">
          <div 
            className="absolute inset-0 bg-cover bg-right-top md:bg-right opacity-90 transition-transform duration-700 hover:scale-[1.02]"
            style={{
              backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCB5wlyxFaJt6Jvmh0rdbRaAMfLHjAzUXHkQnoOgR94MOOrKws2CCdlDAZbDmtihy1Rr4s9lMnLd714GJlgh3b2VQ1Vay9DIQdWzTLYFPuO_B2uKRN2IuHXuDqsjmG3SEij5EjCG0D3nW37_1yFcIlSvhS6G-vdGnlQCkxBseugS1ehGJMlE9klL3tA40eXturAiARTmFosacSmoZj_cG18A6_aNXZ80S0rKE2ymmbKJ5O_-hRmh-eD')"
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 md:via-white/70 to-transparent" />
          
          <div className="absolute bottom-6 right-6 md:bottom-8 md:right-8 z-20 flex items-center gap-2.5 bg-warning-50/80 backdrop-blur-xs border border-warning-100 px-4 py-2 rounded-2xl shadow-xs select-none">
            <Sparkles className="text-warning-600 fill-warning-100 animate-pulse" size={18} />
            <span className="font-extrabold text-sm text-warning-950">500 XP</span>
          </div>

          {/* Glassmorphic coming soon overlay */}
          <div className="absolute inset-0 z-30 bg-white/40 backdrop-blur-[1.5px] flex items-center justify-center pointer-events-auto">
            <div 
              onClick={handlePlayHero}
              className="flex items-center gap-3 bg-white/95 backdrop-blur-md px-6 py-3.5 rounded-2xl shadow-xl border border-slate-100/80 hover:scale-105 transition-transform cursor-pointer"
            >
              <div className="w-9 h-9 bg-primary-50 text-primary rounded-xl flex items-center justify-center shrink-0 border border-primary-100">
                <Sparkles size={18} className="animate-pulse text-primary" />
              </div>
              <div className="text-left">
                <h4 className="font-extrabold text-base text-surface-900 leading-none">Daily Activity</h4>
                <span className="text-[10px] font-black text-primary uppercase tracking-widest block mt-1 leading-none">🚀 Coming Soon</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 max-w-2xl p-6 md:p-8 flex flex-col items-start w-full flex-grow">
            <div className="flex flex-col items-start">
              <div className="flex flex-wrap items-center gap-2.5 mb-4">
                <div className="inline-flex items-center gap-1.5 bg-primary text-white px-3.5 py-1.5 rounded-full font-bold text-xs uppercase tracking-wider shadow-sm shadow-primary/20 select-none">
                  <span className="material-symbols-outlined text-[16px] animate-pulse">rocket_launch</span>
                  <span>DAILY ACTIVITY</span>
                </div>
                <span className="bg-amber-100 text-amber-800 text-xs font-black px-3 py-1 rounded-full border border-amber-200/80 shadow-xs flex items-center gap-1">
                  🚀 Coming Soon
                </span>
              </div>
              
              <h2 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-800 to-indigo-900 tracking-tight leading-none mb-2">
                Master the Number Line
              </h2>

              <p className="text-surface-600 font-semibold text-base mb-4 leading-relaxed">
                Level up your Math Skills and get ⭐500 XP
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-5">
                <div className="flex items-center gap-2.5 bg-primary-50/80 backdrop-blur-xs border border-primary-100 px-4 py-2 rounded-2xl">
                  <BookOpen className="text-primary-600" size={18} />
                  <span className="font-extrabold text-sm text-primary-900">
                    Mathematics
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handlePlayHero}
              className="font-extrabold px-8 py-3.5 rounded-2xl flex items-center justify-center gap-3 transition-all bouncy cursor-pointer shadow-lg bg-primary text-white shadow-primary-500/25 hover:bg-primary-600 hover:shadow-primary-500/35 mt-auto"
            >
              <span>Play</span>
              <Play size={20} className="fill-current" />
            </button>
          </div>
        </div>
      </section>

      {/* Play Zone */}
      <section className="mb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h3 className="text-2xl font-extrabold text-on-background">Play Zone</h3>
          <div className="flex items-center gap-3">
            {/* Question Count Dropdown */}
            <div className="relative">
              <select
                value={selectedQuestionCount}
                onChange={(e) => setSelectedQuestionCount(e.target.value)}
                className="appearance-none bg-white border border-surface-200 text-primary font-bold font-label-md text-label-md pl-5 pr-10 py-2.5 rounded-full cursor-pointer hover:bg-surface-50 transition-all focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-sm"
              >
                <option value="5">5 Questions</option>
                <option value="10">10 Questions</option>
                <option value="15">15 Questions</option>
                <option value="20">20 Questions</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </span>
            </div>

            {/* Subject Dropdown */}
            <div className="relative">
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                disabled={loadingSubjects || subjects.length === 0}
                className="appearance-none bg-white border border-surface-200 text-primary font-bold font-label-md text-label-md pl-5 pr-10 py-2.5 rounded-full cursor-pointer hover:bg-surface-50 transition-all focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-50 shadow-sm"
              >
                {loadingSubjects ? (
                  <option value="">Loading...</option>
                ) : subjects.length === 0 ? (
                  <option value="">No Subjects</option>
                ) : (
                  <>
                    <option value="">Select Subject</option>
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </>
                )}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
          {activities.map((activity) => {
            const isPlayable = ['quiz', 'flashcard', 'matching', 'picture', 'dragndrop'].includes(activity.key);
            const isContentAvailable = selectedSubject ? availableActivityTypes.includes(activity.key) : false;
            
            const handleClick = () => {
              if (activity.is_locked) {
                toast(`${activity.label} is locked 🔒`, 'error');
                return;
              }
              if (!selectedSubject) {
                toast('Please select a subject first! 📚', 'error');
                return;
              }
              if (!isContentAvailable) {
                toast(`${activity.label} is coming soon! 🚀`, 'info');
                return;
              }
              if (isPlayable) {
                handleActivityClick(activity.key);
              } else {
                toast(`${activity.label} is coming soon! 🚀`, 'info');
              }
            };

            const cardColor = activity.color || '#6366f1';
            return (
              <div
                key={activity.key}
                onClick={handleClick}
                className={`bg-white rounded-2xl p-5 bouncy cursor-pointer group border-surface-200 shadow-md flex items-start gap-4 h-full relative ${activity.is_locked ? 'opacity-70' : 'hover:border-primary/50'}`}
              >
                {activity.is_locked && (
                  <div className="absolute inset-0 rounded-2xl bg-surface-900/5 flex items-start justify-end p-2 pointer-events-none z-10">
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-slate-200">
                      <Lock size={9} /> Locked
                    </span>
                  </div>
                )}
                {!activity.is_locked && !selectedSubject && (
                  <div className="absolute inset-0 rounded-2xl bg-surface-900/5 flex items-start justify-end p-2 pointer-events-none z-10">
                    <span className="bg-sky-100 text-sky-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-sky-200">
                      📚 Select Subject
                    </span>
                  </div>
                )}
                {!activity.is_locked && selectedSubject && !isContentAvailable && (
                  <div className="absolute inset-0 rounded-2xl bg-surface-900/5 flex items-start justify-end p-2 pointer-events-none z-10">
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-amber-200">
                      🚀 Coming Soon
                    </span>
                  </div>
                )}
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-md shrink-0 self-center text-3xl drop-shadow-md"
                  style={{ background: `linear-gradient(135deg, ${cardColor}cc, ${cardColor})` }}
                >
                  {activity.emoji || '🎮'}
                </div>
                <div className="flex-grow">
                  <h4 className="font-bold text-on-background group-hover:text-primary-600 transition-colors text-base sm:text-lg">{activity.label}</h4>
                  <p className="text-sm text-on-surface-variant leading-snug font-semibold mt-0.5 line-clamp-2">{activity.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Performance Section */}
      <section className="mb-12">
        <h3 className="text-2xl font-extrabold text-on-background mb-6">My Stats</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter items-stretch">
          {/* Weekly Goal Card */}
          <div className="bg-white rounded-2xl p-6 border border-surface-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex justify-between items-center gap-4 opacity-30 select-none pointer-events-none">
              <div className="space-y-2">
                <h4 className="font-headline-sm text-headline-sm text-on-background font-bold leading-none">Weekly Goal</h4>
                <ul className="space-y-1.5 mt-3 text-sm font-bold">
                  {[
                    'Complete Chapter 1 Practice',
                    'Complete Chapter 2 Practice',
                    'Complete Chapter 3 Practice',
                    'Complete Chapter 4 Practice',
                    'Complete Chapter 5 Practice',
                  ].map((task, idx) => {
                    const isCompleted = idx < weeklyCount;
                    return (
                      <li 
                        key={idx} 
                        className={`flex items-center gap-1.5 ${
                          isCompleted ? 'text-surface-400 line-through' : 'text-on-surface-variant'
                        }`}
                      >
                        <span className={isCompleted ? 'text-success-600 font-bold' : 'text-surface-300'}>
                          {isCompleted ? '✔' : '○'}
                        </span>
                        <span>{task}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              
              {/* Circular Progress Bar */}
              <div className="relative flex items-center justify-center w-20 h-20 shrink-0">
                <svg className="absolute w-full h-full transform -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="30"
                    className="stroke-slate-100 fill-none"
                    strokeWidth="7"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="30"
                    className="stroke-primary fill-none transition-all duration-500 ease-out"
                    strokeWidth="7"
                    strokeDasharray={2 * Math.PI * 30}
                    strokeDashoffset={(2 * Math.PI * 30) - (progressPercent / 100) * (2 * Math.PI * 30)}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-sm font-black text-on-background">{progressPercent}%</span>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 mt-6 opacity-30 select-none pointer-events-none">
              <span className="flex items-center gap-1.5 bg-primary/10 px-3 py-1 rounded-full text-primary text-[11px] font-extrabold select-none">
                🔥 {xpEarnedThisWeek} XP
              </span>
              <span className="flex items-center gap-1.5 bg-amber-50 px-3 py-1 rounded-full text-amber-700 text-[11px] font-extrabold border border-amber-100/50 select-none">
                ⏰ {daysLeft === 0 ? 'Last day!' : `${daysLeft} day${daysLeft > 1 ? 's' : ''} left`}
              </span>
              <span className="text-xs text-on-surface-variant font-bold ml-1 select-none">
                {weeklyCount} of {weeklyTarget} tasks completed
              </span>
            </div>

            {/* Glassmorphic coming soon overlay */}
            <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-auto">
              <div className="flex items-center gap-3 bg-white/95 backdrop-blur-md px-5 py-3 rounded-2xl shadow-md border border-slate-100 animate-fade-in">
                <div className="w-8 h-8 bg-primary-50 text-primary rounded-xl flex items-center justify-center shrink-0 border border-primary-100">
                  <Trophy size={16} className="animate-pulse" />
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-sm text-surface-900 leading-none">Weekly Goals</h4>
                  <span className="text-[9px] font-extrabold text-primary uppercase tracking-wider block mt-1 leading-none">Coming Soon..</span>
                </div>
              </div>
            </div>
          </div>

          {/* Student Metrics Card */}
          <div className="bg-white rounded-2xl p-6 border border-surface-200 shadow-sm flex flex-col justify-between">
            <h4 className="font-headline-sm text-headline-sm text-on-background font-bold leading-none mb-4">Today I earned</h4>
            
            <div className="grid grid-cols-2 gap-3.5 flex-grow">
              {/* Stat 1: Points */}
              <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100 shadow-inner">
                <span className="text-2xl flex-shrink-0">⭐</span>
                <div>
                  <p className="text-[11px] text-on-surface-variant font-bold uppercase tracking-wider leading-none">Points</p>
                  <p className="text-base font-black text-on-surface mt-1">{stats.totalPoints} XP</p>
                </div>
              </div>

              {/* Stat 2: Played */}
              <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100 shadow-inner">
                <span className="text-2xl flex-shrink-0">🎮</span>
                <div>
                  <p className="text-[11px] text-on-surface-variant font-bold uppercase tracking-wider leading-none">Played</p>
                  <p className="text-base font-black text-on-surface mt-1">{stats.totalActivities} games</p>
                </div>
              </div>

              {/* Stat 3: Rank */}
              <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100 shadow-inner relative overflow-hidden">
                <div className="flex items-center gap-3 w-full opacity-30 select-none pointer-events-none">
                  <span className="text-2xl flex-shrink-0">🏆</span>
                  <div>
                    <p className="text-[11px] text-on-surface-variant font-bold uppercase tracking-wider leading-none">School Rank</p>
                    <p className="text-sm md:text-base font-black text-on-surface mt-1">{stats.schoolRank ? `#${stats.schoolRank}` : '—'}</p>
                  </div>
                </div>
                {/* Coming Soon Overlay */}
                <div className="absolute inset-0 bg-white/40 backdrop-blur-[0.5px] flex items-center justify-center pointer-events-auto">
                  <span className="bg-white/95 text-primary text-[8px] font-black px-2.5 py-1 rounded-lg border border-slate-100 shadow-xs uppercase tracking-widest leading-none select-none">
                    Coming Soon
                  </span>
                </div>
              </div>

              {/* Stat 4: Streak */}
              <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100 shadow-inner relative overflow-hidden">
                <div className="flex items-center gap-3 w-full opacity-30 select-none pointer-events-none">
                  <span className="text-2xl flex-shrink-0">🔥</span>
                  <div>
                    <p className="text-[11px] text-on-surface-variant font-bold uppercase tracking-wider leading-none">Streak</p>
                    <p className="text-base font-black text-on-surface mt-1">{weeklyCount > 0 ? `${weeklyCount + 1} Days` : '1 Day'}</p>
                  </div>
                </div>
                {/* Coming Soon Overlay */}
                <div className="absolute inset-0 bg-white/40 backdrop-blur-[0.5px] flex items-center justify-center pointer-events-auto">
                  <span className="bg-white/95 text-primary text-[8px] font-black px-2.5 py-1 rounded-lg border border-slate-100 shadow-xs uppercase tracking-widest leading-none select-none">
                    Coming Soon
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
