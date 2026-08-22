import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Content, FlashcardPayload, PlayMode } from '../../lib/types';
import { RotateCw, Check, X, ArrowLeft } from 'lucide-react';
import {
  getActivePlaySession,
  updateActivePlaySession,
  clearActivePlaySession,
} from '../../lib/playSession';

interface FlashcardActivityProps {
  content: Content[];
  mode: PlayMode;
  onComplete: (score: number, total: number, correctQuestionIds: string[]) => void;
  timeLimit?: number;
  showHints: boolean;
}

export function FlashcardActivity({
  content,
  onComplete,
}: FlashcardActivityProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromUrl = searchParams.get('from');

  const savedSession = getActivePlaySession();
  const [currentIndex, setCurrentIndex] = useState<number>(() => savedSession?.currentIndex ?? 0);
  const [flipped, setFlipped] = useState(false);
  const [score, setScore] = useState<number>(() => savedSession?.score ?? 0);
  const [correctIds, setCorrectIds] = useState<string[]>(() => savedSession?.correctIds ?? []);

  const total = content.length;
  const currentCard = content[currentIndex];
  const payload = (currentCard?.payload || {}) as FlashcardPayload;
  const progress = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;

  const frontText = payload.front || payload.question || 'No question provided';
  const backText = payload.back || payload.answer || 'No answer provided';

  const handleExit = () => {
    clearActivePlaySession();
    if (fromUrl) {
      navigate(fromUrl);
    } else {
      navigate('/student/practice');
    }
  };

  const handleAnswer = useCallback((isCorrect: boolean) => {
    const currentId = currentCard?.id;
    const newScore = isCorrect ? score + 1 : score;
    const newCorrectIds = isCorrect && currentId ? [...correctIds, currentId] : correctIds;

    setScore(newScore);
    setCorrectIds(newCorrectIds);

    if (currentIndex + 1 >= total) {
      clearActivePlaySession();
      onComplete(newScore, total, newCorrectIds);
    } else {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setFlipped(false);
      updateActivePlaySession({
        currentIndex: nextIdx,
        score: newScore,
        correctIds: newCorrectIds,
      });
    }
  }, [currentCard?.id, currentIndex, total, score, correctIds, onComplete]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      setFlipped(false);
      updateActivePlaySession({ currentIndex: prevIdx });
    }
  }, [currentIndex]);

  const toggleFlip = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFlipped((prev) => !prev);
  }, []);

  // Keyboard shortcut listener for fast review (Space/F to flip, Left for incorrect, Right for correct)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space' || e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setFlipped((prev) => !prev);
      } else if (e.key === '1' || e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        handleAnswer(false);
      } else if (e.key === '2' || e.key === 'c' || e.key === 'C' || e.key === 'Enter') {
        e.preventDefault();
        handleAnswer(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAnswer]);

  return (
    <div className="w-full flex-1 flex flex-col h-[100dvh] max-h-[100dvh] bg-surface-50 select-none overflow-hidden animate-fade-in">
      {/* ── STICKY TOP BAR: Progress & Counter ── */}
      <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-surface-200/80 shadow-xs px-3 sm:px-6 py-2.5 sm:py-3 shrink-0">
        <div className="max-w-6xl mx-auto flex flex-col gap-2">
          <div className="flex items-center justify-between">
            {/* Exit / Back & Title */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleExit}
                className="p-1.5 sm:p-2 rounded-xl text-surface-500 hover:text-surface-900 hover:bg-surface-100 transition-colors cursor-pointer"
                title="Exit practice"
              >
                <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
              </button>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-surface-900 flex items-center gap-1.5">
                  <span>Flash Flip</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary font-bold hidden xs:inline-block border border-primary-200/50">
                    Practice
                  </span>
                </h2>
              </div>
            </div>

            {/* Score Badges & Counter */}
            <div className="flex items-center gap-3 sm:gap-5">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-2xs">
                  <Check size={13} className="stroke-[3]" />
                  <span>{score}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-200/60 shadow-2xs">
                  <X size={13} className="stroke-[3]" />
                  <span>{currentIndex - score}</span>
                </span>
              </div>

              <div className="text-xs sm:text-sm font-extrabold text-surface-600 bg-surface-100 px-3 py-1 rounded-xl border border-surface-200/70">
                Card <strong className="text-surface-900">{currentIndex + 1}</strong> / {total}
              </div>
            </div>
          </div>

          {/* Top Progress Bar */}
          <div className="h-2 w-full bg-surface-200/70 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-primary via-indigo-600 to-primary-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* ── CENTER: MAXIMIZED FULL-AREA FLASHCARD ── */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex flex-col items-stretch min-h-0 relative">
        <div
          className="w-full h-full flex-1 flex flex-col perspective-[1400px] cursor-pointer group min-h-0"
          onClick={() => toggleFlip()}
          style={{ perspective: 1400 }}
        >
          <div
            className="relative w-full h-full flex-1 rounded-3xl transition-transform duration-500 transform-3d"
            style={{
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {/* ── Front Card Face ── */}
            <div
              className="absolute inset-0 w-full h-full rounded-3xl bg-white border-2 border-surface-200/90 shadow-xl shadow-surface-300/30 p-5 sm:p-8 md:p-12 flex flex-col justify-between items-center text-center backface-hidden transition-all duration-200 group-hover:border-primary-300 overflow-hidden"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              {/* Top Tag Header */}
              <div className="w-full flex items-center justify-between shrink-0">
                <span className="text-xs sm:text-sm font-black uppercase tracking-widest px-3.5 py-1 rounded-full bg-primary-50 text-primary border border-primary-200/60 shadow-2xs">
                  Front
                </span>
                <span className="text-[11px] sm:text-xs text-surface-400 font-semibold flex items-center gap-1">
                  <RotateCw size={12} className="text-primary-500" /> Tap card or click Flip
                </span>
              </div>

              {/* Maximized Centered Text */}
              <div className="flex-1 w-full flex items-center justify-center my-auto px-2 sm:px-6 py-4 overflow-y-auto max-h-full">
                <p className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-surface-900 leading-tight sm:leading-snug break-words tracking-tight select-text">
                  {frontText}
                </p>
              </div>

              {/* Flip Button at bottom of card */}
              <div className="w-full flex items-center justify-center shrink-0 pt-2">
                <button
                  type="button"
                  onClick={toggleFlip}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-surface-100 hover:bg-surface-200/90 text-surface-700 text-xs sm:text-sm font-extrabold border border-surface-200/90 transition-all cursor-pointer shadow-xs hover:shadow-sm active:scale-95"
                >
                  <RotateCw size={15} className="text-primary stroke-[2.5]" />
                  <span>Flip Card</span>
                </button>
              </div>
            </div>

            {/* ── Back Card Face ── */}
            <div
              className="absolute inset-0 w-full h-full rounded-3xl bg-gradient-to-b from-indigo-50/40 via-white to-indigo-50/20 border-2 border-indigo-200/80 shadow-xl shadow-indigo-200/30 p-5 sm:p-8 md:p-12 flex flex-col justify-between items-center text-center backface-hidden transition-all duration-200 overflow-hidden"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              {/* Top Tag Header */}
              <div className="w-full flex items-center justify-between shrink-0">
                <span className="text-xs sm:text-sm font-black uppercase tracking-widest px-3.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-2xs">
                  Back
                </span>
                <span className="text-[11px] sm:text-xs text-primary-600 font-semibold flex items-center gap-1">
                  ✨ Answer Revealed
                </span>
              </div>

              {/* Maximized Centered Text */}
              <div className="flex-1 w-full flex items-center justify-center my-auto px-2 sm:px-6 py-4 overflow-y-auto max-h-full">
                <p className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-surface-800 leading-relaxed break-words tracking-tight select-text">
                  {backText}
                </p>
              </div>

              {/* Flip Back Button at bottom of card */}
              <div className="w-full flex items-center justify-center shrink-0 pt-2">
                <button
                  type="button"
                  onClick={toggleFlip}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-surface-100 hover:bg-surface-200/90 text-surface-700 text-xs sm:text-sm font-extrabold border border-surface-200/90 transition-all cursor-pointer shadow-xs hover:shadow-sm active:scale-95"
                >
                  <RotateCw size={15} className="text-primary stroke-[2.5]" />
                  <span>Flip Back</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── FIXED BOTTOM ACTION CONTROLS ── */}
      <footer className="sticky bottom-0 z-30 w-full bg-white/95 backdrop-blur-md border-t border-surface-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 sm:px-6 py-3 sm:py-4 shrink-0 pb-safe">
        <div className="max-w-xl mx-auto flex items-center justify-center gap-3 sm:gap-6">
          {/* Red Cross (❌ Incorrect) */}
          <button
            type="button"
            onClick={() => handleAnswer(false)}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 sm:py-4 px-4 sm:px-6 rounded-2xl font-black text-sm sm:text-base text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border-2 border-rose-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-98 transition-all cursor-pointer select-none"
            title="Mark as Incorrect"
          >
            <X size={24} className="stroke-[3] text-rose-600 shrink-0" />
            <span>Incorrect</span>
          </button>

          {/* Green Tick (✔️ Correct) */}
          <button
            type="button"
            onClick={() => handleAnswer(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 sm:py-4 px-4 sm:px-6 rounded-2xl font-black text-sm sm:text-base text-emerald-800 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border-2 border-emerald-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-98 transition-all cursor-pointer select-none"
            title="Mark as Correct"
          >
            <Check size={24} className="stroke-[3] text-emerald-600 shrink-0" />
            <span>Correct</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
