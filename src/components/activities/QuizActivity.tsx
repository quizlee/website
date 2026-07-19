import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Content, QuizPayload, PlayMode } from '../../lib/types';

interface QuizActivityProps {
  content: Content[];
  mode: PlayMode;
  onComplete: (score: number, total: number, correctQuestionIds: string[]) => void;
  timeLimit?: number;
  showHints: boolean;
}

export function QuizActivity({
  content,
  mode: _mode,
  onComplete,
  timeLimit,
  showHints,
}: QuizActivityProps) {
  const navigate = useNavigate();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => Array(content.length).fill(null));
  const [hintsShown, setHintsShown] = useState<boolean[]>(() => Array(content.length).fill(false));
  const [timeLeft, setTimeLeft] = useState(timeLimit || 0);

  const [shuffledIndices, setShuffledIndices] = useState<number[]>(() => {
    if (content[0]?.payload) {
      const qPayload = content[0].payload as QuizPayload;
      if (qPayload.options) {
        return qPayload.options.map((_, i) => i).sort(() => Math.random() - 0.5);
      }
    }
    return [];
  });

  const currentQuestion = content[currentIndex];
  const payload = currentQuestion?.payload as QuizPayload;

  useEffect(() => {
    if (payload?.options) {
      const indices = payload.options.map((_, i) => i);
      const shuffled = [...indices].sort(() => Math.random() - 0.5);
      setShuffledIndices(shuffled);
    }
  }, [currentIndex, payload]);
  const total = content.length;
  const progress = (currentIndex / total) * 100;

  // Calculate score dynamically based on answers array
  const score = content.reduce((acc, q, idx) => {
    const ans = answers[idx];
    const qPayload = q.payload as QuizPayload;
    if (ans !== null && ans === qPayload.correct_answer) {
      return acc + 1;
    }
    return acc;
  }, 0);

  const getCorrectQuestionIds = () => {
    return content
      .filter((q, idx) => {
        const ans = answers[idx];
        const qPayload = q.payload as QuizPayload;
        return ans !== null && ans === qPayload.correct_answer;
      })
      .map(q => q.id);
  };

  // Timer for competitive mode
  useEffect(() => {
    if (!timeLimit) return;
    if (timeLeft <= 0) {
      onComplete(score, total, getCorrectQuestionIds());
      return;
    }

    // Pause timer if the current question has been answered or skipped
    if (answers[currentIndex] !== null) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, timeLimit, score, total, onComplete, answers, currentIndex]);

  // Reset timer on question change in competitive mode
  useEffect(() => {
    if (timeLimit) {
      setTimeLeft(timeLimit);
    }
  }, [currentIndex, timeLimit]);

  function handleAnswer(optionIndex: number) {
    if (answers[currentIndex] !== null) return;

    const newAnswers = [...answers];
    newAnswers[currentIndex] = optionIndex;
    setAnswers(newAnswers);
  }

  function handleNext() {
    if (currentIndex + 1 >= total) {
      onComplete(score, total, getCorrectQuestionIds());
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  }

  function handleSkip() {
    if (answers[currentIndex] !== null) return;
    
    const newAnswers = [...answers];
    newAnswers[currentIndex] = -1; // -1 represents skipped
    setAnswers(newAnswers);

    // If it's the last question, show the result screen immediately
    if (currentIndex + 1 >= total) {
      onComplete(score, total, getCorrectQuestionIds());
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const selectedAnswer = answers[currentIndex];
  const isAnswered = selectedAnswer !== null;

  return (
    <div className="animate-fade-in font-sans min-h-screen flex flex-col bg-white text-on-surface">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-50 bg-white border-b border-surface-100 shadow-sm relative">
        <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-4 flex justify-between items-center w-full">
          <div className="flex items-center gap-8">
            <h1 
              onClick={() => navigate('/student')}
              className="font-headline-md text-headline-md font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary tracking-tight filter drop-shadow-sm cursor-pointer select-none"
            >
              Quizlee
            </h1>
            <div className="h-6 w-[2px] bg-slate-200"></div>
            <span className="font-headline-sm text-on-surface-variant text-lg font-bold select-none">
              Quiz Quest
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Question count / total centerpiece for layout context */}
            <div className="flex flex-col items-center select-none mr-2">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Question</span>
              <span className="text-sm text-on-surface font-bold">
                {currentIndex + 1} <span className="text-slate-300">/ {total}</span>
              </span>
            </div>

            {timeLimit && (
              <div className={`rounded-full px-3 py-1 flex items-center gap-1.5 border select-none font-extrabold text-xs transition-all duration-300 ${
                timeLeft <= 10 
                  ? 'animate-pulse-glow border-danger-200 bg-danger-50 text-danger-700 font-black' 
                  : 'bg-primary-50 border-primary-100 text-primary'
              }`}>
                <span className="material-symbols-outlined text-sm font-black" style={{ fontVariationSettings: '"FILL" 1' }}>
                  timer
                </span>
                <span className="timer-glow">
                  {formatTime(timeLeft)}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Layout Centered Container */}
      <main className="flex-grow max-w-[800px] mx-auto w-full px-4 py-6 md:py-10 flex flex-col gap-6 mb-28">
        {/* Question Card */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border-2 border-primary-100 relative overflow-hidden backglow-purple">
          <h2 className="font-headline-md text-xl md:text-2xl text-on-surface leading-tight font-extrabold font-quicksand">
            {payload.question}
          </h2>

          {/* Hint Trigger / Hint Box (placed below the question inside the question card with no rounded borders) */}
          {showHints && payload.hint && (
            <div className="mt-4">
              {!hintsShown[currentIndex] ? (
                <button
                  onClick={() => {
                    const newHints = [...hintsShown];
                    newHints[currentIndex] = true;
                    setHintsShown(newHints);
                  }}
                  className="flex items-center gap-1.5 text-sm text-amber-600 font-bold hover:text-amber-700 cursor-pointer hover:scale-105 transition-transform font-quicksand"
                >
                  <span className="material-symbols-outlined text-amber-500 text-base" style={{ fontVariationSettings: '"FILL" 1' }}>
                    emoji_objects
                  </span>
                  hint?
                </button>
              ) : (
                <div className="text-base text-amber-800 bg-amber-50/70 px-4 py-3 rounded-none animate-slide-up flex items-start gap-2 font-medium">
                  <span className="text-lg select-none">💡</span>
                  <p>{payload.hint}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {shuffledIndices.map((originalIndex, displayIndex) => {
            const option = payload.options[originalIndex];
            const letter = String.fromCharCode(65 + displayIndex); // A, B, C, D
            
            // Classes for different states
            let buttonStyle = "";
            let badgeStyle = "";
            let textStyle = "";
            let showCheck = false;
            let showCross = false;
            
            if (isAnswered) {
              if (originalIndex === payload.correct_answer) {
                // Correct Option
                buttonStyle = "bg-[#effff2] border-[#4cd171] shadow-md border-2";
                badgeStyle = "bg-[#4cd171] text-white";
                textStyle = "text-[#006b5a]";
                showCheck = true;
              } else if (originalIndex === selectedAnswer) {
                // Incorrect Option chosen by user
                buttonStyle = "bg-[#fff5f5] border-[#ff6b6b] shadow-md border-2";
                badgeStyle = "bg-[#ff6b6b] text-white";
                textStyle = "text-[#ba1a1a]";
                showCross = true;
              } else {
                // Unselected and incorrect options
                buttonStyle = "bg-white border-slate-100 opacity-40 cursor-not-allowed border-2";
                badgeStyle = "bg-slate-50 text-slate-400 border border-slate-200";
                textStyle = "text-slate-400";
              }
            } else {
              // Normal / Unselected state (pure white cards with thin border)
              buttonStyle = "bg-white border-slate-200 hover:border-primary-100 hover:bg-slate-50 transition-all cursor-pointer border-2";
              badgeStyle = "bg-slate-50 text-primary border border-slate-200 group-hover:bg-primary group-hover:text-white transition-colors shadow-sm";
              textStyle = "text-on-surface";
            }

            return (
              <button
                key={displayIndex}
                disabled={isAnswered}
                onClick={() => handleAnswer(originalIndex)}
                className={`group flex items-center p-4 rounded-md text-left bouncy transition-all ${buttonStyle}`}
              >
                <span className={`w-12 h-12 rounded-full flex items-center justify-center font-headline-sm mr-4 transition-colors font-bold flex-shrink-0 ${badgeStyle}`}>
                  {letter}
                </span>
                <span className={`font-headline-sm text-lg font-bold ${textStyle}`}>
                  {option}
                </span>
                {showCheck && (
                  <span className="material-symbols-outlined ml-auto text-[#4cd171]" style={{ fontVariationSettings: '"FILL" 1' }}>
                    check_circle
                  </span>
                )}
                {showCross && (
                  <span className="material-symbols-outlined ml-auto text-[#ff6b6b]" style={{ fontVariationSettings: '"FILL" 1' }}>
                    cancel
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Explanation / Feedback (customized with no rounded border) */}
        {isAnswered && selectedAnswer !== -1 && showHints && payload.explanation && (
          <div className="rounded-none p-6 flex gap-4 animate-fade-in mt-4" style={{ backgroundColor: 'rgb(242, 245, 255)' }}>
            <div className="bg-white rounded-full p-2.5 flex items-center justify-center self-start shadow-sm">
              <span className="material-symbols-outlined text-[32px]" style={{ color: 'rgb(77, 119, 255)', fontVariationSettings: '"FILL" 1' }}>
                celebration
              </span>
            </div>
            <div>
              <h4 className="font-headline-sm text-headline-sm mb-1 text-[18px]" style={{ color: 'rgb(46, 91, 255)' }}>Explanation:</h4>
              <p className="font-body-md text-body-md leading-relaxed" style={{ color: 'rgb(77, 119, 255)' }}>
                {payload.explanation}
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer Navigation */}
      <footer className="bg-white mt-auto border-t border-slate-100 fixed bottom-0 left-0 w-full z-40">
        {/* Persistent Bottom Progress Bar */}
        <div className="w-full h-2 bg-slate-100 relative">
          <div 
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-indigo-500 transition-all duration-500 ease-out" 
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-white shadow-md progress-glow"></div>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-4 flex flex-row justify-between items-center w-full">
          {/* Left Group: Quit Quiz & Skip */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/student/practice')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full font-bold select-none transition-all text-sm bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">close</span>
              Quit Quiz
            </button>

            {/* Skip Button */}
            <button 
              disabled={isAnswered}
              onClick={handleSkip}
              className={`flex items-center justify-center w-10 h-10 rounded-full select-none transition-all ${
                !isAnswered
                  ? 'bg-white text-amber-500 hover:bg-amber-50 hover:text-amber-600 cursor-pointer border border-amber-200 shadow-sm'
                  : 'bg-slate-50 text-slate-300 border border-slate-200 cursor-not-allowed opacity-50'
              }`}
              title="Skip Question"
            >
              <span className="material-symbols-outlined text-xl">fast_forward</span>
            </button>
          </div>

          {/* Center: Progress Dot Indicator */}
          <div className="hidden md:flex gap-2.5 items-center select-none">
            {content.map((_, idx) => {
              if (idx < currentIndex) return null;

              let dotClass = "";
              if (idx === currentIndex) {
                dotClass = "bg-primary w-4 h-2"; // Active
              } else {
                dotClass = "bg-slate-300 w-2"; // Unanswered
              }

              return (
                <div 
                  key={idx} 
                  className={`h-2 rounded-full transition-all duration-300 ${dotClass}`} 
                />
              );
            })}
          </div>

          {/* Right Group: Previous & Next */}
          <div className="flex items-center gap-3">
            {/* Previous Button */}
            <button 
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex(prev => prev - 1)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold select-none transition-all text-sm ${
                currentIndex > 0
                  ? 'bg-primary-50 text-primary hover:bg-primary-100 border border-primary-200/60 cursor-pointer shadow-sm shadow-primary-500/5'
                  : 'bg-slate-50 text-slate-300 border border-slate-200 cursor-not-allowed opacity-50'
              }`}
            >
              <span className="material-symbols-outlined text-base">navigate_before</span>
              Previous
            </button>

            {/* Next Button */}
            <button 
              disabled={!isAnswered}
              onClick={handleNext}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold select-none transition-all text-sm ${
                isAnswered 
                  ? 'bg-primary text-white bouncy shadow-lg hover:shadow-primary/20 cursor-pointer' 
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
            >
              {currentIndex + 1 >= total ? 'See Results' : 'Next'}
              <span className="material-symbols-outlined text-base">navigate_next</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
