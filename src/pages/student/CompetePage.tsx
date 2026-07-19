import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { toast } from '../../components/ui/Toast';
import {
  Trophy,
  Play,
  Flame,
  Award,
  Sparkles,
  BookOpen,
  Calendar,
  Calculator,
  Monitor,
  Ticket,
} from 'lucide-react';

interface Chapter {
  id: string;
  name: string;
  subject_id: string;
  sort_order: number;
}

export default function CompetePage() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // Challenge mappings
  const [computerChallengeChapters, setComputerChallengeChapters] = useState<string[]>([]);
  const [mathChallengeChapters, setMathChallengeChapters] = useState<string[]>([]);

  // Resolved names for fallbacks
  const [tournamentSubjectName, setTournamentSubjectName] = useState('Science');
  const [computerChallengeName, setComputerChallengeName] = useState('Computer Book');
  const [mathChallengeName, setMathChallengeName] = useState('Math Book');

  useEffect(() => {
    async function loadCompeteData() {
      if (!profile?.class_id) {
        setLoading(false);
        return;
      }

      try {
        // 1. Fetch subjects in class
        const { data: subjectData, error: subjectError } = await supabase
          .from('subjects')
          .select('id, name')
          .eq('class_id', profile.class_id)
          .eq('school_id', profile.school_id)
          .order('name');

        if (subjectError) throw subjectError;
        const loadedSubjects = subjectData || [];

        // 2. Fetch all chapters for these subjects
        if (loadedSubjects.length > 0) {
          const subjectIds = loadedSubjects.map(s => s.id);
          const { data: chapterData, error: chapterError } = await supabase
            .from('chapters')
            .select('id, name, subject_id, sort_order')
            .in('subject_id', subjectIds)
            .order('sort_order')
            .order('created_at');

          if (chapterError) throw chapterError;
          const loadedChapters = chapterData || [];
          setChapters(loadedChapters);

          // 3. Map chapters to challenges dynamically based on subject names
          // Find Science / Computer
          const scienceSub = loadedSubjects.find(s => s.name.toLowerCase().includes('science') && !s.name.toLowerCase().includes('moral'));
          const computerSub = loadedSubjects.find(s => s.name.toLowerCase().includes('computer') || s.name.toLowerCase().includes('ict'));
          const mathSub = loadedSubjects.find(s => s.name.toLowerCase().includes('math'));
          // Fallbacks if primary subjects not found
          const fallback1 = loadedSubjects[0];
          const fallback2 = loadedSubjects[1] || loadedSubjects[0];

          // Set resolved challenge names
          setTournamentSubjectName(scienceSub ? scienceSub.name : (fallback1 ? fallback1.name : 'Science'));
          setComputerChallengeName(computerSub ? 'Computer Book' : (scienceSub ? 'Science Book' : (fallback1 ? `${fallback1.name} Book` : 'Computer Book')));
          setMathChallengeName(mathSub ? 'Math Book' : (fallback2 ? `${fallback2.name} Book` : 'Math Book'));

          // Resolve chapters
          const resolveChaptersForSub = (subId: string | undefined, count: number) => {
            if (!subId) return [];
            return loadedChapters
              .filter(c => c.subject_id === subId)
              .slice(0, count)
              .map(c => c.id);
          };

          // Computer Easy Challenge (needs 2 chapters)
          const computerChaps = resolveChaptersForSub(computerSub?.id || scienceSub?.id || fallback1?.id, 2);
          setComputerChallengeChapters(computerChaps);

          // Math Medium Challenge (needs 2 chapters)
          const mathChaps = resolveChaptersForSub(mathSub?.id || fallback2?.id, 2);
          setMathChallengeChapters(mathChaps);
        }

        // 4. Fetch recent competitive attempts


      } catch (err) {
        console.error('Error loading compete hub data:', err);
        toast('Failed to load challenge details.', 'error');
      } finally {
        setLoading(false);
      }
    }

    loadCompeteData();
  }, [profile]);

  const handleStartChallenge = () => {
    toast('Coming soon... 🚀', 'info');
  };

  const getChapterNumbersString = (chapterIds: string[]) => {
    if (chapterIds.length === 0) return 'Chapters : None';
    const firstChap = chapters.find(c => c.id === chapterIds[0]);
    if (!firstChap) {
      return `Chapters : ${chapterIds.map((_, i) => i + 1).join(', ')}`;
    }
    const subjectChapters = chapters.filter(c => c.subject_id === firstChap.subject_id);
    const indices = chapterIds.map(id => {
      const idx = subjectChapters.findIndex(c => c.id === id);
      return idx !== -1 ? idx + 1 : null;
    }).filter((idx): idx is number => idx !== null);

    return `Chapters : ${indices.join(', ')}`;
  };

  const getSubjectColorStyles = (subjectName: string | undefined) => {
    if (!subjectName) {
      return {
        logoBg: 'bg-violet-50/80 border-violet-100',
        iconText: 'text-violet-600',
        playBtn: 'bg-violet-100 text-violet-700 group-hover:bg-violet-600 group-hover:text-white hover:bg-violet-500 hover:text-white shadow-violet-500/10',
      };
    }
    const name = subjectName.toLowerCase();
    
    if (name.includes('math') || name.includes('algebra') || name.includes('calc') || name.includes('arithmetic')) {
      return {
        logoBg: 'bg-violet-50/80 border-violet-100',
        iconText: 'text-violet-600',
        playBtn: 'bg-violet-100 text-violet-700 group-hover:bg-violet-600 group-hover:text-white hover:bg-violet-500 hover:text-white shadow-violet-500/10',
      };
    }
    if (name.includes('science') || name.includes('physics') || name.includes('chemistry') || name.includes('biology') || name.includes('beaker') || name.includes('environmental')) {
      return {
        logoBg: 'bg-emerald-50/80 border-emerald-100',
        iconText: 'text-emerald-600',
        playBtn: 'bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white hover:bg-emerald-500 hover:text-white shadow-emerald-500/10',
      };
    }
    if (name.includes('social') || name.includes('sst') || name.includes('history') || name.includes('geography') || name.includes('civics') || name.includes('political')) {
      return {
        logoBg: 'bg-amber-50/80 border-amber-100',
        iconText: 'text-amber-600',
        playBtn: 'bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white hover:bg-amber-500 hover:text-white shadow-amber-500/10',
      };
    }
    if (name.includes('english') || name.includes('grammar') || name.includes('literature')) {
      return {
        logoBg: 'bg-rose-50/80 border-rose-100',
        iconText: 'text-rose-600',
        playBtn: 'bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white hover:bg-rose-500 hover:text-white shadow-rose-500/10',
      };
    }
    if (name.includes('computer') || name.includes('tech') || name.includes('coding') || name.includes('it') || name.includes('information')) {
      return {
        logoBg: 'bg-sky-50/80 border-sky-100',
        iconText: 'text-sky-600',
        playBtn: 'bg-sky-100 text-sky-700 group-hover:bg-sky-600 group-hover:text-white hover:bg-sky-500 hover:text-white shadow-sky-500/10',
      };
    }
    if (name.includes('hindi') || name.includes('sanskrit') || name.includes('language') || name.includes('urdu') || name.includes('moral')) {
      return {
        logoBg: 'bg-purple-50/80 border-purple-100',
        iconText: 'text-purple-600',
        playBtn: 'bg-purple-100 text-purple-700 group-hover:bg-purple-600 group-hover:text-white hover:bg-purple-500 hover:text-white shadow-purple-500/10',
      };
    }

    const styles = [
      {
        logoBg: 'bg-violet-50/80 border-violet-100',
        iconText: 'text-violet-600',
        playBtn: 'bg-violet-100 text-violet-700 group-hover:bg-violet-600 group-hover:text-white hover:bg-violet-500 hover:text-white shadow-violet-500/10',
      },
      {
        logoBg: 'bg-emerald-50/80 border-emerald-100',
        iconText: 'text-emerald-600',
        playBtn: 'bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white hover:bg-emerald-500 hover:text-white shadow-emerald-500/10',
      },
      {
        logoBg: 'bg-amber-50/80 border-amber-100',
        iconText: 'text-amber-600',
        playBtn: 'bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white hover:bg-amber-500 hover:text-white shadow-amber-500/10',
      },
      {
        logoBg: 'bg-rose-50/80 border-rose-100',
        iconText: 'text-rose-600',
        playBtn: 'bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white hover:bg-rose-500 hover:text-white shadow-rose-500/10',
      },
      {
        logoBg: 'bg-sky-50/80 border-sky-100',
        iconText: 'text-sky-600',
        playBtn: 'bg-sky-100 text-sky-700 group-hover:bg-sky-600 group-hover:text-white hover:bg-sky-500 hover:text-white shadow-sky-500/10',
      },
      {
        logoBg: 'bg-purple-50/80 border-purple-100',
        iconText: 'text-purple-600',
        playBtn: 'bg-purple-100 text-purple-700 group-hover:bg-purple-600 group-hover:text-white hover:bg-purple-500 hover:text-white shadow-purple-500/10',
      },
    ];
    let hash = 0;
    for (let i = 0; i < subjectName.length; i++) {
      hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % styles.length;
    return styles[index];
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-40">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-10 relative">
      {/* Glassmorphic coming soon overlay */}
      <div className="absolute inset-0 z-50 bg-slate-50/20 backdrop-blur-[1.5px] flex items-start justify-center pointer-events-auto">
        <div className="sticky top-[30vh] bg-white/95 backdrop-blur-md px-8 py-6 rounded-3xl shadow-xl border border-white max-w-sm text-center flex flex-col items-center gap-4 mt-20">
          <div className="p-3 bg-primary-50 rounded-2xl border border-primary-100 animate-bounce">
            <Trophy className="text-primary" size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-surface-900 tracking-tight">Compete Arena</h2>
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-widest mt-1">Coming Soon</p>
          </div>
          <p className="text-xs text-surface-500 font-medium leading-relaxed">
            Get ready to match up against your classmates, climb the leaderboard, and claim the championship!
          </p>
        </div>
      </div>
      <div className="space-y-6">
        {/* Header Block */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-surface-900 tracking-tight flex items-center gap-2">
              Compete Arena <Trophy className="text-warning-500 fill-warning-100 animate-pulse" size={28} />
            </h1>
            <p className="text-surface-500 font-medium mt-1">
              Race against the clock, earn double XP, and dominate the school rankings!
            </p>
          </div>
          <button
            onClick={() => navigate('/student/leaderboard')}
            className="flex items-center gap-2 bg-primary-50 border border-primary-100 text-primary-700 px-4 py-2 rounded-2xl text-sm font-bold shadow-xs hover:bg-primary-100/80 transition-all bouncy cursor-pointer select-none"
          >
            <Award size={16} className="text-primary fill-primary-200" />
            <span>View Leaderboard</span>
          </button>
        </div>

        <section className="relative w-full rounded-3xl overflow-hidden shadow-xl min-h-[330px] md:min-h-[360px] flex items-stretch bg-[#F1F5F9] border border-white/60">
          {/* Background Image with Opacity */}
          <div 
            className="absolute inset-0 bg-cover bg-right-top md:bg-right opacity-90 transition-transform duration-700 hover:scale-[1.02]"
            style={{
              backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAxydNH0QTfJIuEfCUYTnhpHeKmiusSvvreU5BlWCyzv47TDqW2lC3K5O3qvLNNKZXzD4kAlZhD-pQN0Uemn8s46dChE09f5zbUUrlNoBP5yqowvuuOliBudfvXBwnchBhgIP1zDA8RiNfDg6YYm8mmSV5c2fNbwkZFmxjcq5PsynuDUEInkTLo-kd7Mgdx4UtnZOHlMy4AoZQyhq8CovkOeYwRkv5F55MH03LdfBnbbVMCt88nvfzO')"
            }}
          />
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 md:via-white/70 to-transparent" />

          {/* Entry Fee Box in Top Right Corner */}
          <div className="absolute top-6 right-6 md:top-8 md:right-8 z-20 flex items-center gap-2.5 bg-red-50/80 backdrop-blur-xs border border-red-100 px-4 py-2 rounded-2xl shadow-xs select-none">
            <Ticket className="text-red-600 fill-red-100 animate-pulse" size={18} />
            <span className="font-extrabold text-sm text-red-600">Entry Fee : 100 XP</span>
          </div>

          <div className="relative z-10 max-w-2xl p-6 md:p-8 flex flex-col items-start w-full flex-grow">
            <div className="flex flex-col items-start">
              <div className="inline-flex items-center gap-1.5 bg-primary text-white px-3.5 py-1.5 rounded-full font-bold text-xs uppercase tracking-wider mb-4 shadow-sm shadow-primary/20 animate-bounce">
                <Flame size={14} className="fill-white" />
                <span>Weekly Challenge</span>
              </div>
              
              <h2 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-800 to-indigo-900 tracking-tight leading-none mb-2">
                {tournamentSubjectName.toUpperCase()} CHAMPION
              </h2>

              <p className="text-surface-600 font-semibold text-base mb-4 leading-relaxed">
                Test your knowledge across chapters and claim the ultimate crown!
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-5">
                <div className="flex items-center gap-2.5 bg-primary-50/80 backdrop-blur-xs border border-primary-100 px-4 py-2 rounded-2xl">
                  <BookOpen className="text-primary-600" size={18} />
                  <span className="font-extrabold text-sm text-primary-900">
                    {tournamentSubjectName}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-white/90 border border-surface-200 shadow-xs flex items-center justify-center select-none" title="Quiz Quest">
                    <span className="text-lg">⚡</span>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-white/90 border border-surface-200 shadow-xs flex items-center justify-center select-none" title="Match Mania">
                    <span className="text-lg">🧩</span>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-white/90 border border-surface-200 shadow-xs flex items-center justify-center select-none" title="Anagram">
                    <span className="text-lg">🔤</span>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-white/90 border border-surface-200 shadow-xs flex items-center justify-center select-none" title="Flash Flip">
                    <span className="text-lg">🔄</span>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-white/90 border border-surface-200 shadow-xs flex items-center justify-center select-none" title="Pic Picasso">
                    <span className="text-lg">🖼️</span>
                  </div>

                  <div className="w-px h-5 bg-surface-200 mx-1" />

                  <div className="w-9 h-9 rounded-full bg-white/90 border border-surface-200 shadow-xs flex items-center justify-center select-none" title="Worksheet">
                    <span className="text-lg">📄</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-auto">
              <button
                onClick={handleStartChallenge}
                className="font-extrabold px-8 py-3.5 rounded-2xl flex items-center justify-center gap-3 transition-all bouncy cursor-pointer shadow-lg bg-primary text-white shadow-primary-500/25 hover:bg-primary-600 hover:shadow-primary-500/35"
              >
                <span>Enter Arena</span>
                <Flame size={20} className="fill-current animate-pulse" />
              </button>
              
              <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-xs border border-surface-200/80 px-3.5 py-3 rounded-2xl shadow-xs select-none">
                <span className="text-base leading-none">⏱️</span>
                <span className="font-extrabold text-xs text-surface-700 uppercase tracking-wider">20 min</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Book Challenges Section */}
      <section className="space-y-6">
        <div>
          <h3 className="text-2xl font-extrabold text-surface-900">Book Challenges</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 max-w-2xl gap-6">
          {/* Card 1: Computer QuizQuest */}
          {(() => {
            const colors = getSubjectColorStyles(computerChallengeName.replace(' Book', ''));
            return (
              <div className="glass-card p-4 rounded-3xl flex flex-col group hover:translate-y-[-4px] transition-all duration-300 shadow-sm hover:shadow-md border border-white/60 relative overflow-hidden">
                <div className="flex justify-between items-start mb-3">
                  <div className={`p-2.5 rounded-xl border ${colors.logoBg}`}>
                    <Monitor className={`${colors.iconText} text-3xl`} size={28} />
                  </div>
                  <div className="flex items-center gap-1 bg-red-50 text-red-600 font-extrabold text-xs px-2.5 py-1 rounded-full border border-red-100 select-none">
                    <Ticket size={14} className="text-red-600 fill-red-100" />
                    <span>50 XP</span>
                  </div>
                </div>
                
                <h4 className="text-xl font-extrabold text-surface-900 mb-1">
                  {computerChallengeName}
                </h4>
                <p className="text-sm font-semibold text-surface-500 mb-1">
                  {getChapterNumbersString(computerChallengeChapters)}
                </p>

                <div className="mt-auto pt-3 flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    {/* Play Zone Icons */}
                    <div className="w-7 h-7 rounded-full bg-surface-50 border border-surface-200/80 flex items-center justify-center shadow-xs select-none" title="Quiz Quest">
                      <span className="text-xs">⚡</span>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-surface-50 border border-surface-200/80 flex items-center justify-center shadow-xs select-none" title="Flash Flip">
                      <span className="text-xs">🔄</span>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-surface-50 border border-surface-200/80 flex items-center justify-center shadow-xs select-none" title="Match Mania">
                      <span className="text-xs">🧩</span>
                    </div>
                    
                    {/* Separator divider */}
                    <div className="w-px h-3.5 bg-surface-200 mx-0.5" />
                    
                    {/* Test Zone Icon */}
                    <div className="w-7 h-7 rounded-full bg-surface-50 border border-surface-200/80 flex items-center justify-center shadow-xs select-none" title="Worksheet">
                      <span className="text-xs">📄</span>
                    </div>
                  </div>

                  <button
                    onClick={handleStartChallenge}
                    className={`p-2.5 rounded-full transition-all bouncy cursor-pointer flex items-center justify-center shadow-xs group-hover:shadow-md ${colors.playBtn}`}
                  >
                    <Play size={18} className="fill-current" />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Card 2: Math Flash Flip */}
          {(() => {
            const colors = getSubjectColorStyles(mathChallengeName.replace(' Book', ''));
            return (
              <div className="glass-card p-4 rounded-3xl flex flex-col group hover:translate-y-[-4px] transition-all duration-300 shadow-sm hover:shadow-md border border-white/60 relative overflow-hidden">
                <div className="flex justify-between items-start mb-3">
                  <div className={`p-2.5 rounded-xl border ${colors.logoBg}`}>
                    <Calculator className={`${colors.iconText} text-3xl`} size={28} />
                  </div>
                  <div className="flex items-center gap-1 bg-red-50 text-red-600 font-extrabold text-xs px-2.5 py-1 rounded-full border border-red-100 select-none">
                    <Ticket size={14} className="text-red-600 fill-red-100" />
                    <span>50 XP</span>
                  </div>
                </div>

                <h4 className="text-xl font-extrabold text-surface-900 mb-1">
                  {mathChallengeName}
                </h4>
                <p className="text-sm font-semibold text-surface-500 mb-1">
                  {getChapterNumbersString(mathChallengeChapters)}
                </p>

                <div className="mt-auto pt-3 flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    {/* Play Zone Icons */}
                    <div className="w-7 h-7 rounded-full bg-surface-50 border border-surface-200/80 flex items-center justify-center shadow-xs select-none" title="Quiz Quest">
                      <span className="text-xs">⚡</span>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-surface-50 border border-surface-200/80 flex items-center justify-center shadow-xs select-none" title="Flash Flip">
                      <span className="text-xs">🔄</span>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-surface-50 border border-surface-200/80 flex items-center justify-center shadow-xs select-none" title="Match Mania">
                      <span className="text-xs">🧩</span>
                    </div>
                    
                    {/* Separator divider */}
                    <div className="w-px h-3.5 bg-surface-200 mx-0.5" />
                    
                    {/* Test Zone Icon */}
                    <div className="w-7 h-7 rounded-full bg-surface-50 border border-surface-200/80 flex items-center justify-center shadow-xs select-none" title="Worksheet">
                      <span className="text-xs">📄</span>
                    </div>
                  </div>

                  <button
                    onClick={handleStartChallenge}
                    className={`p-2.5 rounded-full transition-all bouncy cursor-pointer flex items-center justify-center shadow-xs group-hover:shadow-md ${colors.playBtn}`}
                  >
                    <Play size={18} className="fill-current" />
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* Rules & Info */}
      <section className="w-full">
        <Card className="flex flex-col justify-between border border-surface-200/60 shadow-xs relative overflow-hidden bg-white">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50 rounded-full blur-3xl opacity-60" />
          <div className="relative z-10 space-y-4">
            <h4 className="text-lg font-extrabold text-surface-900 flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              <span>Competitive Rules</span>
            </h4>
            <ul className="space-y-3 text-sm font-medium text-surface-600">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                <span>Each matchup has a strictly time limit! Think fast.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                <span>Reveal your Rank by Earning rank points according to your position on leaderboard.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
                <span>Unlike practice mode, hints are disabled in the Challenges. It's pure skill!</span>
              </li>
            </ul>
          </div>
          <div className="pt-6 mt-6 border-t border-surface-100 flex items-center gap-3">
            <Calendar size={16} className="text-surface-400" />
            <span className="text-xs font-bold text-surface-400 uppercase tracking-wider">Challenges Ends in 4 days</span>
          </div>
        </Card>
      </section>
    </div>
  );
}
