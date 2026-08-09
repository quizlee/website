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
import {
  getActivePlaySession,
  saveActivePlaySession,
  clearActivePlaySession,
} from '../../lib/playSession';

export default function PlayPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuthStore();

  const chapterIds = searchParams.getAll('chapters');
  const activityType = searchParams.get('type') as ActivityType;
  const mode = searchParams.get('mode') as PlayMode;
  const questionCount = parseInt(searchParams.get('count') || '10');
  const shareId = searchParams.get('share_id');

  const sessionKey = `${activityType}_${[...chapterIds].sort().join('_')}_${mode}_${questionCount}_${shareId || ''}`;

  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [startTime, setStartTime] = useState<number>(Date.now());

  useEffect(() => {
    async function fetchContent() {
      // 1. Check if an active play session already exists in sessionStorage for this session key
      const existingSession = getActivePlaySession(sessionKey);
      if (existingSession && existingSession.content && existingSession.content.length > 0) {
        setContent(existingSession.content);
        if (existingSession.startTime) {
          setStartTime(existingSession.startTime);
        }
        setLoading(false);
        return;
      }

      // 2. Check for custom content IDs (bulk imported activity shared by teacher)
      let targetContentIds: string[] = [];
      const queryContentIds = searchParams.get('content_ids');

      if (queryContentIds) {
        targetContentIds = queryContentIds.split(',').map((s) => s.trim()).filter(Boolean);
      } else if (shareId) {
        const { data: shareData } = await supabase
          .from('teacher_shares')
          .select('url')
          .eq('id', shareId)
          .maybeSingle();

        if (shareData?.url && shareData.url.startsWith('content_ids:')) {
          targetContentIds = shareData.url.replace('content_ids:', '').split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }

      if (targetContentIds.length > 0) {
        const { data: customData, error: customErr } = await supabase
          .from('content')
          .select('*')
          .in('id', targetContentIds);

        if (customErr) {
          console.error('Error fetching custom activity content:', customErr);
          setLoading(false);
          return;
        }

        const items = customData || [];
        if (items.length > 0) {
          const now = Date.now();
          saveActivePlaySession({
            sessionKey,
            content: items,
            startTime: now,
            currentIndex: 0,
            answers: Array(items.length).fill(null),
            hintsShown: Array(items.length).fill(false),
            optionOrders: {},
          });

          setContent(items);
          setStartTime(now);
          setLoading(false);
          return;
        }
      }

      // 3. Fallback: Fetch standard chapter content if no custom content IDs
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

      const now = Date.now();
      saveActivePlaySession({
        sessionKey,
        content: items,
        startTime: now,
        currentIndex: 0,
        answers: Array(items.length).fill(null),
        hintsShown: Array(items.length).fill(false),
        optionOrders: {},
      });

      setContent(items);
      setStartTime(now);
      setLoading(false);
    }

    if ((chapterIds.length > 0 || searchParams.has('content_ids') || shareId) && activityType) {
      fetchContent();
    }
  }, [profile]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleComplete = useCallback(async (score: number, total: number, correctQuestionIds: string[] = []) => {
    clearActivePlaySession();
    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    
    let pointsEarnedRaw = mode === 'competitive' ? Math.round(score * 10) : Math.round(score * 5);

    // If this is a classroom activity share, calculate actual activity XP based on xp_per_item
    if (shareId) {
      let xpPerItemVal = 10;
      try {
        const { data: shareData } = await supabase
          .from('teacher_shares')
          .select('description')
          .eq('id', shareId)
          .maybeSingle();

        if (shareData?.description) {
          const parsed = JSON.parse(shareData.description);
          if (parsed.xp_per_item !== undefined) {
            xpPerItemVal = Number(parsed.xp_per_item) || 10;
          }
        }
      } catch {
        // fallback
      }

      const totalActivityXp = (total > 0 ? total : content.length) * xpPerItemVal;
      const scoreRatio = total > 0 ? (score / total) : 1;
      pointsEarnedRaw = Math.round(totalActivityXp * scoreRatio);
    }

    let pointsEarnedCapped = pointsEarnedRaw;

    // Save attempt & award points to database
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

      // Update total points & daily quota values on profiles table in database
      const newTotalPoints = (profile.points || 0) + pointsEarnedCapped;
      await supabase.from('profiles').update({
        points: newTotalPoints,
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

      if (shareId) {
        await supabase.from('student_share_submissions').upsert({
          share_id: shareId,
          student_id: profile.id,
          status: 'completed',
          score: score,
          completed_at: new Date().toISOString()
        }, { onConflict: 'share_id,student_id' });
        window.dispatchEvent(new Event('classroom_activity_updated'));
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
    if (shareId) {
      params.set('share_id', shareId);
    }
    const fromUrl = searchParams.get('from');
    if (fromUrl) {
      params.set('from', fromUrl);
    }

    navigate(`/student/result?${params.toString()}`, { replace: true });
  }, [startTime, mode, profile, chapterIds, activityType, questionCount, navigate, shareId, searchParams]);

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
    const fromUrl = searchParams.get('from');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">📭</div>
          <h2 className="text-xl font-bold text-surface-900 mb-2">No Content Found</h2>
          <p className="text-surface-500 mb-6">There are no {activityType} questions for these chapters yet.</p>
          <button
            onClick={() => navigate(fromUrl || '/student')}
            className="text-primary-600 font-semibold hover:text-primary-700 cursor-pointer"
          >
            ← Go back
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
