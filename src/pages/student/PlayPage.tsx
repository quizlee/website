import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Spinner } from '../../components/ui/Spinner';
import { QuizActivity } from '../../components/activities/QuizActivity';
import { FlashcardActivity } from '../../components/activities/FlashcardActivity';
import { MatchingActivity } from '../../components/activities/MatchingActivity';
import { PictureGameActivity } from '../../components/activities/PictureGameActivity';
import { DragDropActivity } from '../../components/activities/DragDropActivity';
import type { Content, ActivityType, PlayMode } from '../../lib/types';
import { toast } from '../../components/ui/Toast';

export default function PlayPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuthStore();

  const chapterIds = searchParams.getAll('chapters');
  const activityType = searchParams.get('type') as ActivityType;
  const mode = searchParams.get('mode') as PlayMode;
  const questionCount = parseInt(searchParams.get('count') || '10');

  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    async function fetchContent() {
      const { data, error } = await supabase
        .from('content')
        .select('*')
        .in('chapter_id', chapterIds)
        .eq('activity_type', activityType);

      if (error) {
        console.error('Error fetching content:', error);
        setLoading(false);
        return;
      }

      const allQuestions = data || [];
      if (allQuestions.length === 0) {
        setContent([]);
        setLoading(false);
        return;
      }

      let filteredQuestions = [...allQuestions];
      const limit = mode === 'competitive' ? 10 : questionCount;

      if (profile?.id) {
        const contentIds = allQuestions.map(q => q.id);
        const { data: progressData } = await supabase
          .from('student_question_progress')
          .select('content_id')
          .eq('user_id', profile.id)
          .eq('is_correct', true)
          .in('content_id', contentIds);

        const correctIds = new Set((progressData || []).map(r => r.content_id));
        const unansweredOrIncorrect = allQuestions.filter(q => !correctIds.has(q.id));
        const correctlyAnswered = allQuestions.filter(q => correctIds.has(q.id));

        if (unansweredOrIncorrect.length === 0) {
          // Reset progress for this student if they've answered all of them correctly
          await supabase
            .from('student_question_progress')
            .delete()
            .eq('user_id', profile.id)
            .in('content_id', contentIds);
          filteredQuestions = allQuestions;
        } else if (unansweredOrIncorrect.length >= limit) {
          filteredQuestions = unansweredOrIncorrect;
        } else {
          // We have some unanswered questions but less than limit. Fill remaining slots with correctly answered ones.
          const fillerCount = limit - unansweredOrIncorrect.length;
          const shuffledCorrect = correctlyAnswered.sort(() => Math.random() - 0.5);
          const fillers = shuffledCorrect.slice(0, fillerCount);
          filteredQuestions = [...unansweredOrIncorrect, ...fillers];
        }
      }

      // Shuffle and limit
      let items = filteredQuestions.sort(() => Math.random() - 0.5);
      items = items.slice(0, limit);

      setContent(items);
      setLoading(false);
    }

    if (chapterIds.length > 0 && activityType) {
      fetchContent();
    }
  }, [profile]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleComplete = useCallback(async (score: number, total: number, correctQuestionIds: string[] = []) => {
    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    const pointsEarnedRaw = mode === 'competitive' ? Math.round(score * 10) : Math.round(score * 5);
    let pointsEarnedCapped = pointsEarnedRaw;

    // Save attempt
    if (profile?.id) {
      const todayStr = new Date().toLocaleDateString('en-CA');
      const lastDate = profile.last_xp_earned_date;
      const currentDailyXPEarned = lastDate === todayStr ? (profile.daily_xp_earned || 0) : 0;
      const remainingQuota = Math.max(0, 200 - currentDailyXPEarned);
      
      pointsEarnedCapped = Math.min(pointsEarnedRaw, remainingQuota);

      await supabase.from('activity_attempts').insert({
        user_id: profile.id,
        chapter_ids: chapterIds,
        activity_type: activityType,
        mode,
        score,
        total_questions: total,
        time_taken_seconds: timeTaken,
        points_earned: pointsEarnedCapped,
      });

      // Update daily quota values on profiles table
      await supabase.from('profiles').update({
        daily_xp_earned: currentDailyXPEarned + pointsEarnedCapped,
        last_xp_earned_date: todayStr
      }).eq('id', profile.id);

      if (pointsEarnedCapped < pointsEarnedRaw) {
        const remainder = pointsEarnedRaw - pointsEarnedCapped;
        toast(`Daily limit reached! ${remainder} XP capped. ⚡`, 'info');
      }

      if (correctQuestionIds.length > 0) {
        const progressRows = correctQuestionIds.map(id => ({
          user_id: profile.id,
          content_id: id,
          is_correct: true,
        }));
        await supabase
          .from('student_question_progress')
          .upsert(progressRows, { onConflict: 'user_id,content_id' });
      }
    }

    // Navigate to result
    const params = new URLSearchParams();
    params.set('score', score.toString());
    params.set('total', total.toString());
    params.set('time', timeTaken.toString());
    params.set('points', pointsEarnedRaw.toString());
    params.set('actual_points', pointsEarnedCapped.toString());
    params.set('mode', mode);
    params.set('type', activityType);
    
    // Add chapters and question count configuration for "Play Again"
    chapterIds.forEach(id => params.append('chapters', id));
    params.set('count', questionCount.toString());

    navigate(`/student/result?${params.toString()}`, { replace: true });
  }, [startTime, mode, profile, chapterIds, activityType, questionCount, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="text-surface-500 mt-4 font-medium">Loading questions...</p>
        </div>
      </div>
    );
  }

  if (content.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">📭</div>
          <h2 className="text-xl font-bold text-surface-900 mb-2">No Content Found</h2>
          <p className="text-surface-500 mb-6">There are no {activityType} questions for these chapters yet.</p>
          <button
            onClick={() => navigate('/student')}
            className="text-primary-600 font-semibold hover:text-primary-700 cursor-pointer"
          >
            ← Go back to Home
          </button>
        </div>
      </div>
    );
  }

  const activityProps = {
    content,
    mode,
    onComplete: handleComplete,
    timeLimit: mode === 'competitive' ? 60 : undefined,
    showHints: mode === 'practice',
  };

  return (
    <div className={activityType === 'quiz' ? 'w-full min-h-screen flex flex-col' : 'max-w-2xl mx-auto py-4'}>
      {activityType === 'quiz' && <QuizActivity {...activityProps} />}
      {activityType === 'flashcard' && <FlashcardActivity {...activityProps} />}
      {activityType === 'matching' && <MatchingActivity {...activityProps} />}
      {activityType === 'picture' && <PictureGameActivity {...activityProps} />}
      {activityType === 'dragndrop' && <DragDropActivity {...activityProps} />}
    </div>
  );
}
