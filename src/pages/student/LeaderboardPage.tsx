import { Trophy, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../stores/authStore';

export default function LeaderboardPage() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in max-w-2xl mx-auto py-8">
      <Card className="p-8 text-center border-2 border-primary-100 bg-white shadow-lg rounded-3xl flex flex-col items-center gap-6">
        <div className="p-4 bg-primary-50 rounded-2xl border border-primary-100 text-primary-600 animate-bounce">
          <Trophy size={40} />
        </div>
        
        <div>
          <h1 className="text-3xl font-black text-surface-900 tracking-tight font-headline-md">
            Leaderboard Standings
          </h1>
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-widest mt-1">
            {profile?.school_id ? 'School Rankings' : 'Global Rankings'}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 text-amber-900 font-extrabold text-sm max-w-md leading-relaxed shadow-3xs">
          To see your name and rank on the leaderboard, you must participate in competitive mode matches.
        </div>

        <button
          onClick={() => navigate('/student/compete')}
          className="mt-2 inline-flex items-center gap-2 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary-600 hover:to-indigo-700 text-white font-extrabold px-6 py-3 rounded-2xl shadow-md shadow-primary/20 hover:shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer text-sm"
        >
          Go to Compete
          <ArrowRight size={16} />
        </button>
      </Card>
    </div>
  );
}
