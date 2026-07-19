import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import type { Content, PicturePayload, PlayMode } from '../../lib/types';
import { Timer, ChevronRight } from 'lucide-react';

interface PictureGameActivityProps {
  content: Content[];
  mode: PlayMode;
  onComplete: (score: number, total: number, correctQuestionIds: string[]) => void;
  timeLimit?: number;
  showHints: boolean;
}

export function PictureGameActivity({
  content,
  mode: _mode,
  onComplete,
  timeLimit,
}: PictureGameActivityProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timeLimit || 0);
  const [correctQuestionIds, setCorrectQuestionIds] = useState<string[]>([]);

  const total = content.length;
  const currentItem = content[currentIndex];
  const payload = currentItem?.payload as PicturePayload;
  const progress = ((currentIndex + 1) / total) * 100;

  // Timer
  useEffect(() => {
    if (!timeLimit) return;
    if (timeLeft <= 0) {
      onComplete(score, total, correctQuestionIds);
      return;
    }
    const timer = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, timeLimit, score, total, onComplete, correctQuestionIds]);

  function handleAnswer(optionIndex: number) {
    if (showResult) return;
    setSelectedAnswer(optionIndex);
    setShowResult(true);
    if (optionIndex === payload.correct_answer) {
      setScore((prev) => prev + 1);
      setCorrectQuestionIds((prev) => [...prev, currentItem.id]);
    }
  }

  function handleNext() {
    if (currentIndex + 1 >= total) {
      // If the current question was correct, it's already in correctQuestionIds state
      onComplete(score, total, correctQuestionIds);
    } else {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-surface-500">
          {currentIndex + 1} / {total}
        </span>
        {timeLimit && (
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
            timeLeft <= 10 ? 'bg-danger-100 text-danger-700' : 'bg-surface-100 text-surface-700'
          }`}>
            <Timer size={14} />
            {timeLeft}s
          </div>
        )}
      </div>

      <div className="h-2 bg-surface-100 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-warning-400 to-warning-600 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Image */}
      <Card className="mb-6 text-center" padding="sm">
        <img
          src={payload.image_url}
          alt="Question"
          className="w-full max-h-64 object-contain rounded-xl mx-auto mb-4"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f1f3f5" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23adb5bd" font-size="14">Image</text></svg>';
          }}
        />
        <h3 className="text-lg font-bold text-surface-900">{payload.question}</h3>
      </Card>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {payload.options.map((option, index) => {
          let optionClass = 'border-surface-200 bg-white hover:border-warning-300';

          if (showResult) {
            if (index === payload.correct_answer) {
              optionClass = 'border-success-500 bg-success-50 animate-bounce-in';
            } else if (index === selectedAnswer) {
              optionClass = 'border-danger-500 bg-danger-50 animate-shake';
            } else {
              optionClass = 'border-surface-200 bg-surface-50 opacity-50';
            }
          }

          return (
            <button
              key={index}
              onClick={() => handleAnswer(index)}
              disabled={showResult}
              className={`
                p-4 rounded-xl border-2 font-semibold text-sm
                transition-all duration-200 cursor-pointer disabled:cursor-default
                ${optionClass}
              `}
            >
              {option}
            </button>
          );
        })}
      </div>

      {/* Next */}
      {showResult && (
        <Button
          size="lg"
          className="w-full animate-slide-up"
          icon={<ChevronRight size={20} />}
          onClick={handleNext}
        >
          {currentIndex + 1 >= total ? 'See Results' : 'Next'}
        </Button>
      )}
    </div>
  );
}
