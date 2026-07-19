import { useState, useEffect } from 'react';
import type { Content, MatchingPayload, PlayMode } from '../../lib/types';
import { Check } from 'lucide-react';

interface MatchingActivityProps {
  content: Content[];
  mode: PlayMode;
  onComplete: (score: number, total: number, correctQuestionIds: string[]) => void;
  timeLimit?: number;
  showHints: boolean;
}

export function MatchingActivity({
  content,
  mode: _mode,
  onComplete,
  timeLimit,
}: MatchingActivityProps) {
  // Combine all pairs from all content items
  const allPairs = content.flatMap((c) => (c.payload as MatchingPayload).pairs || []);
  const total = allPairs.length;

  const [leftItems, setLeftItems] = useState<string[]>([]);
  const [rightItems, setRightItems] = useState<string[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [selectedRight, setSelectedRight] = useState<number | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
  const [wrongPair, setWrongPair] = useState<{ left: number; right: number } | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit || 0);

  // Shuffle items on mount
  useEffect(() => {
    setLeftItems(allPairs.map((p) => p.left).sort(() => Math.random() - 0.5));
    setRightItems(allPairs.map((p) => p.right).sort(() => Math.random() - 0.5));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Timer
  useEffect(() => {
    if (!timeLimit) return;
    if (timeLeft <= 0) {
      onComplete(score, total, []);
      return;
    }
    const timer = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, timeLimit, score, total, onComplete]);

  // Check match when both are selected
  useEffect(() => {
    if (selectedLeft === null || selectedRight === null) return;

    const leftVal = leftItems[selectedLeft];
    const rightVal = rightItems[selectedRight];
    const isMatch = allPairs.some((p) => p.left === leftVal && p.right === rightVal);

    if (isMatch) {
      setMatchedPairs((prev) => new Set([...prev, leftVal]));
      setScore((prev) => prev + 1);
      setSelectedLeft(null);
      setSelectedRight(null);

      // Check if all matched
      if (matchedPairs.size + 1 >= total) {
        setTimeout(() => onComplete(score + 1, total, []), 500);
      }
    } else {
      setWrongPair({ left: selectedLeft, right: selectedRight });
      setTimeout(() => {
        setSelectedLeft(null);
        setSelectedRight(null);
        setWrongPair(null);
      }, 800);
    }
  }, [selectedLeft, selectedRight]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-surface-500">
          {matchedPairs.size} / {total} matched
        </span>
        {timeLimit && (
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${
            timeLeft <= 10 ? 'bg-danger-100 text-danger-700' : 'bg-surface-100 text-surface-700'
          }`}>
            {timeLeft}s
          </span>
        )}
      </div>

      {/* Progress */}
      <div className="h-2 bg-surface-100 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent-400 to-accent-600 rounded-full transition-all duration-500"
          style={{ width: `${(matchedPairs.size / total) * 100}%` }}
        />
      </div>

      {/* Matching Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left Column */}
        <div className="flex flex-col gap-2">
          {leftItems.map((item, index) => {
            const isMatched = matchedPairs.has(item);
            const isSelected = selectedLeft === index;
            const isWrong = wrongPair?.left === index;

            return (
              <button
                key={`l-${index}`}
                onClick={() => !isMatched && setSelectedLeft(index)}
                disabled={isMatched}
                className={`
                  p-4 rounded-xl border-2 text-sm font-semibold text-left
                  transition-all duration-200 cursor-pointer
                  ${isMatched
                    ? 'border-success-300 bg-success-50 text-success-700 opacity-60'
                    : isWrong
                      ? 'border-danger-500 bg-danger-50 animate-shake'
                      : isSelected
                        ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-md scale-105'
                        : 'border-surface-200 text-surface-700 hover:border-primary-200'
                  }
                  disabled:cursor-default
                `}
              >
                {isMatched && <Check size={14} className="inline mr-1" />}
                {item}
              </button>
            );
          })}
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-2">
          {rightItems.map((item, index) => {
            const isMatched = allPairs.some(
              (p) => p.right === item && matchedPairs.has(p.left)
            );
            const isSelected = selectedRight === index;
            const isWrong = wrongPair?.right === index;

            return (
              <button
                key={`r-${index}`}
                onClick={() => !isMatched && setSelectedRight(index)}
                disabled={isMatched}
                className={`
                  p-4 rounded-xl border-2 text-sm font-semibold text-left
                  transition-all duration-200 cursor-pointer
                  ${isMatched
                    ? 'border-success-300 bg-success-50 text-success-700 opacity-60'
                    : isWrong
                      ? 'border-danger-500 bg-danger-50 animate-shake'
                      : isSelected
                        ? 'border-accent-500 bg-accent-50 text-accent-700 shadow-md scale-105'
                        : 'border-surface-200 text-surface-700 hover:border-accent-200'
                  }
                  disabled:cursor-default
                `}
              >
                {isMatched && <Check size={14} className="inline mr-1" />}
                {item}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
