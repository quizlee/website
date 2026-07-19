import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { toast } from '../../components/ui/Toast';
import type { Subject, Chapter, Activity } from '../../lib/types';
import { X, ChevronLeft, ChevronRight, Check, BookOpen, Sparkles, Lock } from 'lucide-react';
import { Card } from '../../components/ui/Card';

// Gradient palettes for subject cards (cycles through these)
const SUBJECT_GRADIENTS = [
  { 
    from: 'from-violet-600', 
    to: 'to-indigo-700', 
    shadow: 'shadow-indigo-400/40',
    lightBg: 'bg-violet-50/70 border-violet-100/60 hover:border-violet-200',
    activeBg: 'bg-violet-200/75 border-violet-600 shadow-lg shadow-violet-600/20 text-violet-900',
    textActive: 'text-violet-700',
  },
  { 
    from: 'from-emerald-500', 
    to: 'to-teal-700', 
    shadow: 'shadow-teal-400/40',
    lightBg: 'bg-emerald-50/70 border-emerald-100/60 hover:border-emerald-200',
    activeBg: 'bg-emerald-200/75 border-emerald-600 shadow-lg shadow-emerald-600/20 text-emerald-900',
    textActive: 'text-emerald-700',
  },
  { 
    from: 'from-amber-500', 
    to: 'to-orange-600', 
    shadow: 'shadow-orange-400/40',
    lightBg: 'bg-amber-50/70 border-amber-100/60 hover:border-amber-200',
    activeBg: 'bg-amber-200/75 border-amber-500 shadow-lg shadow-amber-500/20 text-amber-900',
    textActive: 'text-amber-700',
  },
  { 
    from: 'from-rose-500', 
    to: 'to-pink-700', 
    shadow: 'shadow-pink-400/40',
    lightBg: 'bg-rose-50/70 border-rose-100/60 hover:border-rose-200',
    activeBg: 'bg-rose-200/75 border-rose-600 shadow-lg shadow-rose-600/20 text-rose-900',
    textActive: 'text-rose-700',
  },
  { 
    from: 'from-sky-500', 
    to: 'to-blue-700', 
    shadow: 'shadow-blue-400/40',
    lightBg: 'bg-sky-50/70 border-sky-100/60 hover:border-sky-200',
    activeBg: 'bg-sky-200/75 border-sky-600 shadow-lg shadow-sky-600/20 text-sky-900',
    textActive: 'text-sky-700',
  },
  { 
    from: 'from-purple-500', 
    to: 'to-fuchsia-700', 
    shadow: 'shadow-fuchsia-400/40',
    lightBg: 'bg-purple-50/70 border-purple-100/60 hover:border-purple-200',
    activeBg: 'bg-purple-200/75 border-purple-600 shadow-lg shadow-purple-600/20 text-purple-900',
    textActive: 'text-purple-700',
  },
];

const getSubjectGradient = (subjectName: string | undefined) => {
  if (!subjectName) return SUBJECT_GRADIENTS[0];
  const name = subjectName.toLowerCase();
  if (name.includes('math') || name.includes('algebra') || name.includes('calc') || name.includes('arithmetic')) {
    return SUBJECT_GRADIENTS[0]; // Violet/Indigo
  }
  if (name.includes('science') || name.includes('physics') || name.includes('chemistry') || name.includes('biology') || name.includes('beaker') || name.includes('environmental')) {
    return SUBJECT_GRADIENTS[1]; // Emerald/Teal
  }
  if (name.includes('social') || name.includes('sst') || name.includes('history') || name.includes('geography') || name.includes('civics') || name.includes('political')) {
    return SUBJECT_GRADIENTS[2]; // Amber/Orange
  }
  if (name.includes('english') || name.includes('grammar') || name.includes('literature')) {
    return SUBJECT_GRADIENTS[3]; // Rose/Pink
  }
  if (name.includes('computer') || name.includes('tech') || name.includes('coding') || name.includes('it') || name.includes('information')) {
    return SUBJECT_GRADIENTS[4]; // Sky/Blue
  }
  if (name.includes('hindi') || name.includes('sanskrit') || name.includes('language') || name.includes('urdu') || name.includes('moral')) {
    return SUBJECT_GRADIENTS[5]; // Purple/Fuchsia
  }
  
  // Deterministic fallback based on hashing name
  let hash = 0;
  for (let i = 0; i < subjectName.length; i++) {
    hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % SUBJECT_GRADIENTS.length;
  return SUBJECT_GRADIENTS[index];
};

export default function PracticePage() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const chapterScrollRef = useRef<HTMLDivElement>(null);

  // Curriculum state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedSubjectIdx, setSelectedSubjectIdx] = useState(() => {
    const saved = sessionStorage.getItem('practice_selected_subject_idx');
    return saved ? Number(saved) : 0;
  });
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingChapters, setLoadingChapters] = useState(false);

  // Inline chapter selection (on the page itself)
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('practice_selected_chapters');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    sessionStorage.setItem('practice_selected_subject_idx', selectedSubjectIdx.toString());
  }, [selectedSubjectIdx]);

  useEffect(() => {
    sessionStorage.setItem('practice_selected_chapters', JSON.stringify(selectedChapterIds));
  }, [selectedChapterIds]);

  // Modal state
  const [activeActivityType, setActiveActivityType] = useState<string | null>(null);
  const [selectedPlayMode, setSelectedPlayMode] = useState<'practice' | 'competitive'>('practice');
  const [selectedQuestionCount, setSelectedQuestionCount] = useState<string>('10');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Activities from DB (dynamic, admin-managed)
  const [activities, setActivities] = useState<Activity[]>([]);

  // Fetch activities from DB on mount
  useEffect(() => {
    supabase
      .from('activities')
      .select('*')
      .eq('is_active', true)
      .order('zone')
      .order('sort_order')
      .then(({ data }) => {
        if (data) setActivities(data as Activity[]);
      });
  }, []);

  const [availableActivityTypes, setAvailableActivityTypes] = useState<string[]>([]);

  useEffect(() => {
    if (selectedChapterIds.length === 0) {
      setAvailableActivityTypes([]);
      return;
    }

    supabase
      .from('content')
      .select('activity_type')
      .in('chapter_id', selectedChapterIds)
      .then(({ data }) => {
        if (data) {
          const types = Array.from(new Set(data.map((item: any) => item.activity_type)));
          setAvailableActivityTypes(types);
        } else {
          setAvailableActivityTypes([]);
        }
      });
  }, [selectedChapterIds]);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = isConfigModalOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isConfigModalOpen]);

  const getActivityEmoji = () => {
    const act = activities.find(a => a.key === activeActivityType);
    return act?.emoji || '🎮';
  };

  const selectedSubject = subjects[selectedSubjectIdx] ?? null;
  const gradient = getSubjectGradient(selectedSubject?.name);

  // Fetch subjects
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
        if (data) setSubjects(data);
        setLoadingSubjects(false);
      });
  }, [profile]);

  // Fetch chapters when subject changes
  useEffect(() => {
    if (!selectedSubject) { setChapters([]); return; }
    setLoadingChapters(true);
    supabase
      .from('chapters')
      .select('*')
      .eq('subject_id', selectedSubject.id)
      .order('sort_order')
      .order('created_at')
      .then(({ data }) => {
        if (data) {
          setChapters(data);
          const validIds = data.map((c) => c.id);
          setSelectedChapterIds((prev) => prev.filter((id) => validIds.includes(id)));
        }
        setLoadingChapters(false);
        // Scroll chapter list back to start
        if (chapterScrollRef.current) chapterScrollRef.current.scrollLeft = 0;
      });
  }, [selectedSubject?.id]);


  // Toggle a chapter in the inline selection
  const handleToggleChapter = (chapterId: string) => {
    const ch = chapters.find((c) => c.id === chapterId);
    if (ch?.is_locked) {
      toast('This chapter is locked! 🔒', 'error');
      return;
    }
    setSelectedChapterIds((prev) =>
      prev.includes(chapterId) ? prev.filter((id) => id !== chapterId) : [...prev, chapterId]
    );
  };

  // Open modal for a given activity type
  const handleActivityClick = (type: string) => {
    if (selectedChapterIds.length === 0) {
      toast('Pick at least one chapter above first! 📚', 'error');
      return;
    }
    setActiveActivityType(type);
    setSelectedPlayMode('practice');
    setSelectedQuestionCount('10');
    setIsConfigModalOpen(true);
  };

  const handleStartQuiz = () => {
    if (selectedChapterIds.length === 0) {
      toast('Please select at least one chapter! 📚', 'error');
      return;
    }
    const params = new URLSearchParams();
    selectedChapterIds.forEach((id) => params.append('chapters', id));
    params.set('type', activeActivityType || 'quiz');
    params.set('mode', selectedPlayMode);
    if (selectedPlayMode === 'practice') params.set('count', selectedQuestionCount);
    setIsConfigModalOpen(false);
    navigate(`/student/play?${params.toString()}`);
  };

  const handleComingSoonClick = (feature: string) => {
    toast(`${feature} is coming soon! 🚀`, 'info');
  };

  // Scroll chapter strip
  const scrollChapters = (dir: 'left' | 'right') => {
    if (!chapterScrollRef.current) return;
    chapterScrollRef.current.scrollBy({ left: dir === 'right' ? 260 : -260, behavior: 'smooth' });
  };

  // Guard: class not set
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
    <div className="animate-fade-in space-y-6">

      {/* Header Block / Instructions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-surface-900 tracking-tight flex items-center gap-2">
            Practice Arena <BookOpen className="text-primary-500 fill-primary-100 animate-pulse" size={28} />
          </h1>
          <p className="text-surface-500 font-medium mt-1">
            Pick a subject, select your chapters, and start any activity below to test your knowledge!
          </p>
        </div>
        <div className="flex items-center gap-2 bg-primary-50 border border-primary-100 text-primary-700 px-4 py-2 rounded-2xl text-sm font-bold shadow-xs select-none">
          <Sparkles size={16} className="text-primary fill-primary-200" />
          <span>Learn at your own pace</span>
        </div>
      </div>

      {/* ── Subject + Chapter Selector ─────────────────────────────── */}
      <section className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter items-stretch">

          {/* Left: Subject Card — stretched to match right column height */}
          <div className="md:col-span-3 flex flex-col min-h-[170px]">
            <div className={`relative rounded-3xl overflow-hidden h-full flex flex-col p-5 bg-gradient-to-br ${gradient.from} ${gradient.to} shadow-xl ${gradient.shadow}`}>
              {/* Decorative blobs */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

              {loadingSubjects ? (
                <div className="relative z-10 flex items-center gap-2 text-white/70">
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span className="text-sm font-semibold">Loading…</span>
                </div>
              ) : subjects.length === 0 ? (
                <p className="relative z-10 text-white/80 text-sm font-semibold">No subjects found</p>
              ) : (
                <>
                  {/* Badge + title + count — all top-left */}
                  <div className="relative z-10 flex flex-col gap-1">
                    <div className="inline-flex items-center bg-white/20 backdrop-blur-sm text-white/90 px-3 py-1 rounded-full text-xs font-bold border border-white/20 self-start">
                      SUBJECT
                    </div>
                    <h2 className="font-headline-md text-headline-sm text-white font-bold leading-tight mt-1">
                      {selectedSubject?.name ?? '—'}
                    </h2>
                    <div className="flex items-center gap-1.5 text-white/80 text-xs font-semibold">
                      <span className="material-symbols-outlined text-[14px]">menu_book</span>
                      {loadingChapters ? 'Loading…' : `${chapters.length} Chapter${chapters.length !== 1 ? 's' : ''}`}
                    </div>
                  </div>

                  {/* Dropdown — pushed to bottom and right-aligned */}
                  <div className="relative z-10 mt-auto flex justify-end">
                    {subjects.length > 1 && (
                      <div className="relative">
                        <select
                          value={selectedSubjectIdx}
                          onChange={(e) => setSelectedSubjectIdx(Number(e.target.value))}
                          className="appearance-none bg-white/20 backdrop-blur-sm border border-white/30 text-white font-bold font-label-md text-xs pl-4 pr-8 py-1.5 rounded-full cursor-pointer hover:bg-white/30 transition-all focus:outline-none shadow-sm"
                        >
                          {subjects.map((sub, i) => (
                            <option key={sub.id} value={i} className="text-on-background bg-white font-semibold">
                              {sub.name}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: Chapter Cards */}
          <div className="md:col-span-9 flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant select-none">
                  {selectedChapterIds.length === 0
                    ? 'Select Chapters to Practice'
                    : `${selectedChapterIds.length} Chapter${selectedChapterIds.length > 1 ? 's' : ''} selected`
                  }
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {selectedChapterIds.length > 0 && (
                  <button
                    onClick={() => setSelectedChapterIds([])}
                    className="text-xs text-on-surface-variant hover:text-primary font-bold transition-colors cursor-pointer px-3 py-1.5 rounded-full hover:bg-surface-container-low"
                  >
                    Clear all
                  </button>
                )}
                <button
                  onClick={() => scrollChapters('left')}
                  className="w-8 h-8 rounded-full bg-white border border-surface-200 shadow-sm flex items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary/30 transition-colors cursor-pointer"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  onClick={() => scrollChapters('right')}
                  className="w-8 h-8 rounded-full bg-white border border-surface-200 shadow-sm flex items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary/30 transition-colors cursor-pointer"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            {/* Scrollable chapter strip */}
            <div
              ref={chapterScrollRef}
              className="flex gap-4 overflow-x-auto pb-5 snap-x scroll-smooth"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {loadingChapters ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="snap-start min-w-[190px] h-[130px] bg-surface-container-low rounded-2xl animate-pulse flex-shrink-0" />
                ))
              ) : chapters.length === 0 ? (
                <div className="flex items-center justify-center w-full h-[130px] text-on-surface-variant text-sm font-semibold">
                  No chapters found for this subject.
                </div>
              ) : (
                chapters.map((ch, idx) => {
                  const isSelected = selectedChapterIds.includes(ch.id);
                  const isLocked = ch.is_locked;
                  return (
                    <div
                      key={ch.id}
                      onClick={() => handleToggleChapter(ch.id)}
                      className={`snap-start w-[190px] h-[130px] rounded-2xl p-3 flex flex-col justify-start select-none transition-all duration-200 flex-shrink-0 relative border-2 ${
                        isLocked
                          ? 'border-slate-200 bg-slate-50/80 text-slate-400 cursor-not-allowed shadow-xs'
                          : isSelected
                          ? gradient.activeBg
                          : `${gradient.lightBg} shadow-md hover:shadow-lg cursor-pointer`
                      }`}
                    >
                      {/* Top row: chapter badge */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase shadow-xs transition-all duration-200 ${
                          isLocked
                            ? 'bg-slate-200/60 text-slate-500 border border-slate-300/40'
                            : isSelected 
                            ? `bg-gradient-to-br ${gradient.from} ${gradient.to} text-white border border-transparent` 
                            : 'bg-white text-on-surface-variant border border-surface-200/80'
                        }`}>
                          Chapter {idx + 1}
                        </span>
                      </div>

                      {/* Chapter name — top aligned */}
                      <h4 className={`font-headline-sm text-[15px] font-bold leading-snug transition-colors ${
                        isLocked
                          ? 'text-slate-400'
                          : isSelected 
                          ? gradient.textActive 
                          : 'text-on-surface'
                      }`}>
                        {ch.name}
                      </h4>

                      {/* Glassmorphic Lock Overlay */}
                      {isLocked && (
                        <div className="absolute inset-0 bg-slate-100/10 backdrop-blur-[0.5px] rounded-[14px] flex items-center justify-center z-10">
                          <div className="bg-white/95 p-2 rounded-full shadow-md text-slate-500 border border-slate-200 transition-transform duration-200 hover:scale-105">
                            <Lock size={15} />
                          </div>
                        </div>
                      )}

                      {/* Active Badge — bottom left */}
                      {!isLocked && ch.is_active && (
                        <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-white text-emerald-600 border-emerald-200 shadow-sm">
                          🟢 Active
                        </div>
                      )}

                      {/* Selection Checkmark / Circle — bottom right */}
                      {!isLocked && (
                        isSelected ? (
                          <div className={`absolute bottom-3 right-3 w-5 h-5 rounded-full flex items-center justify-center shadow-xs text-white bg-gradient-to-br ${gradient.from} ${gradient.to}`}>
                            <Check size={11} strokeWidth={3.5} />
                          </div>
                        ) : (
                          <div className="absolute bottom-3 right-3 w-5 h-5 rounded-full border-2 border-slate-300/80 bg-white/65 transition-all duration-200" />
                        )
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Test Zone (dynamic from DB) ──────────────────────────────── */}
      <section className="mb-12 pt-6">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-extrabold text-surface-900 tracking-tight">Test Zone</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
          {activities.filter(a => a.zone === 'test').map((activity) => {
            const cardColor = activity.color || '#6366f1';
            const isContentAvailable = selectedChapterIds.length === 0 || availableActivityTypes.includes(activity.key);
            return (
              <div
                key={activity.key}
                onClick={() => {
                  if (activity.is_locked) {
                    toast(`${activity.label} is locked 🔒`, 'error');
                    return;
                  }
                  if (selectedChapterIds.length === 0) {
                    toast('Pick at least one chapter above first! 📚', 'error');
                    return;
                  }
                  if (!isContentAvailable) {
                    toast(`${activity.label} is coming soon! 🚀`, 'info');
                    return;
                  }
                  handleComingSoonClick(activity.label);
                }}
                className={`bg-white rounded-2xl p-5 bouncy cursor-pointer group border-surface-200 shadow-md relative flex items-start gap-4 h-full ${activity.is_locked ? 'opacity-70' : 'hover:border-primary/50'}`}
              >
                {activity.is_locked && (
                  <div className="absolute inset-0 rounded-2xl bg-surface-900/5 flex items-start justify-end p-2 pointer-events-none z-10">
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-slate-200">
                      <Lock size={9} /> Locked
                    </span>
                  </div>
                )}
                {!activity.is_locked && selectedChapterIds.length > 0 && !isContentAvailable && (
                  <div className="absolute inset-0 rounded-2xl bg-surface-900/5 flex items-start justify-end p-2 pointer-events-none z-10">
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-amber-200">
                      🚀 Coming Soon
                    </span>
                  </div>
                )}
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-md shrink-0 self-center text-3xl"
                  style={{ background: `linear-gradient(135deg, ${cardColor}cc, ${cardColor})` }}
                >
                  {activity.emoji || '📄'}
                </div>
                <div className="flex-grow min-w-0">
                  <h4 className="font-bold text-on-background group-hover:text-primary-600 transition-colors text-base sm:text-lg">{activity.label}</h4>
                  <p className="text-sm text-on-surface-variant leading-snug font-semibold mt-0.5 line-clamp-2">{activity.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Play Zone (dynamic from DB) ──────────────────────────────── */}
      <section className="mb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h3 className="text-2xl font-extrabold text-surface-900 tracking-tight">Play Zone</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
          {activities.filter(a => a.zone === 'play').map((activity) => {
            const isPlayable = ['quiz', 'flashcard', 'matching', 'picture', 'dragndrop'].includes(activity.key);
            const cardColor = activity.color || '#6366f1';
            const isContentAvailable = selectedChapterIds.length === 0 || availableActivityTypes.includes(activity.key);
            const handleClick = () => {
              if (activity.is_locked) {
                toast(`${activity.label} is locked 🔒`, 'error');
                return;
              }
              if (selectedChapterIds.length === 0) {
                toast('Pick at least one chapter above first! 📚', 'error');
                return;
              }
              if (!isContentAvailable) {
                toast(`${activity.label} is coming soon! 🚀`, 'info');
                return;
              }
              if (isPlayable) {
                handleActivityClick(activity.key);
              } else {
                handleComingSoonClick(activity.label);
              }
            };
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
                {!activity.is_locked && selectedChapterIds.length > 0 && !isContentAvailable && (
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

      {/* Rules & Info */}
      <section className="w-full">
        <Card className="flex flex-col justify-between border border-surface-200/60 shadow-xs relative overflow-hidden bg-white">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50 rounded-full blur-3xl opacity-60" />
          <div className="relative z-10 space-y-4">
            <h4 className="text-lg font-extrabold text-surface-900 flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              <span>Practice Rules</span>
            </h4>
            <ul className="space-y-3 text-sm font-medium text-surface-600">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                <span>Learn at your own pace with **no time limits** or pressure in practice mode.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                <span>Use **hints** and step-by-step explanations whenever you get stuck.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
                <span>Earn 5 XP for every correct answer, plus bonus points for completing the entire activity!</span>
              </li>
            </ul>
          </div>
          <div className="pt-6 mt-6 border-t border-surface-100 flex items-center gap-3">
            <BookOpen size={16} className="text-surface-400" />
            <span className="text-xs font-bold text-surface-400 uppercase tracking-wider">Keep practicing to build your streak</span>
          </div>
        </Card>
      </section>

      {/* ── Activity Configuration Modal ───────────────────────────── */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-on-background/40 backdrop-blur-md"
            onClick={() => setIsConfigModalOpen(false)}
          />
          <div className="relative bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in border border-surface-100 z-10">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-surface-200">
              <h3 className="font-headline-sm text-headline-sm text-on-background flex items-center gap-2">
                <span>{getActivityEmoji()}</span> Activity Setup
              </h3>
              <button
                className="p-1.5 rounded-full hover:bg-surface-100 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                onClick={() => setIsConfigModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 md:p-8 flex flex-col gap-6 max-h-[80vh] overflow-y-auto">

              {/* Selected chapters summary */}
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-3 uppercase tracking-wider text-xs font-bold">
                  Chapters ({selectedChapterIds.length})
                </label>
                <div className="flex flex-wrap gap-2">
                  {selectedChapterIds.map((id) => {
                    const ch = chapters.find((c) => c.id === id);
                    return ch ? (
                      <span key={id} className="bg-primary/10 text-primary text-xs font-bold px-3 py-1.5 rounded-full border border-primary/20">
                        {ch.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>

              {/* Question Count */}
              <div className="animate-fade-in">
                <label className="block font-label-md text-label-md text-on-surface-variant mb-3 uppercase tracking-wider text-xs font-bold">
                  Question Count
                </label>
                <div className="flex justify-between gap-2">
                  {['5', '10', '15', '20'].map((count) => {
                    const isSel = selectedQuestionCount === count;
                    return (
                      <button
                        key={count}
                        onClick={() => setSelectedQuestionCount(count)}
                        className={`flex-1 py-2.5 rounded-full border transition-all font-bold cursor-pointer text-sm ${
                          isSel
                            ? 'border-[#6133E3] bg-[#F1EAFF] text-[#6133E3] shadow-sm'
                            : 'border-surface-200 hover:border-[#6133E3] hover:text-[#6133E3] text-on-surface-variant bg-white'
                        }`}
                      >
                        {count}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStartQuiz}
                className="w-full bg-gradient-to-r from-primary to-indigo-700 text-white py-4 rounded-2xl font-headline-sm text-headline-sm bouncy shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all mt-2 cursor-pointer text-center font-bold"
              >
                Start {activeActivityType === 'quiz' ? 'Quiz' : activeActivityType === 'flashcard' ? 'Flashcards' : activeActivityType === 'matching' ? 'Matching' : 'Activity'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
