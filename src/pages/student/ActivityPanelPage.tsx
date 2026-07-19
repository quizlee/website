import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import {
  Brain,
  Layers,
  ArrowLeftRight,
  ImageIcon,
  Play,
  Infinity,
  Trophy,
} from 'lucide-react';
import type { ActivityType, PlayMode } from '../../lib/types';

const activityTypes: {
  type: ActivityType;
  label: string;
  icon: typeof Brain;
  color: string;
  bgColor: string;
  description: string;
}[] = [
  {
    type: 'quiz',
    label: 'Quiz',
    icon: Brain,
    color: 'text-primary-600',
    bgColor: 'bg-primary-100',
    description: 'Answer multiple-choice questions',
  },
  {
    type: 'flashcard',
    label: 'Flashcards',
    icon: Layers,
    color: 'text-secondary-600',
    bgColor: 'bg-secondary-100',
    description: 'Flip cards to learn concepts',
  },
  {
    type: 'matching',
    label: 'Matching',
    icon: ArrowLeftRight,
    color: 'text-accent-600',
    bgColor: 'bg-accent-100',
    description: 'Match pairs of related items',
  },
  {
    type: 'picture',
    label: 'Picture Game',
    icon: ImageIcon,
    color: 'text-warning-600',
    bgColor: 'bg-warning-100',
    description: 'Identify images and answer',
  },
];

export default function ActivityPanelPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chapterIds = searchParams.getAll('chapters');
  const initialType = searchParams.get('type') as ActivityType | null;

  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(initialType);
  const [selectedMode, setSelectedMode] = useState<PlayMode>('practice');
  const [questionCount, setQuestionCount] = useState('10');

  function handleStart() {
    if (!selectedActivity) return;

    const params = new URLSearchParams();
    chapterIds.forEach((id) => params.append('chapters', id));
    params.set('type', selectedActivity);
    params.set('mode', selectedMode);
    if (selectedMode === 'practice') {
      params.set('count', questionCount);
    }

    navigate(`/student/play?${params.toString()}`);
  }

  if (chapterIds.length === 0) {
    navigate('/student');
    return null;
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-extrabold text-surface-900 mb-2">Choose Activity 🎮</h1>
      <p className="text-surface-500 mb-8">Pick how you want to learn</p>

      {/* Activity Type Selection */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {activityTypes.map((activity) => {
          const isSelected = selectedActivity === activity.type;
          return (
            <button
              key={activity.type}
              onClick={() => setSelectedActivity(activity.type)}
              className={`
                p-5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer
                ${isSelected
                  ? `border-primary-500 bg-white shadow-lg scale-[1.02]`
                  : 'border-surface-200 bg-white hover:border-surface-300 hover:shadow-md'
                }
              `}
            >
              <div className={`w-12 h-12 ${activity.bgColor} rounded-xl flex items-center justify-center mb-3`}>
                <activity.icon size={24} className={activity.color} />
              </div>
              <h3 className="font-bold text-surface-900 mb-1">{activity.label}</h3>
              <p className="text-xs text-surface-500">{activity.description}</p>
            </button>
          );
        })}
      </div>

      {/* Mode Selection */}
      {selectedActivity && (
        <div className="mb-8 animate-fade-in">
          <h2 className="text-sm font-bold text-surface-600 uppercase tracking-wide mb-3">Select Mode</h2>
          <div className="grid grid-cols-2 gap-4">
            {/* Practice Mode */}
            <button
              onClick={() => setSelectedMode('practice')}
              className={`
                p-5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer
                ${selectedMode === 'practice'
                  ? 'border-accent-500 bg-accent-50 shadow-md'
                  : 'border-surface-200 bg-white hover:border-surface-300'
                }
              `}
            >
              <div className="flex items-center gap-2 mb-3">
                <Infinity size={20} className="text-accent-600" />
                <span className="font-bold text-surface-900">Practice</span>
              </div>
              <ul className="text-xs text-surface-500 space-y-1">
                <li>• Choose question count</li>
                <li>• No time limit</li>
                <li>• Hints available</li>
                <li>• Unlimited retries</li>
              </ul>
            </button>

            {/* Competitive Mode */}
            <button
              onClick={() => setSelectedMode('competitive')}
              className={`
                p-5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer
                ${selectedMode === 'competitive'
                  ? 'border-danger-500 bg-danger-50 shadow-md'
                  : 'border-surface-200 bg-white hover:border-surface-300'
                }
              `}
            >
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={20} className="text-danger-600" />
                <span className="font-bold text-surface-900">Competitive</span>
              </div>
              <ul className="text-xs text-surface-500 space-y-1">
                <li>• Fixed 10 questions</li>
                <li>• 60 second time limit</li>
                <li>• No hints</li>
                <li>• Leaderboard eligible</li>
              </ul>
            </button>
          </div>
        </div>
      )}

      {/* Practice Config */}
      {selectedActivity && selectedMode === 'practice' && (
        <div className="mb-8 animate-fade-in">
          <Select
            label="Number of Questions"
            value={questionCount}
            onChange={(e) => setQuestionCount(e.target.value)}
            options={[
              { value: '5', label: '5 Questions' },
              { value: '10', label: '10 Questions' },
              { value: '15', label: '15 Questions' },
              { value: '20', label: '20 Questions' },
              { value: '30', label: '30 Questions' },
            ]}
          />
        </div>
      )}

      {/* Start Button */}
      {selectedActivity && (
        <div className="sticky bottom-20 lg:bottom-4 animate-slide-up">
          <Button
            size="lg"
            className="w-full shadow-xl"
            icon={<Play size={20} />}
            onClick={handleStart}
          >
            Start {selectedMode === 'competitive' ? 'Competition' : 'Practice'} 🔥
          </Button>
        </div>
      )}
    </div>
  );
}
