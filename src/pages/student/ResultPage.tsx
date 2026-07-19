import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import confetti from 'canvas-confetti';
import { Home, RotateCcw, Trophy, Clock, Target, Star } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';

export default function ResultPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile, setProfile } = useAuthStore();

  const score = parseInt(searchParams.get('score') || '0');
  const total = parseInt(searchParams.get('total') || '0');
  const time = parseInt(searchParams.get('time') || '0');
  const points = parseInt(searchParams.get('points') || '0');
  const actualPoints = parseInt(searchParams.get('actual_points') || searchParams.get('points') || '0');
  const mode = searchParams.get('mode');
  const chapterIds = searchParams.getAll('chapters');
  const activityType = searchParams.get('type');
  const count = searchParams.get('count') || '10';

  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  const handlePlayAgain = () => {
    if (chapterIds.length === 0 || !activityType) {
      navigate('/student');
      return;
    }

    const playParams = new URLSearchParams();
    chapterIds.forEach(id => playParams.append('chapters', id));
    playParams.set('type', activityType);
    if (mode) playParams.set('mode', mode);
    playParams.set('count', count);
    
    navigate(`/student/play?${playParams.toString()}`, { replace: true });
  };

  // Sync points with store and database on mount
  useEffect(() => {
    if (profile && actualPoints > 0) {
      // Immediately increment local state so layout top bar count-up starts right away
      setProfile({
        ...profile,
        points: profile.points + actualPoints,
      });

      // Synchronize with database to ensure store is 100% accurate
      supabase
        .from('profiles')
        .select('*')
        .eq('id', profile.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setProfile(data);
          }
        });
    }
  }, []);

  // Celebration effects
  useEffect(() => {
    if (percentage >= 70) {
      // Big confetti for good scores
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#5c7cfa', '#f06595', '#20c997', '#fcc419', '#ff6b6b'],
      });

      if (percentage === 100) {
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
          });
          confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
          });
        }, 500);
      }
    }
  }, [percentage]);

  const getEmoji = () => {
    if (percentage === 100) return '🏆';
    if (percentage >= 80) return '🌟';
    if (percentage >= 60) return '👍';
    if (percentage >= 40) return '💪';
    return '⚠️';
  };

  const getMessage = () => {
    if (percentage === 100) return 'Perfect Score!';
    if (percentage >= 80) return 'Excellent Work!';
    if (percentage >= 60) return 'Good Job!';
    if (percentage >= 40) return 'Keep Practicing!';
    return "Don't Give Up!";
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md animate-bounce-in">
        {/* Result Card */}
        <Card className="text-center mb-6">
          <div className="text-6xl mb-4">{getEmoji()}</div>
          <h1 className="text-2xl font-extrabold text-surface-900 mb-2">{getMessage()}</h1>

          {/* Score Circle */}
          <div className="relative w-32 h-32 mx-auto my-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#e9ecef"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={percentage >= 70 ? '#40c057' : percentage >= 40 ? '#fcc419' : '#ff6b6b'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${percentage * 2.64} ${264 - percentage * 2.64}`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-extrabold text-surface-900">{percentage}%</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100/85 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary flex-shrink-0">
                <Target size={20} />
              </div>
              <div className="text-left min-w-0">
                <p className="text-xs text-surface-500 font-semibold truncate">Correct</p>
                <p className="text-base font-extrabold text-surface-900">{score}/{total}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100/85 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#effaf5] flex items-center justify-center text-[#20c997] flex-shrink-0">
                <Clock size={20} />
              </div>
              <div className="text-left min-w-0">
                <p className="text-xs text-surface-500 font-semibold truncate">Time</p>
                <p className="text-base font-extrabold text-surface-900">{formatTime(time)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100/85 shadow-sm relative overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-[#fff9db] flex items-center justify-center text-[#fcc419] flex-shrink-0">
                <Star size={20} className="fill-[#fcc419]" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-xs text-surface-500 font-semibold truncate">Points</p>
                <p className="text-base font-extrabold text-surface-900">+{points}</p>
                {actualPoints < points && (
                  <p className="text-[9px] text-red-650 font-black leading-none mt-1 animate-pulse uppercase tracking-wider shrink-0 select-none whitespace-nowrap">
                    Daily Limit Reached!
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100/85 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#f3f0ff] flex items-center justify-center text-[#845ef7] flex-shrink-0">
                <Trophy size={20} />
              </div>
              <div className="text-left min-w-0">
                <p className="text-xs text-surface-500 font-semibold truncate">Mode</p>
                <p className="text-base font-extrabold text-surface-900 capitalize truncate">{mode}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={handlePlayAgain}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-bold select-none transition-all text-sm bg-primary text-white bouncy shadow-lg hover:shadow-primary/20 cursor-pointer"
          >
            <RotateCcw size={18} />
            Play Again
          </button>
          <button
            onClick={() => navigate('/student/practice')}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-bold select-none transition-all text-sm bg-primary text-white bouncy shadow-lg hover:shadow-primary/20 cursor-pointer"
          >
            <Home size={18} />
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
