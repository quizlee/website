import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { toast } from '../../components/ui/Toast';
import {
  BookOpen,
  FileText,
  Link as LinkIcon,
  Play,
  ExternalLink,
  Clipboard,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface Share {
  id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  type: 'activity' | 'document' | 'link';
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
  status: 'completed' | 'submitted';
  submission_content: string | null;
  score: number | null;
  completed_at: string;
}

export default function ClassActivitiesPage() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [shares, setShares] = useState<Share[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('all');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [responseTexts, setResponseTexts] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchClassActivities();
  }, [profile?.id]);

  async function fetchClassActivities() {
    if (!profile?.id) return;
    setLoading(true);
    try {
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

      // 3. Fetch submissions
      const { data: subsData, error: subsError } = await supabase
        .from('student_share_submissions')
        .select('*')
        .eq('student_id', profile.id);

      if (subsError) throw subsError;

      const subMap: Record<string, Submission> = {};
      if (subsData) {
        subsData.forEach((sub: Submission) => {
          subMap[sub.share_id] = sub;
        });
      }

      setShares((sharesData as Share[]) || []);
      setSubmissions(subMap);
    } catch (error: any) {
      console.error('Error loading class activities:', error);
      toast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDocLinkSubmit(shareId: string) {
    const text = responseTexts[shareId]?.trim();
    if (!text) {
      toast('Please write a brief response before submitting.', 'info');
      return;
    }

    setSubmittingId(shareId);
    try {
      const { data, error } = await supabase
        .from('student_share_submissions')
        .upsert(
          {
            share_id: shareId,
            student_id: profile!.id,
            status: 'submitted',
            submission_content: text,
            completed_at: new Date().toISOString(),
          },
          { onConflict: 'share_id,student_id' }
        )
        .select()
        .single();

      if (error) throw error;

      toast('Task submitted successfully! 🎉', 'success');
      setSubmissions((prev) => ({ ...prev, [shareId]: data as Submission }));
      setResponseTexts((prev) => ({ ...prev, [shareId]: '' }));
    } catch (error: any) {
      console.error('Submission error:', error);
      toast(error.message, 'error');
    } finally {
      setSubmittingId(null);
    }
  }

  const filteredShares = shares.filter((share) => {
    const isCompleted = !!submissions[share.id];
    if (activeTab === 'pending') return !isCompleted;
    if (activeTab === 'completed') return isCompleted;
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-surface-900 flex items-center gap-2.5">
            Classroom 🏫
          </h1>
          <p className="text-surface-500 mt-1">
            Complete tasks, view materials, and play activities assigned by your teacher.
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex bg-surface-100 p-1.5 rounded-2xl border border-surface-200 shadow-sm shrink-0 self-start sm:self-center">
          {(['all', 'pending', 'completed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all duration-200 cursor-pointer
                ${
                  activeTab === tab
                    ? 'bg-white text-primary shadow-md scale-102'
                    : 'text-surface-500 hover:text-surface-800'
                }
              `}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {filteredShares.length === 0 ? (
        <Card className="text-center py-16">
          <div className="text-5xl mb-4">
            {activeTab === 'completed' ? '🏆' : activeTab === 'pending' ? '🎉' : '📭'}
          </div>
          <h3 className="text-lg font-bold text-surface-800">
            {activeTab === 'completed'
              ? 'No completed tasks yet!'
              : activeTab === 'pending'
              ? 'All caught up! No pending tasks.'
              : 'No classroom materials yet!'}
          </h3>
          <p className="text-sm text-surface-500 mt-2 max-w-sm mx-auto">
            {activeTab === 'completed'
              ? "Complete activities or submit documents assigned by your teacher to see them here."
              : activeTab === 'pending'
              ? "Great job! Keep checking back for new materials shared by your teacher."
              : "Ask your teacher to share documents, links, or play activities with you!"}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredShares.map((share) => {
            const submission = submissions[share.id];
            const isCompleted = !!submission;
            const formattedDate = new Date(share.created_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            // Activity type display details
            const isActivity = share.type === 'activity';
            const iconMap = {
              activity: BookOpen,
              document: FileText,
              link: LinkIcon,
            };
            const Icon = iconMap[share.type];

            const badgeBgColor = {
              activity: 'bg-primary-50 text-primary border-primary-200',
              document: 'bg-secondary-50 text-secondary-700 border-secondary-200',
              link: 'bg-accent-50 text-accent-700 border-accent-200',
            }[share.type];

            return (
              <Card
                key={share.id}
                className={`
                  border-2 transition-all duration-300 relative overflow-hidden
                  ${
                    isCompleted
                      ? 'border-green-100 hover:border-green-200 bg-white'
                      : 'border-surface-100 hover:border-primary-100 hover:shadow-md bg-white'
                  }
                `}
              >
                {isCompleted && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-green-500" />
                )}

                <div className="p-6">
                  {/* Top info row */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold uppercase tracking-wide border px-2.5 py-1 rounded-full flex items-center gap-1.5 ${badgeBgColor}`}
                      >
                        <Icon size={12} />
                        {share.type}
                      </span>
                      {isActivity && share.activity_type && (
                        <span className="text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full capitalize">
                          {share.activity_type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs font-semibold text-surface-400">
                      <span className="flex items-center gap-1">
                        <User size={14} />
                        {share.teacher?.full_name || 'Teacher'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {formattedDate}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h2 className="text-xl font-bold text-surface-900 mb-2 leading-snug">{share.title}</h2>
                  {share.description && (
                    <p className="text-sm text-surface-500 mb-4 whitespace-pre-wrap">{share.description}</p>
                  )}

                  {/* Activity Details / Material Actions */}
                  {isActivity && (
                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl mb-5 text-sm">
                      <p className="text-xs text-surface-400 uppercase font-black tracking-wide mb-2">
                        Target Chapters
                      </p>
                      <p className="font-extrabold text-surface-850">
                        {share.class?.name || 'Class'} &bull; {share.subject?.name || 'Subject'}
                      </p>
                      <p className="text-surface-600 font-semibold mt-1">
                        📂 Chapter: {share.chapter?.name || 'Chapter'}
                      </p>
                    </div>
                  )}

                  {/* Action Section */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 pt-5 border-t border-surface-50">
                    <div className="flex flex-col gap-1.5">
                      {isCompleted ? (
                        <div className="flex items-center gap-2 text-green-700 font-bold text-sm">
                          <CheckCircle2 size={18} className="text-green-500 fill-green-50" />
                          <span>Task Completed!</span>
                          {submission.score !== null && (
                            <span className="bg-green-50 text-green-700 px-2 py-0.5 border border-green-200 rounded-md text-xs font-black ml-1.5">
                              Score: {submission.score}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-warning-700 font-bold text-sm">
                          <AlertCircle size={18} className="text-warning-500" />
                          <span>Task Pending</span>
                        </div>
                      )}
                      {isCompleted && (
                        <p className="text-[11px] text-surface-400 font-medium">
                          Completed on {new Date(submission.completed_at).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-3">
                      {/* Play Activity Button */}
                      {isActivity && share.chapter_id && share.activity_type && (
                        <Button
                          onClick={() => {
                            const params = new URLSearchParams();
                            params.append('chapters', share.chapter_id!);
                            params.set('type', share.activity_type!);
                            params.set('mode', 'practice');
                            params.set('share_id', share.id);
                            params.set('from', '/student/class-activities');
                            navigate(`/student/play?${params.toString()}`);
                          }}
                          icon={isCompleted ? <Play size={16} /> : <Play size={16} />}
                          variant={isCompleted ? 'outline' : 'primary'}
                          className="w-full sm:w-auto"
                        >
                          {isCompleted ? 'Play Again 🎮' : 'Play Activity 🎮'}
                        </Button>
                      )}

                      {/* Open Link / Document Button */}
                      {(share.type === 'document' || share.type === 'link') && share.url && (
                        <a
                          href={share.url.startsWith('http') ? share.url : `https://${share.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full sm:w-auto"
                        >
                          <Button
                            variant="outline"
                            icon={<ExternalLink size={16} />}
                            className="w-full"
                          >
                            Open {share.type === 'document' ? 'Document' : 'Link'}
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Submission Form (for Documents & Links) */}
                  {(share.type === 'document' || share.type === 'link') && (
                    <div className="mt-5 pt-5 border-t border-dashed border-surface-100">
                      {isCompleted ? (
                        <div className="bg-green-50/40 border border-green-100 p-4 rounded-xl">
                          <p className="text-xs text-green-800 font-black uppercase tracking-wider mb-1">
                            Your Submission
                          </p>
                          <p className="text-sm text-surface-700 italic">
                            "{submission.submission_content}"
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <label className="block text-xs font-bold text-surface-500 uppercase tracking-wide">
                            Write response / Paste completed link:
                          </label>
                          <textarea
                            rows={2}
                            value={responseTexts[share.id] || ''}
                            onChange={(e) =>
                              setResponseTexts((prev) => ({
                                ...prev,
                                [share.id]: e.target.value,
                              }))
                            }
                            placeholder={
                              share.type === 'document'
                                ? 'e.g. Completed the worksheet! (Or paste your homework link)'
                                : 'e.g. Finished reading, very interesting!'
                            }
                            className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none bg-surface-50/50"
                          />
                          <div className="flex justify-end">
                            <Button
                              onClick={() => handleDocLinkSubmit(share.id)}
                              loading={submittingId === share.id}
                              variant="primary"
                              size="sm"
                              icon={<Clipboard size={14} />}
                            >
                              Submit Task
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
