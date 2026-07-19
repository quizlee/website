import { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import type { Content, FlashcardPayload, PlayMode } from '../../lib/types';
import { RotateCcw, ChevronRight, ChevronLeft, Check } from 'lucide-react';

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);

  const total = content.length;
  const currentCard = content[currentIndex];
  const payload = currentCard?.payload as FlashcardPayload;
  const progress = ((currentIndex + 1) / total) * 100;

  function handleKnow() {
    setKnown((prev) => prev + 1);
    handleNext();
  }

  function handleNext() {
    if (currentIndex + 1 >= total) {
      onComplete(known + (flipped ? 1 : 0), total, []);
    } else {
      setCurrentIndex((prev) => prev + 1);
      setFlipped(false);
    }
  }

  function handlePrevious() {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setFlipped(false);
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Progress */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-surface-500">
          {currentIndex + 1} / {total}
        </span>
        <span className="text-sm font-semibold text-success-600">
          {known} known ✓
        </span>
      </div>

      <div className="h-2 bg-surface-100 rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-secondary-400 to-secondary-600 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Flashcard */}
      <div
        onClick={() => setFlipped(!flipped)}
        className="cursor-pointer perspective-[1000px] mb-8"
      >
        <div
          className={`
            relative w-full min-h-[250px] transition-transform duration-500 transform-3d
            ${flipped ? '[transform:rotateY(180deg)]' : ''}
          `}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front */}
          <Card
            className="absolute inset-0 flex items-center justify-center text-center backface-hidden"
            padding="lg"
          >
            <div>
              <p className="text-xs text-surface-400 font-semibold uppercase tracking-wide mb-3">
                Question
              </p>
              <p className="text-xl font-bold text-surface-900">{payload.front}</p>
              <p className="text-sm text-surface-400 mt-4 flex items-center justify-center gap-1">
                <RotateCcw size={14} /> Tap to flip
              </p>
            </div>
          </Card>

          {/* Back */}
          <Card
            className="absolute inset-0 flex items-center justify-center text-center backface-hidden bg-accent-50"
            padding="lg"
          >
            <div style={{ transform: 'rotateY(180deg)' }}>
              <p className="text-xs text-accent-600 font-semibold uppercase tracking-wide mb-3">
                Answer
              </p>
              <p className="text-xl font-bold text-accent-900">{payload.back}</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="md"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          icon={<ChevronLeft size={18} />}
        >
          Back
        </Button>

        <Button
          variant="outline"
          size="md"
          className="flex-1"
          onClick={handleKnow}
          icon={<Check size={18} />}
        >
          I Know This
        </Button>

        <Button
          size="md"
          onClick={handleNext}
          icon={<ChevronRight size={18} />}
        >
          {currentIndex + 1 >= total ? 'Finish' : 'Next'}
        </Button>
      </div>
    </div>
  );
}
