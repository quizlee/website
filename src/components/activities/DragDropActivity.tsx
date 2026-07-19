import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import type { Content, DragndropPayload, PlayMode } from '../../lib/types';
import { Check, X, RefreshCw, Trophy, RotateCcw, LogOut } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useNavigate } from 'react-router-dom';

interface DragDropActivityProps {
  content: Content[];
  mode: PlayMode;
  onComplete: (score: number, total: number, correctQuestionIds: string[]) => void;
  timeLimit?: number;
  showHints: boolean;
}

export function DragDropActivity({
  content,
  onComplete,
}: DragDropActivityProps) {
  const navigate = useNavigate();
  // Selections state: { [questionIndex]: { [blankIndex]: "placed_text" } }
  const [selections, setSelections] = useState<Record<number, Record<number, string>>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedDockChip, setSelectedDockChip] = useState<string | null>(null);

  // Parse questions
  const questions = content.map((item) => {
    const payload = item.payload as DragndropPayload;
    // Split sentence by "__BLANK__"
    const segments = payload.sentence.split('__BLANK__');
    return {
      id: item.id,
      segments,
      correctAnswers: payload.answers || [],
      totalBlanks: payload.answers?.length || 0,
    };
  });

  // Calculate total blanks across all questions
  const totalBlanks = questions.reduce((acc, q) => acc + q.totalBlanks, 0);

  // All answer options/chips
  const [allChips, setAllChips] = useState<string[]>([]);

  // Shuffle and set chips on mount
  useEffect(() => {
    resetActivity();
  }, [content]);

  const resetActivity = () => {
    const list: string[] = [];
    questions.forEach((q) => {
      q.correctAnswers.forEach((ans) => {
        if (ans) list.push(ans);
      });
    });
    // Shuffle
    const shuffled = [...list].sort(() => Math.random() - 0.5);
    setAllChips(shuffled);
    setSelections({});
    setIsSubmitted(false);
    setSelectedDockChip(null);
  };

  // Get list of chips currently placed in any blank
  const getPlacedChips = () => {
    const placed = new Set<string>();
    Object.values(selections).forEach((qSelections) => {
      Object.values(qSelections).forEach((text) => {
        if (text) placed.add(text);
      });
    });
    return placed;
  };

  const placedChips = getPlacedChips();
  // Unplaced chips are shown in the bottom dock
  const availableChips = allChips.filter((chip) => !placedChips.has(chip));

  // Count how many blanks have been answered
  const getAnsweredCount = () => {
    let count = 0;
    Object.values(selections).forEach((qSelections) => {
      Object.values(qSelections).forEach((text) => {
        if (text) count++;
      });
    });
    return count;
  };

  // Check if a specific blank is correct
  const isBlankCorrect = (qIdx: number, bIdx: number) => {
    const placed = selections[qIdx]?.[bIdx];
    const correct = questions[qIdx]?.correctAnswers[bIdx];
    return placed === correct;
  };

  const handlePlaceChip = (qIdx: number, bIdx: number, chipText: string) => {
    if (isSubmitted) return;

    setSelections((prev) => {
      const qPrev = prev[qIdx] || {};

      // If there was an old chip in this blank, it naturally goes back to the dock
      // because we filter out any text present in selections from the available dock list
      return {
        ...prev,
        [qIdx]: {
          ...qPrev,
          [bIdx]: chipText,
        },
      };
    });
    setSelectedDockChip(null);
  };

  const handleRemoveChip = (qIdx: number, bIdx: number) => {
    if (isSubmitted) return;

    setSelections((prev) => {
      const qPrev = { ...(prev[qIdx] || {}) };
      delete qPrev[bIdx];
      return {
        ...prev,
        [qIdx]: qPrev,
      };
    });
  };

  // HTML5 Drag and Drop events
  const handleDragStart = (e: React.DragEvent, chipText: string) => {
    if (isSubmitted) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', chipText);
  };

  const handleDrop = (e: React.DragEvent, qIdx: number, bIdx: number) => {
    e.preventDefault();
    const chipText = e.dataTransfer.getData('text/plain');
    if (chipText) {
      handlePlaceChip(qIdx, bIdx, chipText);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Submit and validate answers
  const handleSubmit = () => {
    setIsSubmitted(true);

    // Calculate final score
    let correctCount = 0;
    const correctQuestionIds: string[] = [];

    questions.forEach((q, qIdx) => {
      let allBlanksCorrect = true;
      for (let bIdx = 0; bIdx < q.totalBlanks; bIdx++) {
        if (isBlankCorrect(qIdx, bIdx)) {
          correctCount++;
        } else {
          allBlanksCorrect = false;
        }
      }
      if (allBlanksCorrect && q.totalBlanks > 0) {
        correctQuestionIds.push(q.id);
      }
    });

    // Celebration if they did well!
    const pct = totalBlanks > 0 ? (correctCount / totalBlanks) * 100 : 0;
    if (pct >= 70) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#4ade80', '#60a5fa', '#facc15', '#f472b6'],
      });
    }
  };

  const handleFinish = () => {
    // Calculate final score
    let correctCount = 0;
    const correctQuestionIds: string[] = [];

    questions.forEach((q, qIdx) => {
      let allBlanksCorrect = true;
      for (let bIdx = 0; bIdx < q.totalBlanks; bIdx++) {
        if (isBlankCorrect(qIdx, bIdx)) {
          correctCount++;
        } else {
          allBlanksCorrect = false;
        }
      }
      if (allBlanksCorrect && q.totalBlanks > 0) {
        correctQuestionIds.push(q.id);
      }
    });

    onComplete(correctCount, totalBlanks, correctQuestionIds);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative pb-36">
      {/* Top Banner / Progress Tracker */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary font-bold">
            📥
          </div>
          <div>
            <h2 className="font-extrabold text-slate-800 text-sm">Drag the Answers & Drop in Blanks</h2>
            <p className="text-xs text-slate-400 font-semibold">Place correct words to complete sentences</p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <span className="text-xs font-black text-slate-500 uppercase bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
            Answered: {getAnsweredCount()} / {totalBlanks}
          </span>
          <button
            onClick={resetActivity}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-primary font-bold cursor-pointer transition-colors"
          >
            <RefreshCw size={14} />
            Reset
          </button>
        </div>
      </div>

      {/* Main Question List */}
      <div className="flex flex-col gap-4">
        {questions.map((q, qIdx) => (
          <Card key={qIdx} className="p-6 bg-white hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-primary-200" />
            <div className="flex items-start gap-4">
              <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500 flex-shrink-0">
                {qIdx + 1}
              </span>
              
              <div className="flex-grow leading-relaxed font-bold text-slate-800 text-base md:text-lg">
                {q.segments.map((segment, sIdx) => {
                  const isLast = sIdx === q.segments.length - 1;
                  const blankIndex = sIdx;
                  const placedText = selections[qIdx]?.[blankIndex];
                  const hasValue = !!placedText;
                  
                  const correctText = q.correctAnswers[blankIndex];
                  const isCorrect = placedText === correctText;

                  // Border and background state styling for blanks
                  let blankStyle = "border-dashed border-2 border-slate-300 bg-slate-50/50 hover:border-primary-400 hover:bg-primary-50/20 shadow-inner";
                  let textColor = "text-primary-700";
                  
                  if (isSubmitted) {
                    if (!hasValue) {
                      blankStyle = "border-amber-400 bg-amber-50/40 animate-pulse border-2 shadow-inner";
                    } else if (isCorrect) {
                      blankStyle = "border-[#4cd171] bg-[#effff2] shadow-sm border-2";
                      textColor = "text-[#006b5a]";
                    } else {
                      blankStyle = "border-[#ff6b6b] bg-[#fff5f5] shadow-sm border-2";
                      textColor = "text-[#ba1a1a]";
                    }
                  } else if (hasValue) {
                    // Item selected state
                    blankStyle = "border-solid border-2 border-primary bg-primary-50/40 shadow-sm";
                  }

                  return (
                    <span key={sIdx} className="inline-flex flex-wrap items-center">
                      <span>{segment}</span>
                      {!isLast && (
                        <span
                          onDrop={(e) => handleDrop(e, qIdx, blankIndex)}
                          onDragOver={handleDragOver}
                          onClick={() => {
                            if (selectedDockChip) {
                              handlePlaceChip(qIdx, blankIndex, selectedDockChip);
                            } else if (hasValue) {
                              handleRemoveChip(qIdx, blankIndex);
                            }
                          }}
                          className={`
                            mx-1.5 my-1 min-w-[120px] h-[34px] px-3 rounded-xl inline-flex items-center justify-center text-sm font-extrabold select-none transition-all cursor-pointer relative
                            ${blankStyle}
                          `}
                          title={hasValue ? "Click to return word to dock" : "Drop answer here"}
                        >
                          {hasValue ? (
                            <span className={`flex items-center gap-1.5 ${textColor}`}>
                              {placedText}
                              {isSubmitted && isCorrect && <Check size={14} className="text-[#4cd171] shrink-0" />}
                              {isSubmitted && !isCorrect && <X size={14} className="text-[#ff6b6b] shrink-0" />}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Form Actions */}
      <div className="flex justify-center gap-4 mt-4">
        <Button
          variant="outline"
          size="lg"
          onClick={() => navigate('/student/practice')}
          className="flex items-center gap-1.5 px-8 font-bold border-2 border-slate-200 text-slate-500 hover:bg-slate-50"
        >
          <LogOut size={16} />
          Quit
        </Button>

        {!isSubmitted ? (
          <Button
            size="lg"
            onClick={handleSubmit}
            className="px-10 font-bold bouncy shadow-lg hover:shadow-primary/20"
            disabled={getAnsweredCount() === 0}
          >
            Submit Answers 🚀
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={handleFinish}
            className="px-10 font-bold bouncy shadow-lg hover:shadow-success/20 bg-success text-white hover:bg-success/90"
          >
            Next & Continue ➜
          </Button>
        )}
      </div>

      {/* Floating Bottom Sticky Answer Dock */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 shadow-2xl py-4 px-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-4">
          <div className="shrink-0 flex items-center gap-1.5 text-slate-400 font-extrabold text-xs uppercase tracking-wider">
            <span className="text-yellow-400">⚡</span> Answer Bank
          </div>
          
          <div className="flex-grow flex flex-wrap gap-2.5 justify-center md:justify-start overflow-y-auto max-h-[100px] py-1 pl-2">
            {availableChips.length === 0 ? (
              <p className="text-xs text-slate-500 font-medium italic">All words placed. Click on words above to return them here.</p>
            ) : (
              availableChips.map((chipText, idx) => {
                const isSelected = selectedDockChip === chipText;
                return (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => handleDragStart(e, chipText)}
                    onClick={() => setSelectedDockChip(isSelected ? null : chipText)}
                    className={`
                      px-4 py-1.5 rounded-xl text-sm font-extrabold shadow-sm select-none cursor-grab active:cursor-grabbing border transition-all hover:scale-105 active:scale-95 duration-150 shrink-0
                      ${
                        isSelected
                          ? 'bg-primary text-white border-primary ring-2 ring-primary/40'
                          : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300'
                      }
                    `}
                    title="Drag this word to a blank, or click to select then click a blank"
                  >
                    {chipText}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Feedback Summary Banner Modal */}
      {isSubmitted && (
        <div className="bg-success-50 border border-success-200 rounded-2xl p-5 mt-4 flex items-center justify-between gap-4 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-success-100 flex items-center justify-center text-success text-xl">
              <Trophy />
            </div>
            <div>
              <h3 className="font-extrabold text-success-800 text-sm">Round Complete!</h3>
              <p className="text-xs text-success-600 font-semibold">
                You successfully solved {questions.reduce((acc, q, qIdx) => {
                  let correct = true;
                  for(let i=0; i<q.totalBlanks; i++) {
                    if (!isBlankCorrect(qIdx, i)) correct = false;
                  }
                  return acc + (correct ? 1 : 0);
                }, 0)} out of {questions.length} questions correctly.
              </p>
            </div>
          </div>
          <button
            onClick={resetActivity}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-success-600 hover:bg-success-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer select-none"
          >
            <RotateCcw size={13} />
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
