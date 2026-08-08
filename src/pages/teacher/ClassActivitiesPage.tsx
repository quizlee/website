import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { toast } from '../../components/ui/Toast';
import {
  Plus,
  Trash2,
  BookOpen,
  FileText,
  Link as LinkIcon,
  Users,
  CheckCircle,
  ExternalLink,
  Calendar,
  Layers,
  School as SchoolIcon,
  ChevronDown,
} from 'lucide-react';

interface ClassItem {
  id: string;
  name: string;
}

interface SubjectItem {
  id: string;
  name: string;
}

interface ChapterItem {
  id: string;
  name: string;
}

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
  class?: { name: string } | null;
  subject?: { name: string } | null;
  chapter?: { name: string } | null;
}

interface Submission {
  id: string;
  share_id: string;
  student_id: string;
  status: 'completed' | 'submitted';
  submission_content: string | null;
  score: number | null;
  completed_at: string;
  student?: { full_name: string | null; username: string | null } | null;
  share?: Share | null;
}

export default function TeacherClassActivitiesPage() {
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [shares, setShares] = useState<Share[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [viewMode, setViewMode] = useState<'shares' | 'submissions'>('shares');

  // Form / Modal state
  const [showModal, setShowModal] = useState(false);
  const [shareType, setShareType] = useState<'activity' | 'document' | 'link'>('activity');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [activityType, setActivityType] = useState('quiz');
  const [saving, setSaving] = useState(false);

  // Student selection state
  const [connectedStudents, setConnectedStudents] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // School & Main Page Curriculum Filter state
  const [schoolName, setSchoolName] = useState('');
  const [filterClass, setFilterClass] = useState(() => localStorage.getItem('teacher_class_activities_class') || '');
  const [filterSubject, setFilterSubject] = useState(() => localStorage.getItem('teacher_class_activities_subject') || '');
  const [filterChapterIds, setFilterChapterIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('teacher_class_activities_chapters');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [filterSubjects, setFilterSubjects] = useState<SubjectItem[]>([]);
  const [filterChapters, setFilterChapters] = useState<ChapterItem[]>([]);

  const [filterChapterDropdownOpen, setFilterChapterDropdownOpen] = useState(false);
  const filterChapterRef = useRef<HTMLDivElement>(null);

  // Persist curriculum filters to localStorage
  useEffect(() => {
    if (filterClass) {
      localStorage.setItem('teacher_class_activities_class', filterClass);
    } else {
      localStorage.removeItem('teacher_class_activities_class');
    }
  }, [filterClass]);

  useEffect(() => {
    if (filterSubject) {
      localStorage.setItem('teacher_class_activities_subject', filterSubject);
    } else {
      localStorage.removeItem('teacher_class_activities_subject');
    }
  }, [filterSubject]);

  useEffect(() => {
    localStorage.setItem('teacher_class_activities_chapters', JSON.stringify(filterChapterIds));
  }, [filterChapterIds]);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (filterChapterRef.current && !filterChapterRef.current.contains(event.target as Node)) {
        setFilterChapterDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Curriculum lists for dropdowns
  const [classes, setClasses] = useState<ClassItem[]>([]);

  // Fetch school name
  useEffect(() => {
    if (!profile?.school_id) return;
    supabase
      .from('schools')
      .select('name')
      .eq('id', profile.school_id)
      .single()
      .then(({ data }) => {
        if (data) setSchoolName(data.name);
      });
  }, [profile?.school_id]);

  // Fetch filter subjects when filterClass changes
  useEffect(() => {
    if (!filterClass) {
      setFilterSubjects([]);
      setFilterSubject('');
      setFilterChapterIds([]);
      return;
    }
    let query = supabase.from('subjects').select('id, name').eq('class_id', filterClass);
    if (profile?.school_id) {
      query = query.eq('school_id', profile.school_id);
    }
    query.order('name').then(({ data }) => {
      if (data) {
        setFilterSubjects(data);
        if (filterSubject && !data.some(s => s.id === filterSubject)) {
          setFilterSubject('');
          setFilterChapterIds([]);
        }
      }
    });
  }, [filterClass, profile?.school_id]);

  // Fetch filter chapters when filterSubject changes
  useEffect(() => {
    if (!filterSubject) {
      setFilterChapters([]);
      setFilterChapterIds([]);
      return;
    }
    supabase
      .from('chapters')
      .select('id, name')
      .eq('subject_id', filterSubject)
      .order('sort_order')
      .then(({ data }) => {
        if (data) {
          setFilterChapters(data);
          // Keep only saved filter chapters that are valid for the new subject
          setFilterChapterIds(prev => prev.filter(id => data.some(ch => ch.id === id)));
        }
      });
  }, [filterSubject]);

  useEffect(() => {
    fetchData();
    fetchCurriculumClasses();
    fetchConnectedStudents();
  }, [profile?.id]);

  useEffect(() => {
    if (showModal) {
      setSelectedStudentIds(connectedStudents.map((s) => s.id));
    }
  }, [showModal, connectedStudents]);

  async function fetchConnectedStudents() {
    if (!profile?.id) return;
    try {
      const { data: relations, error: relError } = await supabase
        .from('student_teacher_relations')
        .select('student_id')
        .eq('teacher_id', profile.id)
        .eq('status', 'approved');

      if (relError) throw relError;

      if (relations && relations.length > 0) {
        const studentIds = relations.map((r) => r.student_id);
        const { data: profilesData, error: profError } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', studentIds);

        if (profError) throw profError;
        setConnectedStudents(profilesData || []);
      } else {
        setConnectedStudents([]);
      }
    } catch (err) {
      console.error('Error fetching connected students:', err);
    }
  }



  async function fetchData() {
    if (!profile?.id) return;
    setLoading(true);
    try {
      // 1. Fetch shares
      const { data: sharesData, error: sharesError } = await supabase
        .from('teacher_shares')
        .select(`
          *,
          class:classes(name),
          subject:subjects(name),
          chapter:chapters(name)
        `)
        .eq('teacher_id', profile.id)
        .order('created_at', { ascending: false });

      if (sharesError) throw sharesError;

      // 2. Fetch submissions
      const { data: subsData, error: subsError } = await supabase
        .from('student_share_submissions')
        .select(`
          *,
          student:profiles!student_share_submissions_student_id_fkey(full_name, username),
          share:teacher_shares(*)
        `)
        .order('completed_at', { ascending: false });

      if (subsError) throw subsError;

      // Filter submissions for shares belonging to this teacher
      const filteredSubs = (subsData as Submission[] || []).filter(
        (sub) => sub.share?.teacher_id === profile.id
      );

      setShares((sharesData as Share[]) || []);
      setSubmissions(filteredSubs);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchCurriculumClasses() {
    const { data } = await supabase.from('classes').select('id, name').order('sort_order');
    if (data) setClasses(data);
  }

  async function handleShare() {
    if (!title.trim()) {
      toast('Title is required', 'error');
      return;
    }
    if (shareType !== 'activity' && !url.trim()) {
      toast('URL is required for documents and links', 'error');
      return;
    }
    if (shareType === 'activity' && (!filterClass || !filterSubject || filterChapterIds.length === 0)) {
      toast('Please select a Class, Subject, and at least one Chapter in the filter bar first', 'error');
      return;
    }
    if (selectedStudentIds.length === 0) {
      toast('Please select at least one student to share with.', 'error');
      return;
    }

    setSaving(true);
    try {
      if (filterChapterIds.length > 0) {
        const promises = filterChapterIds.map(async (chId: string) => {
          const shareData = {
            teacher_id: profile!.id,
            title: title.trim(),
            description: description.trim() || null,
            type: shareType,
            url: shareType !== 'activity' ? url.trim() : null,
            class_id: filterClass || null,
            subject_id: filterSubject || null,
            chapter_id: chId,
            activity_type: shareType === 'activity' ? activityType : null,
            student_ids: selectedStudentIds,
          };
          const { error } = await supabase.from('teacher_shares').insert(shareData);
          if (error) throw error;
        });
        await Promise.all(promises);
      } else {
        const shareData = {
          teacher_id: profile!.id,
          title: title.trim(),
          description: description.trim() || null,
          type: shareType,
          url: shareType !== 'activity' ? url.trim() : null,
          class_id: filterClass || null,
          subject_id: filterSubject || null,
          chapter_id: null,
          activity_type: shareType === 'activity' ? activityType : null,
          student_ids: selectedStudentIds,
        };
        const { error } = await supabase.from('teacher_shares').insert(shareData);
        if (error) throw error;
      }
      toast('Resource shared successfully! 🚀', 'success');
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteShare(id: string) {
    if (!confirm('Are you sure you want to delete this shared resource? Student submissions will also be deleted.')) return;
    try {
      const { error } = await supabase.from('teacher_shares').delete().eq('id', id);
      if (error) throw error;
      toast('Resource deleted', 'info');
      fetchData();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  }

  function resetForm() {
    setTitle('');
    setDescription('');
    setUrl('');
    setActivityType('quiz');
    setShareType('activity');
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Curriculum & School Selection Bar (before Shared Materials container) */}
      <Card padding="sm" className="mb-6 bg-white border border-surface-200 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-100 pb-2">
            <div className="flex items-center gap-2">
              <SchoolIcon size={16} className="text-secondary-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-surface-500">School:</span>
              <span className="text-xs font-bold text-secondary-700 bg-secondary-50 px-2.5 py-0.5 rounded-full border border-secondary-100">
                {schoolName || 'Your School'}
              </span>
            </div>
            {(filterClass || filterSubject || filterChapterIds.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setFilterClass('');
                  setFilterSubject('');
                  setFilterChapterIds([]);
                }}
                className="text-xs text-secondary-650 hover:underline font-bold cursor-pointer"
              >
                Clear Filter
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Select Class */}
            <div>
              <label className="block text-[10px] font-bold text-surface-500 uppercase tracking-wide mb-1">
                Select Class
              </label>
              <select
                value={filterClass}
                onChange={(e) => {
                  setFilterClass(e.target.value);
                  setFilterSubject('');
                  setFilterChapterIds([]);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-surface-200 bg-surface-50/50 font-semibold text-surface-800 focus:outline-none focus:border-secondary-500 cursor-pointer"
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Select Subject */}
            <div>
              <label className="block text-[10px] font-bold text-surface-500 uppercase tracking-wide mb-1">
                Select Subject
              </label>
              <select
                value={filterSubject}
                onChange={(e) => {
                  setFilterSubject(e.target.value);
                  setFilterChapterIds([]);
                }}
                disabled={!filterClass}
                className="w-full px-3 py-2 text-xs rounded-xl border border-surface-200 bg-surface-50/50 font-semibold text-surface-800 focus:outline-none focus:border-secondary-500 disabled:opacity-50 cursor-pointer"
              >
                <option value="">All Subjects</option>
                {filterSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Select Chapters (Multi-select) */}
            <div className="relative" ref={filterChapterRef}>
              <label className="block text-[10px] font-bold text-surface-500 uppercase tracking-wide mb-1">
                Select Chapters
              </label>
              <button
                type="button"
                disabled={!filterSubject}
                onClick={() => setFilterChapterDropdownOpen(!filterChapterDropdownOpen)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-surface-200 bg-surface-50/50 font-semibold text-surface-800 text-left focus:outline-none focus:border-secondary-500 disabled:opacity-50 flex items-center justify-between cursor-pointer"
              >
                <span className="truncate">
                  {filterChapterIds.length === 0
                    ? 'All Chapters'
                    : `${filterChapterIds.length} Chapter${filterChapterIds.length > 1 ? 's' : ''} Selected`}
                </span>
                <ChevronDown size={14} className="text-surface-450 shrink-0" />
              </button>

              {filterChapterDropdownOpen && filterSubject && (
                <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-surface-200 rounded-xl shadow-lg z-50 p-2 space-y-1">
                  {filterChapters.map((ch) => {
                    const isChecked = filterChapterIds.includes(ch.id);
                    return (
                      <label
                        key={ch.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-surface-700 hover:bg-surface-50 cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setFilterChapterIds(prev =>
                              prev.includes(ch.id)
                                ? prev.filter(id => id !== ch.id)
                                : [...prev, ch.id]
                            );
                          }}
                          className="rounded text-secondary-600 focus:ring-secondary/20 border-surface-300 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="truncate">{ch.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex border-b border-surface-200 mb-6 gap-6">
        <button
          onClick={() => setViewMode('shares')}
          className={`pb-3 font-bold text-sm border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            viewMode === 'shares'
              ? 'border-secondary-500 text-secondary-650'
              : 'border-transparent text-surface-450 hover:text-surface-700'
          }`}
        >
          <Layers size={16} />
          Shared Materials ({shares.filter((s) => {
            if (filterClass && s.class_id !== filterClass) return false;
            if (filterSubject && s.subject_id !== filterSubject) return false;
            if (filterChapterIds.length > 0 && (!s.chapter_id || !filterChapterIds.includes(s.chapter_id))) return false;
            return true;
          }).length})
        </button>
        <button
          onClick={() => setViewMode('submissions')}
          className={`pb-3 font-bold text-sm border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            viewMode === 'submissions'
              ? 'border-secondary-500 text-secondary-650'
              : 'border-transparent text-surface-450 hover:text-surface-700'
          }`}
        >
          <Users size={16} />
          Student Submissions ({submissions.length})
        </button>
      </div>

      {/* View Mode Content */}
      {viewMode === 'shares' ? (
        shares.filter((s) => {
          if (filterClass && s.class_id !== filterClass) return false;
          if (filterSubject && s.subject_id !== filterSubject) return false;
          if (filterChapterIds.length > 0 && (!s.chapter_id || !filterChapterIds.includes(s.chapter_id))) return false;
          return true;
        }).length === 0 ? (
          <Card className="text-center py-16">
            <div className="text-5xl mb-4">📤</div>
            <h3 className="text-lg font-bold text-surface-800">No resources shared yet</h3>
            <p className="text-sm text-surface-500 mt-1 max-w-sm mx-auto">
              Share learning activities, assignments, websites, or documents directly with your connected students.
            </p>
            <Button
              className="mt-6"
              variant="outline"
              icon={<Plus size={16} />}
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
            >
              Share your first resource
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {shares.filter((s) => {
              if (filterClass && s.class_id !== filterClass) return false;
              if (filterSubject && s.subject_id !== filterSubject) return false;
              if (filterChapterIds.length > 0 && (!s.chapter_id || !filterChapterIds.includes(s.chapter_id))) return false;
              return true;
            }).map((share) => {
              const Icon = {
                activity: BookOpen,
                document: FileText,
                link: LinkIcon,
              }[share.type];

              const badgeColor = {
                activity: 'bg-primary-50 text-primary border-primary-100',
                document: 'bg-secondary-50 text-secondary-750 border-secondary-100',
                link: 'bg-accent-50 text-accent-750 border-accent-100',
              }[share.type];

              // Count submissions for this specific share
              const subCount = submissions.filter((s) => s.share_id === share.id).length;

              return (
                <Card key={share.id} className="relative hover:shadow-md transition-all border-surface-150">
                  <div className="p-5 flex flex-col h-full">
                    {/* Header badges */}
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badgeColor} flex items-center gap-1.5`}>
                        <Icon size={12} />
                        {share.type}
                      </span>
                      <span className="text-xs font-semibold text-surface-400 flex items-center gap-1">
                        <Calendar size={13} />
                        {new Date(share.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Content */}
                    <h3 className="text-lg font-bold text-surface-900 mb-1 leading-snug">{share.title}</h3>
                    {share.description && (
                      <p className="text-sm text-surface-500 mb-4 line-clamp-2">{share.description}</p>
                    )}

                    {/* Meta specifics */}
                    {(share.class?.name || share.subject?.name || share.chapter?.name) && (
                      <div className="mt-auto bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-surface-600 mb-4 space-y-1">
                        <p className="font-extrabold text-surface-800">
                          {share.class?.name || 'Class'} {share.subject?.name ? `• ${share.subject.name}` : ''}
                        </p>
                        {share.chapter?.name && <p className="truncate">📁 Chapter: {share.chapter.name}</p>}
                        {share.type === 'activity' && <p className="capitalize">🎮 Mode: Practice ({share.activity_type})</p>}
                      </div>
                    )}

                    {share.type !== 'activity' && share.url && (
                      <div className="mt-auto border border-dashed border-surface-100 rounded-xl p-3 text-xs mb-4 flex items-center justify-between gap-4">
                        <span className="truncate text-surface-400 font-medium">Link: {share.url}</span>
                        <a
                          href={share.url?.startsWith('http') ? share.url : `https://${share.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-secondary-600 font-bold hover:underline flex items-center gap-1"
                        >
                          Visit <ExternalLink size={12} />
                        </a>
                      </div>
                    )}

                    {/* Footer Info / Action */}
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-surface-50">
                      <span className="text-xs font-bold text-secondary-650 flex items-center gap-1">
                        <Users size={14} />
                        {subCount} {subCount === 1 ? 'Submission' : 'Submissions'}
                      </span>
                      <button
                        onClick={() => handleDeleteShare(share.id)}
                        className="text-surface-400 hover:text-danger-600 p-1.5 rounded-lg hover:bg-danger-50 transition-colors cursor-pointer"
                        title="Delete Resource"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : submissions.length === 0 ? (
        <Card className="text-center py-16">
          <div className="text-5xl mb-4">🏆</div>
          <h3 className="text-lg font-bold text-surface-800">No submissions yet</h3>
          <p className="text-sm text-surface-500 mt-1 max-w-sm mx-auto">
            When students complete activities or submit document comments, their results will appear here.
          </p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden border-surface-150">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-surface-100 text-xs font-black uppercase text-surface-450 tracking-wider">
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Material Title</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Submission / Result</th>
                  <th className="px-6 py-4">Submitted Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50 text-sm">
                {submissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-surface-850">
                      {sub.student?.full_name || 'Student'}
                      <span className="block text-xs text-surface-400 font-semibold mt-0.5">
                        @{sub.student?.username || 'username'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-surface-800">
                      {sub.share?.title || 'Shared Resource'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold uppercase tracking-wider bg-slate-100 border border-slate-205 text-slate-650 px-2 py-0.5 rounded-full">
                        {sub.share?.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      {sub.share?.type === 'activity' ? (
                        <div className="flex items-center gap-1.5 text-green-700 font-black text-xs bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg w-fit">
                          <CheckCircle size={13} className="text-green-500" />
                          Played &bull; Score: {sub.score}
                        </div>
                      ) : (
                        <div className="text-surface-600 bg-surface-50 p-2.5 rounded-xl border border-surface-100 italic text-xs leading-relaxed break-words">
                          "{sub.submission_content}"
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-surface-400">
                      {new Date(sub.completed_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Share New Resource Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Share Resource with Classroom 🎒"
        >
          <div className="space-y-4 py-2">
            {/* Share Type Selector */}
            <div className="grid grid-cols-3 gap-2 p-1.5 bg-surface-100 rounded-xl border border-surface-200">
              {(['activity', 'document', 'link'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setShareType(type)}
                  className={`
                    py-2 text-xs font-bold rounded-lg capitalize transition-all cursor-pointer
                    ${
                      shareType === type
                        ? 'bg-white text-secondary-700 shadow-sm'
                        : 'text-surface-500 hover:text-surface-800'
                    }
                  `}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-surface-500 uppercase tracking-wide mb-1.5">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  shareType === 'activity'
                    ? 'e.g. Science Chapter 3 Activity'
                    : shareType === 'document'
                    ? 'e.g. Class 5 Mathematics Worksheet'
                    : 'e.g. Reference Video for History Chapter 2'
                }
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all bg-surface-50/50"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-surface-500 uppercase tracking-wide mb-1.5">
                Description / Instructions
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Give details or instructions to students..."
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all resize-none bg-surface-50/50"
              />
            </div>



            {/* Type Specific Fields */}
            {shareType === 'activity' ? (
              <Select
                label="Select Game Type"
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                options={[
                  { value: 'quiz', label: 'Quiz' },
                  { value: 'flashcard', label: 'Flashcards' },
                  { value: 'matching', label: 'Matching Game' },
                  { value: 'picture', label: 'Picture Game' },
                ]}
              />
            ) : (
              <div>
                <label className="block text-xs font-bold text-surface-500 uppercase tracking-wide mb-1.5">
                  URL / Link Address
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="e.g. docs.google.com/document/d/... or youtube.com/watch?v=..."
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all bg-surface-50/50"
                />
              </div>
            )}

            {/* Connected Students Selection */}
            <div className="border-t border-surface-100 pt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-surface-500 uppercase tracking-wide">
                  Share With Students ({selectedStudentIds.length}/{connectedStudents.length})
                </label>
                {connectedStudents.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedStudentIds.length === connectedStudents.length) {
                        setSelectedStudentIds([]);
                      } else {
                        setSelectedStudentIds(connectedStudents.map(s => s.id));
                      }
                    }}
                    className="text-xs text-secondary-650 hover:text-secondary-700 font-bold cursor-pointer"
                  >
                    {selectedStudentIds.length === connectedStudents.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
              
              {connectedStudents.length === 0 ? (
                <p className="text-xs text-surface-400 italic">
                  No connected students. Approve student connection requests in your Account page first.
                </p>
              ) : (
                <div className="max-h-36 overflow-y-auto border border-surface-200 rounded-xl p-3 bg-surface-50/50 space-y-2">
                  {connectedStudents.map((student) => {
                    const isChecked = selectedStudentIds.includes(student.id);
                    return (
                      <label
                        key={student.id}
                        className="flex items-center gap-2.5 text-sm text-surface-700 cursor-pointer select-none py-1 hover:text-surface-900"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedStudentIds(prev =>
                              prev.includes(student.id)
                                ? prev.filter(id => id !== student.id)
                                : [...prev, student.id]
                            );
                          }}
                          className="rounded text-secondary-600 focus:ring-secondary/20 border-surface-300 w-4 h-4 cursor-pointer"
                        />
                        <span className="font-semibold">{student.full_name || 'Student'}</span>
                        <span className="text-xs text-surface-400 font-normal">@{student.username || 'username'}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-4">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleShare}
                loading={saving}
              >
                Share now
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
