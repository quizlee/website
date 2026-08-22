import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { toast } from '../../components/ui/Toast';
import {
  FileText,
  Play,
  ExternalLink,
  Calendar,
  CheckCircle2,
  Clock,
  Check,
  RotateCcw,
  Layers,
  FileEdit,
  Monitor,
  Gamepad2,
} from 'lucide-react';

function getShareXp(share: { description?: string | null }): number {
  if (share.description) {
    try {
      const parsed = JSON.parse(share.description);
      if (parsed.xp !== undefined) return Number(parsed.xp) || 50;
    } catch {
      if (share.description.startsWith('XP:')) return Number(share.description.replace('XP:', '')) || 50;
    }
  }
  return 50;
}

function getEarnedActivityXp(
  share: { description?: string | null; url?: string | null },
  submission?: { score?: number | null } | null
): number {
  let xpPerItemVal = 10;
  if (share.description) {
    try {
      const parsed = JSON.parse(share.description);
      if (parsed.xp_per_item !== undefined) xpPerItemVal = Number(parsed.xp_per_item) || 10;
    } catch {
      // fallback
    }
  }
  let itemCount = 10;
  if (share.url?.startsWith('content_ids:')) {
    itemCount = share.url.replace('content_ids:', '').split(',').filter(Boolean).length || 1;
  }
  const totalActivityXp = itemCount * xpPerItemVal;

  if (submission && submission.score !== null && submission.score !== undefined) {
    let scorePct = 100;
    if (submission.score <= itemCount && itemCount > 0) {
      scorePct = Math.round((submission.score / itemCount) * 100);
    } else {
      scorePct = Math.min(100, Math.max(0, submission.score));
    }
    return Math.round((totalActivityXp * scorePct) / 100);
  }

  return totalActivityXp;
}

interface Share {
  id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  type: 'activity' | 'document' | 'copywork' | 'practical' | 'link';
  url: string | null;
  class_id: string | null;
  subject_id: string | null;
  chapter_id: string | null;
  activity_type: string | null;
  created_at: string;
  teacher?: { full_name: string | null; username: string | null } | null;
  class?: { name: string } | null;
  subject?: { name: string } | null;
  chapter?: { name: string } | null;
}

interface Submission {
  id: string;
  share_id: string;
  student_id: string;
  status: 'completed' | 'submitted' | 'verified';
  submission_content: string | null;
  score: number | null;
  completed_at: string;
  created_at?: string;
  student?: { full_name: string | null; username: string | null; avatar_url: string | null } | null;
}

export default function ClassActivitiesPage() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [shares, setShares] = useState<Share[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [allSubmissionsMap, setAllSubmissionsMap] = useState<Record<string, Submission[]>>({});
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('pending');
  const [chaptersMap, setChaptersMap] = useState<Record<string, string>>({});
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    fetchClassActivities(false);

    const handleCustomUpdate = () => {
      fetchClassActivities(true);
    };
    window.addEventListener('classroom_activity_updated', handleCustomUpdate);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'quizlee_classroom_sync') {
        fetchClassActivities(true);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('quizlee_classroom_updates');
      bc.onmessage = (event) => {
        if (event.data?.type === 'MATERIAL_SHARED' || event.data?.type === 'SUBMISSION_UPDATED') {
          fetchClassActivities(true);
        }
      };
    } catch {}

    const sharesChannel = supabase
      .channel('student-class-activities-shares-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teacher_shares',
        },
        () => {
          fetchClassActivities(true);
        }
      )
      .subscribe();

    const subChannel = supabase
      .channel('student-class-activities-submissions-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_share_submissions',
          filter: profile?.id ? `student_id=eq.${profile.id}` : undefined,
        },
        () => {
          fetchClassActivities(true);
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('classroom_activity_updated', handleCustomUpdate);
      window.removeEventListener('storage', handleStorageChange);
      if (bc) {
        try {
          bc.close();
        } catch {}
      }
      supabase.removeChannel(sharesChannel);
      supabase.removeChannel(subChannel);
    };
  }, [profile?.id]);

  async function fetchClassActivities(silent = false) {
    if (!profile?.id) return;
    if (!silent && !hasLoadedOnce) {
      setLoading(true);
    }
    try {
      useAuthStore.getState().fetchProfile();
      // 0. Fetch chapters for multi-chapter name resolving
      const { data: allChData } = await supabase.from('chapters').select('id, name');
      if (allChData) {
        const cMap: Record<string, string> = {};
        allChData.forEach((c) => { cMap[c.id] = c.name; });
        setChaptersMap(cMap);
      }

      // 1. Fetch connected teachers
      const { data: relations, error: relError } = await supabase
        .from('student_teacher_relations')
        .select('teacher_id')
        .eq('student_id', profile.id)
        .eq('status', 'approved');

      if (relError) throw relError;

      if (!relations || relations.length === 0) {
        setShares([]);
        setLoading(false);
        setHasLoadedOnce(true);
        return;
      }

      const teacherIds = relations.map((r) => r.teacher_id);

      // 2. Fetch shares
      const { data: sharesData, error: sharesError } = await supabase
        .from('teacher_shares')
        .select(`
          *,
          teacher:profiles!teacher_shares_teacher_id_fkey(full_name, username),
          class:classes(name),
          subject:subjects(name),
          chapter:chapters(name)
        `)
        .in('teacher_id', teacherIds)
        .order('created_at', { ascending: false });

      if (sharesError) throw sharesError;

      // 3. Fetch submissions for all shares
      const allShares = (sharesData as Share[]) || [];
      const shareIds = allShares.map((s) => s.id);
      const subMap: Record<string, Submission> = {};
      const shareSubMap: Record<string, Submission[]> = {};

      if (shareIds.length > 0) {
        const { data: subsData, error: subsError } = await supabase
          .from('student_share_submissions')
          .select(`
            *,
            student:profiles!student_share_submissions_student_id_fkey(full_name, username, avatar_url)
          `)
          .in('share_id', shareIds);

        if (subsError) {
          console.error('Error loading submissions:', subsError);
        } else if (subsData) {
          subsData.forEach((sub: Submission) => {
            if (sub.student_id === profile.id) {
              subMap[sub.share_id] = sub;
            }
            if (!shareSubMap[sub.share_id]) {
              shareSubMap[sub.share_id] = [];
            }
            shareSubMap[sub.share_id].push(sub);
          });
        }
      }



      setShares(allShares);
      setSubmissions(subMap);
      setAllSubmissionsMap(shareSubMap);
    } catch (error: any) {
      console.error('Error loading class activities:', error);
      toast(error.message, 'error');
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }

  async function toggleMarkComplete(shareId: string) {
    if (!profile?.id) return;
    const currentSub = submissions[shareId];

    if (currentSub?.status === 'verified') {
      toast('Verified materials cannot be undone.', 'warning');
      return;
    }

    try {
      if (currentSub) {
        // Optimistically delete submission (mark as pending)
        setSubmissions((prev) => {
          const next = { ...prev };
          delete next[shareId];
          return next;
        });
        setAllSubmissionsMap((prev) => {
          const next = { ...prev };
          if (next[shareId]) {
            next[shareId] = next[shareId].filter((s) => s.student_id !== profile.id);
          }
          return next;
        });

        const { error } = await supabase
          .from('student_share_submissions')
          .delete()
          .eq('id', currentSub.id);

        if (error) {
          // Rollback on error
          setSubmissions((prev) => ({ ...prev, [shareId]: currentSub }));
          setAllSubmissionsMap((prev) => ({
            ...prev,
            [shareId]: [...(prev[shareId] || []), currentSub],
          }));
          throw error;
        }

        toast('Marked as pending', 'info');
      } else {
        // Optimistically create temp submission
        const tempSub: Submission = {
          id: 'temp_' + Date.now(),
          share_id: shareId,
          student_id: profile.id,
          status: 'completed',
          submission_content: 'Marked complete',
          score: null,
          completed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          student: {
            full_name: profile.full_name || '',
            username: profile.username || '',
            avatar_url: profile.avatar_url || '',
          },
        };

        setSubmissions((prev) => ({ ...prev, [shareId]: tempSub }));
        setAllSubmissionsMap((prev) => ({
          ...prev,
          [shareId]: [...(prev[shareId] || []).filter((s) => s.student_id !== profile.id), tempSub],
        }));

        const { data, error } = await supabase
          .from('student_share_submissions')
          .upsert(
            {
              share_id: shareId,
              student_id: profile.id,
              status: 'completed',
              submission_content: 'Marked complete',
              completed_at: new Date().toISOString(),
            },
            { onConflict: 'share_id,student_id' }
          )
          .select(`
            *,
            student:profiles!student_share_submissions_student_id_fkey(full_name, username, avatar_url)
          `)
          .single();

        if (error) {
          // Rollback on error
          setSubmissions((prev) => {
            const next = { ...prev };
            delete next[shareId];
            return next;
          });
          setAllSubmissionsMap((prev) => {
            const next = { ...prev };
            if (next[shareId]) {
              next[shareId] = next[shareId].filter((s) => s.student_id !== profile.id);
            }
            return next;
          });
          throw error;
        }

        const newSub = data as Submission;
        setSubmissions((prev) => ({ ...prev, [shareId]: newSub }));
        setAllSubmissionsMap((prev) => ({
          ...prev,
          [shareId]: [...(prev[shareId] || []).filter((s) => s.student_id !== profile.id), newSub],
        }));
        toast('Marked as complete! 🎉', 'success');
      }
      window.dispatchEvent(new Event('classroom_activity_updated'));
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast(error.message, 'error');
    }
  }

  const pendingCount = shares.filter((s) => !submissions[s.id]).length;
  const completedCount = shares.filter((s) => !!submissions[s.id]).length;

  const filteredShares = shares.filter((share) => {
    const isCompleted = !!submissions[share.id];
    if (activeTab === 'pending') return !isCompleted;
    if (activeTab === 'completed') return isCompleted;
    return true;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Spinner size="lg" />
        <p className="text-sm font-semibold text-surface-400 animate-pulse">Loading classroom materials...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-200/60 pb-4">
        <div className="hidden sm:block">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 flex items-center gap-2">
            Classroom 🏫
          </h1>
          <p className="text-surface-500 text-xs sm:text-sm mt-0.5">
            Complete tasks, view materials, and play activities assigned by your teacher.
          </p>
        </div>

        {/* Control Bar: Filter Tabs */}
        <div className="flex items-center bg-surface-100 p-1 rounded-2xl border border-surface-200/80 shadow-inner self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'all'
                ? 'bg-white text-surface-900 shadow-sm'
                : 'text-surface-500 hover:text-surface-800'
            }`}
          >
            <span>All</span>
            <span className="bg-surface-200 text-surface-700 px-2 py-0.5 rounded-full text-[11px]">
              {shares.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-white text-amber-600 shadow-sm'
                : 'text-surface-500 hover:text-surface-800'
            }`}
          >
            <span>Pending</span>
            {pendingCount > 0 && (
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[11px]">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'completed'
                ? 'bg-white text-emerald-600 shadow-sm'
                : 'text-surface-500 hover:text-surface-800'
            }`}
          >
            <span>Completed</span>
            {completedCount > 0 && (
              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[11px]">
                {completedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Material Cards Grid */}
      {filteredShares.length === 0 ? (
        <Card className="text-center py-16 px-4 rounded-3xl border-dashed border-2 border-surface-200">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-100 flex items-center justify-center text-3xl">
            {activeTab === 'completed' ? '🏆' : activeTab === 'pending' ? '🎉' : '📭'}
          </div>
          <h3 className="text-lg font-bold text-surface-800">
            {activeTab === 'completed'
              ? 'No completed activities yet!'
              : activeTab === 'pending'
              ? 'All caught up! No pending tasks.'
              : 'No classroom materials shared yet.'}
          </h3>
          <p className="text-sm text-surface-500 mt-2 max-w-sm mx-auto">
            {activeTab === 'completed'
              ? 'Complete assigned activities or documents to track your progress here.'
              : activeTab === 'pending'
              ? 'Awesome job! Check back later for new materials shared by your teacher.'
              : 'Your teachers will post documents, links, and activities here.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredShares.map((share) => {
            const submission = submissions[share.id];
            const isCompleted = !!submission;
            const formattedDate = new Date(share.created_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });

            const isActivity = share.type === 'activity';
            const isDoc = share.type === 'document';
            const isPractical = share.type === 'practical';

            // Theme configurations
            const cardTheme = isActivity
              ? {
                  border: isCompleted ? 'border-surface-300' : 'border-indigo-100 hover:border-indigo-300',
                  badge: 'text-indigo-600 font-extrabold',
                  iconBg: 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white',
                  buttonBg: 'bg-gradient-to-r from-primary-600 via-indigo-600 to-primary-700 hover:from-primary-700 hover:to-indigo-800 text-white shadow-sm hover:shadow-md',
                  label: 'Activity',
                  icon: Gamepad2,
                }
              : isDoc
              ? {
                  border: isCompleted ? 'border-surface-300' : 'border-emerald-100 hover:border-emerald-300',
                  badge: 'text-emerald-600 font-extrabold',
                  iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white',
                  buttonBg: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-sm hover:shadow-md',
                  label: 'Document',
                  icon: FileText,
                }
              : isPractical
              ? {
                  border: isCompleted ? 'border-surface-300' : 'border-rose-100 hover:border-rose-300',
                  badge: 'text-rose-600 font-extrabold',
                  iconBg: 'bg-gradient-to-br from-rose-500 to-pink-600 text-white',
                  buttonBg: 'bg-gradient-to-r from-rose-600 via-pink-600 to-rose-700 hover:from-rose-700 hover:to-pink-800 text-white shadow-sm hover:shadow-md',
                  label: 'Practical',
                  icon: Monitor,
                }
              : {
                  border: isCompleted ? 'border-surface-300' : 'border-amber-100 hover:border-amber-300',
                  badge: 'text-amber-600 font-extrabold',
                  iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white',
                  buttonBg: 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-sm hover:shadow-md',
                  label: 'Copywork',
                  icon: FileEdit,
                };

            const IconComponent = cardTheme.icon;
            const shareSubmissions = allSubmissionsMap[share.id] || [];

            return (
              <div
                key={share.id}
                className={`
                  group relative flex flex-col justify-between rounded-2xl sm:rounded-3xl p-4 sm:p-5 border-2 transition-all duration-200 bg-white shadow-md hover:shadow-xl hover:-translate-y-0.5
                  ${cardTheme.border}
                `}
              >
                <div>
                  {/* Card Header Row */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <div className={`p-1.5 sm:p-2 rounded-xl ${isCompleted ? 'bg-surface-100 text-surface-400 border border-surface-200/80' : cardTheme.iconBg} shadow-sm shrink-0`}>
                        {isCompleted ? <Check size={15} className="stroke-[2.5]" /> : <IconComponent size={15} />}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className={`text-[10px] sm:text-[11px] uppercase tracking-wider ${isCompleted ? 'text-surface-400 font-extrabold' : cardTheme.badge} shrink-0`}>
                          {cardTheme.label}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-surface-400 shrink-0">
                          <Calendar size={12} />
                          <span>{formattedDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Top Right Corner: Done button when pending, Undone button when completed */}
                    <div className="shrink-0 ml-auto">
                      {isCompleted ? (
                        !isActivity && submission?.status !== 'verified' && (
                          <button
                            type="button"
                            onClick={() => toggleMarkComplete(share.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-extrabold text-surface-600 hover:text-surface-900 bg-surface-100 hover:bg-surface-200 border border-surface-200/80 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                            title="Mark as pending"
                          >
                            <RotateCcw size={11} className="shrink-0 text-surface-500" />
                            <span>Undone</span>
                          </button>
                        )
                      ) : (
                        !isActivity && (
                          <button
                            type="button"
                            onClick={() => toggleMarkComplete(share.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-extrabold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                            title="Done"
                          >
                            <Check size={11} className="shrink-0 text-emerald-600 stroke-[3]" />
                            <span>Done</span>
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Title Heading */}
                  <h3 className={`text-sm sm:text-base font-extrabold transition-colors leading-snug line-clamp-2 mb-3 break-words ${isCompleted ? 'line-through text-surface-400' : 'text-surface-900 group-hover:text-primary'}`}>
                    {share.title}
                  </h3>

                  {/* Action Buttons & XP Tag (Hidden when completed) */}
                  {!isCompleted && (
                    <div className="mb-3 sm:mb-4 flex flex-wrap items-center gap-2.5">
                      {isActivity && (share.chapter_id || share.url?.startsWith('content_ids:')) && share.activity_type && (
                        <>
                          <Button
                            size="md"
                            onClick={() => {
                              const params = new URLSearchParams();
                              let chIds: string[] = [];
                              if (share.description) {
                                try {
                                  const parsed = JSON.parse(share.description);
                                  if (Array.isArray(parsed.chapter_ids) && parsed.chapter_ids.length > 0) {
                                    chIds = parsed.chapter_ids;
                                  }
                                } catch {}
                              }
                              if (chIds.length > 0) {
                                chIds.forEach((id) => params.append('chapters', id));
                              } else if (share.chapter_id) {
                                params.append('chapters', share.chapter_id);
                              }
                              params.set('type', share.activity_type!);
                              params.set('mode', 'practice');
                              params.set('share_id', share.id);
                              if (share.url && share.url.startsWith('content_ids:')) {
                                params.set('content_ids', share.url.replace('content_ids:', ''));
                              }
                              params.set('from', '/student/class-activities');
                              navigate(`/student/play?${params.toString()}`);
                            }}
                            icon={<Play size={14} className="fill-current shrink-0" />}
                            className={`w-fit px-4 sm:px-5 py-2 text-xs sm:text-sm font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 ${cardTheme.buttonBg}`}
                          >
                            Start
                          </Button>
                          {(() => {
                            let xpPerItemVal = 10;
                            if (share.description) {
                              try {
                                const parsed = JSON.parse(share.description);
                                if (parsed.xp_per_item !== undefined) xpPerItemVal = Number(parsed.xp_per_item) || 10;
                              } catch {}
                            }
                            let itemCount = 10;
                            if (share.url?.startsWith('content_ids:')) {
                              itemCount = share.url.replace('content_ids:', '').split(',').filter(Boolean).length || 1;
                            }
                            const totalXp = itemCount * xpPerItemVal;
                            return (
                              <span className="text-xs sm:text-sm font-extrabold text-amber-600 shrink-0">
                                ⭐ +{totalXp} XP
                              </span>
                            );
                          })()}
                        </>
                      )}

                      {!isActivity && (
                        <>
                          {share.url && (
                            <a
                              href={share.url.startsWith('http') ? share.url : `https://${share.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button
                                size="md"
                                icon={<ExternalLink size={14} className="shrink-0" />}
                                className={`w-fit px-3.5 sm:px-5 py-2 text-xs sm:text-sm font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 ${cardTheme.buttonBg}`}
                              >
                                Open
                              </Button>
                            </a>
                          )}

                          <span className="text-xs sm:text-sm font-extrabold text-amber-600 shrink-0">
                            ⭐ +{getShareXp(share)} XP
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Row: Status Indicator & Context Pills */}
                <div className="mt-auto pt-3 border-t border-surface-200/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                  {/* Status Indicator */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isCompleted ? (
                      <>
                        {!isActivity ? (
                          submission?.status === 'verified' ? (
                            <div className="inline-flex items-center gap-1.5 text-green-600 font-extrabold text-[11px] sm:text-xs shrink-0">
                              <CheckCircle2 size={13} className="text-green-600 shrink-0" />
                              <span>+{getShareXp(share)} XP Earned</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 text-amber-700 font-extrabold text-[11px] sm:text-xs shrink-0">
                              <Clock size={13} className="text-amber-600 shrink-0 animate-pulse" />
                              <span>Pending Verification (+{getShareXp(share)} XP)</span>
                            </div>
                          )
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-green-600 font-extrabold text-[11px] sm:text-xs shrink-0">
                            <CheckCircle2 size={13} className="text-green-600 shrink-0" />
                            <span>+{getEarnedActivityXp(share, submission)} XP Earned</span>
                          </div>
                        )}

                        {/* Other students who submitted */}
                        {shareSubmissions
                          .filter((sub) => sub.student_id !== profile?.id)
                          .map((sub) => {
                          const firstName = sub.student?.full_name?.trim().split(' ')[0] || sub.student?.username || 'Student';
                          return (
                            <div
                              key={sub.id}
                              className="inline-flex items-center gap-1 bg-white border border-emerald-200/80 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold text-surface-800 shadow-2xs shrink-0"
                              title={`${sub.student?.full_name || 'Student'} completed`}
                            >
                              <Check size={11} className="text-emerald-600 stroke-[3] shrink-0" />
                              {sub.student?.avatar_url ? (
                                <img
                                  src={sub.student.avatar_url}
                                  alt={firstName}
                                  className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full bg-emerald-100 text-emerald-800 text-[8px] font-extrabold flex items-center justify-center shrink-0">
                                  {firstName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className="truncate max-w-[70px]">{firstName}</span>
                            </div>
                          );
                        })}
                      </>
                    ) : (
                      <div className="inline-flex items-center gap-1 text-amber-700 font-bold text-[11px] sm:text-xs shrink-0">
                        <Clock size={12} className="text-amber-600 shrink-0" />
                        <span>Pending</span>
                      </div>
                    )}
                  </div>

                  {/* Context Pills (Course info) */}
                  <div className="flex flex-wrap items-center gap-1.5 max-w-full">
                    {(() => {
                      let chIds: string[] = [];
                      if (share.description) {
                        try {
                          const parsed = JSON.parse(share.description);
                          if (Array.isArray(parsed.chapter_ids) && parsed.chapter_ids.length > 0) {
                            chIds = parsed.chapter_ids;
                          }
                        } catch {}
                      }

                      const allNames = chIds
                        .map((id) => chaptersMap[id] || (id === share.chapter_id ? share.chapter?.name : ''))
                        .filter(Boolean);

                      let chapterText = '';
                      if (chIds.length > 1) {
                        chapterText = `${chIds.length} Chapters`;
                      } else if (allNames.length > 0) {
                        chapterText = allNames.join(', ');
                      } else {
                        chapterText = share.chapter?.name || share.subject?.name || '';
                      }

                      if (!chapterText) return null;

                      const tooltipText = allNames.length > 0 ? allNames.join(', ') : chapterText;

                      return (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl bg-surface-100 text-surface-700 font-semibold text-[10px] sm:text-[11px] truncate max-w-[180px] sm:max-w-[260px]"
                          title={tooltipText}
                        >
                          <Layers size={11} className="text-surface-400 shrink-0" />
                          <span className="truncate">{chapterText}</span>
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

