import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import type { Content, DragndropPayload, PlayMode } from '../../lib/types';
import { Check, X, RefreshCw, Trophy, LogOut } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useNavigate } from 'react-router-dom';

interface Chip {
  id: string;
  text: string;
}

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
  // Selections state: { [questionIndex]: { [blankIndex]: Chip } }
  const [selections, setSelections] = useState<Record<number, Record<number, Chip>>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedDockChip, setSelectedDockChip] = useState<Chip | null>(null);
  
  // Custom Drag & Drop states
  const [draggedChip, setDraggedChip] = useState<Chip | null>(null);
  const [dragCoords, setDragCoords] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragSource, setDragSource] = useState<{
    type: 'dock' | 'blank';
    qIdx?: number;
    bIdx?: number;
  } | null>(null);

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
  const [allChips, setAllChips] = useState<Chip[]>([]);

  // Shuffle and set chips on mount
  useEffect(() => {
    resetActivity();
  }, [content]);

  const resetActivity = () => {
    const list: Chip[] = [];
    let idCounter = 0;
    questions.forEach((q) => {
      q.correctAnswers.forEach((ans) => {
        if (ans) {
          list.push({ id: `chip-${idCounter++}`, text: ans });
        }
      });
    });
    // Shuffle
    const shuffled = [...list].sort(() => Math.random() - 0.5);
    setAllChips(shuffled);
    setSelections({});
    setIsSubmitted(false);
    setSelectedDockChip(null);
    setDraggedChip(null);
    setDragCoords(null);
    setDragSource(null);
  };

  // Get list of chip IDs currently placed in any blank
  const getPlacedChipIds = () => {
    const placedIds = new Set<string>();
    Object.values(selections).forEach((qSelections) => {
      Object.values(qSelections).forEach((chip) => {
        if (chip) placedIds.add(chip.id);
      });
    });
    return placedIds;
  };

  const placedChipIds = getPlacedChipIds();
  // Unplaced chips are shown in the bottom dock
  const availableChips = allChips.filter((chip) => !placedChipIds.has(chip.id));

  // Count how many blanks have been answered
  const getAnsweredCount = () => {
    let count = 0;
    Object.values(selections).forEach((qSelections) => {
      Object.values(qSelections).forEach((chip) => {
        if (chip) count++;
      });
    });
    return count;
  };

  // Check if a specific blank is correct
  const isBlankCorrect = (qIdx: number, bIdx: number) => {
    const placed = selections[qIdx]?.[bIdx];
    const correct = questions[qIdx]?.correctAnswers[bIdx];
    return placed?.text === correct;
  };

  const handlePlaceChip = (qIdx: number, bIdx: number, chip: Chip) => {
    if (isSubmitted) return;

    setSelections((prev) => {
      const qPrev = prev[qIdx] || {};

      return {
        ...prev,
        [qIdx]: {
          ...qPrev,
          [bIdx]: chip,
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
  // HTML5 Drag and Drop events
  const handleDragStart = (
    e: React.DragEvent,
    chip: Chip,
    source: { type: 'dock' | 'blank'; qIdx?: number; bIdx?: number }
  ) => {
    if (isSubmitted) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', chip.id);
    e.dataTransfer.setData('source-type', source.type);
    if (source.qIdx !== undefined) e.dataTransfer.setData('source-qidx', String(source.qIdx));
    if (source.bIdx !== undefined) e.dataTransfer.setData('source-bidx', String(source.bIdx));

    // Calculate click offsets to keep relative position
    const rect = e.currentTarget.getBoundingClientRect();
    const xOffset = e.clientX - rect.left;
    const yOffset = e.clientY - rect.top;
    setDragOffset({ x: xOffset, y: yOffset });
    setDragCoords({ x: e.clientX, y: e.clientY });

    // Set a transparent 1x1 GIF as the drag image to hide browser default ghost
    const dragImg = new Image();
    dragImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(dragImg, 0, 0);

    setDraggedChip(chip);
    setDragSource(source);
  };

  const handleDrag = (e: React.DragEvent) => {
    if (e.clientX !== 0 && e.clientY !== 0) {
      setDragCoords({ x: e.clientX, y: e.clientY });
    }
  };

  const handleDragEnd = () => {
    setDraggedChip(null);
    setDragCoords(null);
    setDragSource(null);
  };

  const handleDrop = (e: React.DragEvent, qIdx: number, bIdx: number) => {
    e.preventDefault();
    const chipId = e.dataTransfer.getData('text/plain');
    const sourceType = e.dataTransfer.getData('source-type');
    
    if (chipId) {
      const chip = allChips.find((c) => c.id === chipId);
      if (chip) {
        if (sourceType === 'blank') {
          const srcQIdx = Number(e.dataTransfer.getData('source-qidx'));
          const srcBIdx = Number(e.dataTransfer.getData('source-bidx'));
          if (srcQIdx !== qIdx || srcBIdx !== bIdx) {
            handleRemoveChip(srcQIdx, srcBIdx);
          }
        }
        handlePlaceChip(qIdx, bIdx, chip);
      }
    }
    handleDragEnd();
  };

  const handleDropOnAnswerBank = (e: React.DragEvent) => {
    e.preventDefault();
    const sourceType = e.dataTransfer.getData('source-type');
    if (sourceType === 'blank') {
      const qIdx = Number(e.dataTransfer.getData('source-qidx'));
      const bIdx = Number(e.dataTransfer.getData('source-bidx'));
      handleRemoveChip(qIdx, bIdx);
    }
    handleDragEnd();
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
                  const placedChip = selections[qIdx]?.[blankIndex];
                  const hasValue = !!placedChip;
                  
                  const correctText = q.correctAnswers[blankIndex];
                  const isCorrect = placedChip?.text === correctText;

                  // Border and background state styling for blanks
                  let blankStyle = "border-dashed border-2 border-slate-300 bg-slate-50/50 hover:border-primary-400 hover:bg-primary-50/20 shadow-inner";
                  let textColor = "text-primary-700";
                  
                  const isThisBlankDragged = draggedChip && dragSource?.type === 'blank' && dragSource.qIdx === qIdx && dragSource.bIdx === blankIndex;

                  if (isThisBlankDragged) {
                    blankStyle = "border-dashed border-2 border-slate-300 bg-slate-50/50 shadow-inner";
                    textColor = "text-transparent";
                  } else if (isSubmitted) {
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
                          draggable={hasValue && !isSubmitted}
                          onDragStart={(e) => {
                            if (hasValue && !isSubmitted) {
                              handleDragStart(e, placedChip, { type: 'blank', qIdx, bIdx: blankIndex });
                            }
                          }}
                          onDrag={handleDrag}
                          onDragEnd={handleDragEnd}
                          className={`
                            mx-1.5 my-1 min-w-[120px] h-[34px] px-3 rounded-xl inline-flex items-center justify-center text-sm font-extrabold select-none transition-all relative
                            ${hasValue && !isSubmitted ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                            ${blankStyle}
                          `}
                          title={hasValue ? "Click or drag to return word to dock" : "Drop answer here"}
                        >
                          {hasValue ? (
                            <span className={`flex items-center gap-1.5 ${textColor}`}>
                              {placedChip.text}
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
            Show Result ➜
          </Button>
        )}
      </div>

      {/* Floating Bottom Sticky Answer Dock */}
      <div 
        onDrop={handleDropOnAnswerBank}
        onDragOver={handleDragOver}
        className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 shadow-2xl py-2.5 px-6"
      >
        <div className="max-w-4xl mx-auto flex flex-col gap-2">
          {/* Row 1: Answer Bank, Answered, and Reset side-by-side */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5 text-slate-400 font-extrabold text-xs uppercase tracking-wider">
              <span className="text-yellow-400">⚡</span> Answer Bank
            </div>
            
            <div className="flex items-center gap-4 shrink-0">
              <span className="text-xs font-black text-slate-300 uppercase bg-slate-800/50 px-2.5 py-1 rounded-lg border border-slate-800">
                Answered: {getAnsweredCount()} / {totalBlanks}
              </span>
              <button
                onClick={resetActivity}
                className="flex items-center gap-1 text-xs text-slate-300 hover:text-primary-400 font-bold cursor-pointer transition-colors"
              >
                <RefreshCw size={14} />
                Reset
              </button>
            </div>
          </div>

          {/* Row 2: Draggable answer chips below */}
          <div className="flex-grow flex flex-wrap gap-2 justify-center md:justify-start overflow-y-auto max-h-[90px] pl-2 w-full">
            {availableChips.length === 0 ? (
              <p className="text-xs text-slate-500 font-medium italic">All words placed. Click on words above to return them here.</p>
            ) : (
              availableChips.map((chip, idx) => {
                const isSelected = selectedDockChip?.id === chip.id;
                const isDragged = draggedChip?.id === chip.id;
                return (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => handleDragStart(e, chip, { type: 'dock' })}
                    onDrag={handleDrag}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedDockChip(isSelected ? null : chip)}
                    className={`
                      px-4 py-1.5 rounded-xl text-sm font-extrabold shadow-sm select-none cursor-grab active:cursor-grabbing border transition-all duration-150 shrink-0
                      ${
                        isDragged
                          ? 'bg-slate-950/80 border-slate-800 border-dashed text-transparent shadow-inner scale-95 opacity-55'
                          : isSelected
                          ? 'bg-primary text-white border-primary ring-2 ring-primary/40'
                          : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300 hover:scale-105 active:scale-95'
                      }
                    `}
                    title="Drag this word to a blank, or click to select then click a blank"
                  >
                    {chip.text}
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
        </div>
      )}

      {/* Custom Drag Overlay */}
      {draggedChip && dragCoords && (
        <div
          className="fixed pointer-events-none z-50 px-4 py-1.5 rounded-xl text-sm font-extrabold shadow-lg bg-white text-slate-800 border border-slate-200 shrink-0 opacity-100 scale-105"
          style={{
            left: `${dragCoords.x - dragOffset.x}px`,
            top: `${dragCoords.y - dragOffset.y}px`,
          }}
        >
          {draggedChip.text}
        </div>
      )}
    </div>
  );
}
