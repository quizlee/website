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
  FileText,
  Users,
  CheckCircle,
  ExternalLink,
  Calendar,
  Layers,
  School as SchoolIcon,
  ChevronDown,
  FileEdit,
  Monitor,
  Gamepad2,
} from 'lucide-react';

interface ClassItem {
  id: string;
  name: string;
}

export const ACTIVITY_MAP: Record<string, { label: string; emoji: string }> = {
  quiz: { label: 'Quiz Quest', emoji: '⚡' },
  flashcard: { label: 'Flash Flip', emoji: '🔄' },
  matching: { label: 'Match Mania', emoji: '🧩' },
  picture: { label: 'Pic Picasso', emoji: '🖼️' },
  dragndrop: { label: 'Drag & Drop', emoji: '📥' },
};

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
  type: 'activity' | 'document' | 'copywork' | 'practical' | 'link';
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
  status: 'completed' | 'submitted' | 'verified';
  submission_content: string | null;
  score: number | null;
  completed_at: string;
  student?: { full_name: string | null; username: string | null; avatar_url?: string | null } | null;
  share?: Share | null;
}

export default function TeacherClassActivitiesPage() {
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [shares, setShares] = useState<Share[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [viewMode, setViewMode] = useState<'shares' | 'submissions'>('shares');
  const [submissionSubTab, setSubmissionSubTab] = useState<'all' | 'activity' | 'copywork' | 'practical'>('all');
  const [selectedShareForSubmissions, setSelectedShareForSubmissions] = useState<Share | null>(null);
  const [chaptersMap, setChaptersMap] = useState<Record<string, string>>({});

  // Form / Modal state
  const [showModal, setShowModal] = useState(false);
  const [shareType, setShareType] = useState<'activity' | 'copywork' | 'practical'>('activity');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [xpReward, setXpReward] = useState<number>(50);
  const [xpPerItem, setXpPerItem] = useState<number>(10);
  const [activityType, setActivityType] = useState('quiz');
  const [bulkText, setBulkText] = useState('');
  const [saving, setSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const getBulkTemplate = (type: string) => {
    switch (type) {
      case 'quiz':
        return `Question: What is 2 + 2?\nOptions: 3 | 4 | 5 | 6\nAnswer: 1\nHint: Think simple!\nExplanation: Basic arithmetic.\n---\nQuestion: What is the capital of France?\nOptions: London | Berlin | Paris | Rome\nAnswer: 2`;
      case 'flashcard':
        return `Front: Newton's First Law\nBack: An object at rest remains at rest unless acted upon by a net force.\n---\nFront: Speed of Light\nBack: Approximately 300,000 km/s.`;
      case 'matching':
        return `Pairs: H2O = Water | CO2 = Carbon Dioxide | O2 = Oxygen`;
      case 'picture':
        return `URL: https://images.unsplash.com/photo-1546182990-dffeafbe841d\nQuestion: Which animal is this?\nOptions: Cat | Lion | Tiger | Dog\nAnswer: 1`;
      case 'dragndrop':
        return `Sentence: The solar system has __BLANK__ planets, and the largest one is __BLANK__.\nAnswers: eight | Jupiter\n---\nSentence: The __BLANK__ is the powerhouse of the cell.\nAnswers: mitochondria`;
      default:
        return '';
    }
  };

  const parseActivityBulkText = (text: string, type: string) => {
    if (!text.trim()) return { parsed: [], errors: [] };

    const errors: { line: number; message: string }[] = [];
    const parsed: any[] = [];
    const items = text.split(/\n---\n/);

    items.forEach((item, itemIdx) => {
      const lines = item.trim().split('\n');
      const data: Record<string, string> = {};

      lines.forEach((line) => {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const key = line.substring(0, colonIdx).trim().toLowerCase();
          const val = line.substring(colonIdx + 1).trim();
          data[key] = val;
        }
      });

      if (type === 'quiz') {
        const question = data['question'];
        const optionsStr = data['options'];
        const answerStr = data['answer'];
        const hint = data['hint'];
        const explanation = data['explanation'];

        if (!question) errors.push({ line: itemIdx + 1, message: 'Missing "Question:"' });
        if (!optionsStr) errors.push({ line: itemIdx + 1, message: 'Missing "Options:" (separated by |)' });
        if (!answerStr) errors.push({ line: itemIdx + 1, message: 'Missing "Answer:"' });

        if (question && optionsStr && answerStr) {
          const options = optionsStr.split('|').map((o) => o.trim());
          let correct_answer = parseInt(answerStr);
          if (isNaN(correct_answer)) {
            const idx = options.findIndex((o) => o.toLowerCase() === answerStr.toLowerCase());
            if (idx !== -1) correct_answer = idx;
          }
          if (isNaN(correct_answer) || correct_answer < 0 || correct_answer >= options.length) {
            errors.push({ line: itemIdx + 1, message: `Answer must be index 0..${options.length - 1} or matching option text` });
          } else {
            parsed.push({ question, options, correct_answer, hint, explanation });
          }
        }
      } else if (type === 'flashcard') {
        const front = data['front'];
        const back = data['back'];
        if (!front) errors.push({ line: itemIdx + 1, message: 'Missing "Front:"' });
        if (!back) errors.push({ line: itemIdx + 1, message: 'Missing "Back:"' });
        if (front && back) {
          parsed.push({ front, back });
        }
      } else if (type === 'matching') {
        const pairsStr = data['pairs'];
        if (!pairsStr) {
          errors.push({ line: itemIdx + 1, message: 'Missing "Pairs:" (e.g. A = B | C = D)' });
        } else {
          const pairsList = pairsStr.split('|').map((p) => {
            const parts = p.split('=').map((x) => x.trim());
            return { left: parts[0] || '', right: parts[1] || '' };
          });
          if (pairsList.some((p) => !p.left || !p.right)) {
            errors.push({ line: itemIdx + 1, message: 'Invalid pair format (use Left = Right)' });
          } else {
            parsed.push({ pairs: pairsList });
          }
        }
      } else if (type === 'picture') {
        const imgUrl = data['url'];
        const question = data['question'];
        const optionsStr = data['options'];
        const answerStr = data['answer'];

        if (!imgUrl) errors.push({ line: itemIdx + 1, message: 'Missing "URL:"' });
        if (!question) errors.push({ line: itemIdx + 1, message: 'Missing "Question:"' });
        if (!optionsStr) errors.push({ line: itemIdx + 1, message: 'Missing "Options:"' });
        if (!answerStr) errors.push({ line: itemIdx + 1, message: 'Missing "Answer:"' });

        if (imgUrl && question && optionsStr && answerStr) {
          const options = optionsStr.split('|').map((o) => o.trim());
          let correct_answer = parseInt(answerStr);
          if (isNaN(correct_answer)) {
            const idx = options.findIndex((o) => o.toLowerCase() === answerStr.toLowerCase());
            if (idx !== -1) correct_answer = idx;
          }
          if (isNaN(correct_answer) || correct_answer < 0 || correct_answer >= options.length) {
            errors.push({ line: itemIdx + 1, message: `Answer must be index 0..${options.length - 1} or option text` });
          } else {
            parsed.push({ image_url: imgUrl, question, options, correct_answer });
          }
        }
      } else if (type === 'dragndrop') {
        const sentence = data['sentence'];
        const answersStr = data['answers'];

        if (!sentence) errors.push({ line: itemIdx + 1, message: 'Missing "Sentence:"' });
        if (!answersStr) errors.push({ line: itemIdx + 1, message: 'Missing "Answers:"' });

        if (sentence && answersStr) {
          const answersList = answersStr.split('|').map((a) => a.trim());
          const blankCount = (sentence.match(/__BLANK__/g) || []).length;
          if (blankCount === 0) {
            errors.push({ line: itemIdx + 1, message: 'Sentence must contain at least one "__BLANK__" placeholder' });
          }
          if (blankCount !== answersList.length) {
            errors.push({
              line: itemIdx + 1,
              message: `Number of "__BLANK__" placeholders (${blankCount}) does not match answers (${answersList.length})`
            });
          } else {
            parsed.push({ sentence, answers: answersList });
          }
        }
      }
    });

    return { parsed, errors };
  };

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
      .order('created_at')
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
      // 0. Fetch chapters for multi-chapter name resolving
      const { data: allChData } = await supabase.from('chapters').select('id, name');
      if (allChData) {
        const cMap: Record<string, string> = {};
        allChData.forEach((c) => { cMap[c.id] = c.name; });
        setChaptersMap(cMap);
      }

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
          student:profiles!student_share_submissions_student_id_fkey(full_name, username, avatar_url),
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

  async function handleVerifySubmission(sub: Submission, xpAmount: number) {
    if (!sub.student_id) return;
    setVerifyingId(sub.id);
    try {
      // Execute SECURITY DEFINER RPC function to update status & award XP atomically
      const { error: rpcErr } = await supabase.rpc('verify_share_submission', {
        p_submission_id: sub.id,
        p_xp_amount: xpAmount,
      });

      if (rpcErr) {
        console.warn('RPC verify_share_submission error, falling back to direct update:', rpcErr);

        const { error: subErr } = await supabase
          .from('student_share_submissions')
          .update({ status: 'verified' })
          .eq('id', sub.id);

        if (subErr) throw subErr;

        const { data: studentProf } = await supabase
          .from('profiles')
          .select('points')
          .eq('id', sub.student_id)
          .maybeSingle();

        const currentPoints = studentProf?.points || 0;
        const newPoints = currentPoints + xpAmount;

        await supabase
          .from('profiles')
          .update({ points: newPoints })
          .eq('id', sub.student_id);
      }

      const studentName = sub.student?.full_name || sub.student?.username || 'Student';
      toast(`Verified! Awarded ${xpAmount} XP to ${studentName}! 🌟`, 'success');

      // Send instant real-time broadcast notification to student devices
      try {
        const realtimeChannel = supabase.channel('quizlee-realtime-classroom-broadcast');
        await realtimeChannel.subscribe();
        await realtimeChannel.send({
          type: 'broadcast',
          event: 'submission_verified',
          payload: {
            submission_id: sub.id,
            student_id: sub.student_id,
            share_id: sub.share_id,
            xp_amount: xpAmount,
          },
        });
      } catch (bcErr) {
        console.warn('Realtime verification broadcast warning:', bcErr);
      }

      try {
        const bc = new BroadcastChannel('quizlee_classroom_updates');
        bc.postMessage({ type: 'SUBMISSION_UPDATED', student_id: sub.student_id, timestamp: Date.now() });
        bc.close();
      } catch {}
      localStorage.setItem('quizlee_classroom_sync', Date.now().toString());

      // Update local state
      setSubmissions((prev) =>
        prev.map((s) => (s.id === sub.id ? { ...s, status: 'verified' } : s))
      );
      window.dispatchEvent(new Event('classroom_activity_updated'));
    } catch (err: any) {
      console.error('Error verifying submission:', err);
      toast(err.message || 'Failed to verify submission', 'error');
    } finally {
      setVerifyingId(null);
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
      let shareUrl: string | null = null;

      if (shareType !== 'activity') {
        shareUrl = url.trim();
      } else if (bulkText.trim()) {
        const { parsed, errors } = parseActivityBulkText(bulkText, activityType);
        if (errors.length > 0) {
          toast(`Bulk text has ${errors.length} formatting error(s). Please fix before sharing.`, 'error');
          setSaving(false);
          return;
        }
        if (parsed.length > 0) {
          const targetChapter = filterChapterIds[0] || null;
          const inserts = parsed.map((payload) => ({
            chapter_id: targetChapter,
            activity_type: activityType,
            payload,
            created_by: profile!.id,
          }));

          const { data: insertedRows, error: contentErr } = await supabase
            .from('content')
            .insert(inserts)
            .select('id');

          if (contentErr) throw contentErr;

          if (insertedRows && insertedRows.length > 0) {
            const contentIds = insertedRows.map((r) => r.id);
            shareUrl = `content_ids:${contentIds.join(',')}`;
          }
        }
      }

      const shareData = {
        teacher_id: profile!.id,
        title: title.trim(),
        description: JSON.stringify({
          xp: shareType !== 'activity' ? (Number(xpReward) || 50) : undefined,
          xp_per_item: shareType === 'activity' ? (Number(xpPerItem) || 10) : undefined,
          chapter_ids: filterChapterIds.length > 0 ? filterChapterIds : undefined,
        }),
        type: shareType,
        url: shareUrl,
        class_id: filterClass || null,
        subject_id: filterSubject || null,
        chapter_id: filterChapterIds[0] || null,
        activity_type: shareType === 'activity' ? activityType : null,
        student_ids: selectedStudentIds,
      };
      const { data: insertedShares, error } = await supabase.from('teacher_shares').insert(shareData).select();
      if (error) throw error;
      window.dispatchEvent(new Event('classroom_activity_updated'));

      // Send instant real-time broadcast notification to all connected student devices
      try {
        const teacherName = profile?.full_name || profile?.username || 'Your Teacher';
        const realtimeChannel = supabase.channel('quizlee-realtime-classroom-broadcast');
        await realtimeChannel.subscribe();
        await realtimeChannel.send({
          type: 'broadcast',
          event: 'material_shared',
          payload: {
            share_id: insertedShares?.[0]?.id || Date.now().toString(),
            teacher_id: profile?.id,
            teacher_name: teacherName,
            title: title.trim(),
            type: shareType,
            class_id: filterClass || null,
            subject_id: filterSubject || null,
            student_ids: selectedStudentIds || [],
            created_at: new Date().toISOString(),
          },
        });
      } catch (bcErr) {
        console.warn('Realtime broadcast warning:', bcErr);
      }

      try {
        const bc = new BroadcastChannel('quizlee_classroom_updates');
        bc.postMessage({ type: 'MATERIAL_SHARED', timestamp: Date.now() });
        bc.close();
      } catch {}
      localStorage.setItem('quizlee_classroom_sync', Date.now().toString());
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
    setUrl('');
    setXpReward(50);
    setXpPerItem(10);
    setBulkText('');
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

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
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
                    : filterChapterIds.length === filterChapters.length
                    ? 'All Chapters Selected'
                    : (() => {
                        const selectedCodes = filterChapters
                          .map((ch, idx) => (filterChapterIds.includes(ch.id) ? `C${idx + 1}` : null))
                          .filter(Boolean);
                        return selectedCodes.length <= 4
                          ? `Selected: ${selectedCodes.join(', ')}`
                          : `${selectedCodes.length} Chapters (${selectedCodes.slice(0, 3).join(', ')}...)`;
                      })()}
                </span>
                <ChevronDown size={14} className="text-surface-450 shrink-0" />
              </button>

              {filterChapterDropdownOpen && filterSubject && (
                <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-surface-200 rounded-xl shadow-lg z-50 p-2 space-y-1">
                  {filterChapters.map((ch, idx) => {
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
                        <span className="shrink-0 text-[10px] font-extrabold bg-secondary-100 text-secondary-800 px-1.5 py-0.5 rounded border border-secondary-200">
                          C{idx + 1}
                        </span>
                        <span className="truncate">{ch.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Share Resource Button */}
            <div>
              <label className="block text-[10px] font-bold text-surface-500 uppercase tracking-wide mb-1 opacity-0 hidden sm:block select-none">
                &nbsp;
              </label>
              <Button
                variant="primary"
                size="sm"
                className="w-full py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                icon={<Plus size={15} />}
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
              >
                Share Resource
              </Button>
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
              const cardTheme = {
                activity: {
                  border: 'border-primary-200/80 hover:border-primary-300',
                  iconBg: 'bg-gradient-to-br from-primary-500 to-indigo-600 text-white',
                  badge: 'bg-primary-50 text-primary-700 border-primary-200',
                  label: 'Activity',
                  icon: Gamepad2,
                },
                document: {
                  border: 'border-secondary-200/80 hover:border-secondary-300',
                  iconBg: 'bg-gradient-to-br from-secondary-500 to-teal-600 text-white',
                  badge: 'bg-secondary-50 text-secondary-750 border-secondary-200',
                  label: 'Document',
                  icon: FileText,
                },
                practical: {
                  border: 'border-cyan-200/80 hover:border-cyan-300',
                  iconBg: 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white',
                  badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',
                  label: 'Practical',
                  icon: Monitor,
                },
                copywork: {
                  border: 'border-amber-200/80 hover:border-amber-300',
                  iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white',
                  badge: 'bg-amber-50 text-amber-700 border-amber-200',
                  label: 'Copywork',
                  icon: FileEdit,
                },
                link: {
                  border: 'border-amber-200/80 hover:border-amber-300',
                  iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white',
                  badge: 'bg-amber-50 text-amber-700 border-amber-200',
                  label: 'Copywork',
                  icon: FileEdit,
                },
              }[share.type] || {
                border: 'border-amber-200/80 hover:border-amber-300',
                iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white',
                badge: 'bg-amber-50 text-amber-700 border-amber-200',
                label: 'Copywork',
                icon: FileEdit,
              };

              const IconComponent = cardTheme.icon;
              const subCount = submissions.filter((s) => s.share_id === share.id).length;

              return (
                <div
                  key={share.id}
                  className={`
                    group relative flex flex-col justify-between rounded-2xl sm:rounded-3xl p-4 sm:p-5 border-2 transition-all duration-200 shadow-sm hover:shadow-md bg-white
                    ${cardTheme.border}
                  `}
                >
                  <div>
                    {/* Card Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <div className={`p-1.5 sm:p-2 rounded-xl ${cardTheme.iconBg} shadow-sm shrink-0`}>
                          <IconComponent size={15} />
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${cardTheme.badge} shrink-0`}>
                            {cardTheme.label}
                          </span>
                          {share.type === 'activity' && (() => {
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
                            const totalXp = itemCount * xpPerItemVal;
                            return (
                              <span className="text-[10px] sm:text-[11px] font-extrabold text-amber-600 shrink-0">
                                ⭐ +{totalXp} XP ({xpPerItemVal} XP/item)
                              </span>
                            );
                          })()}
                          {share.type !== 'activity' && (() => {
                            let xp = 50;
                            if (share.description) {
                              try {
                                const parsed = JSON.parse(share.description);
                                if (parsed.xp !== undefined) xp = Number(parsed.xp) || 50;
                              } catch {
                                if (share.description.startsWith('XP:')) xp = Number(share.description.replace('XP:', '')) || 50;
                              }
                            }
                            return (
                              <span className="text-[10px] sm:text-[11px] font-extrabold text-amber-600 shrink-0">
                                ⭐ +{xp} XP
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-surface-400 shrink-0 ml-auto sm:ml-0">
                        <Calendar size={12} />
                        <span>{new Date(share.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Title Heading */}
                    <h3 className="text-sm sm:text-base font-extrabold text-surface-900 group-hover:text-primary transition-colors leading-snug line-clamp-2 mb-3 break-words">
                      {share.title}
                    </h3>

                    {/* Link / URL Row */}
                    {share.type !== 'activity' && share.url && (
                      <div className="mb-4 flex items-center justify-between gap-2 bg-surface-50 border border-surface-200/60 rounded-xl px-3 py-2 text-xs">
                        <span className="truncate text-surface-500 font-medium text-[11px]">{share.url}</span>
                        <a
                          href={share.url?.startsWith('http') ? share.url : `https://${share.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-secondary-600 font-extrabold hover:underline flex items-center gap-1 text-xs"
                        >
                          Visit <ExternalLink size={12} />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Footer Row */}
                  <div className="mt-auto pt-3 border-t border-surface-200/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                    {/* Submissions Pill Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedShareForSubmissions(share)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-50 hover:bg-secondary-100 active:bg-secondary-200 text-secondary-750 font-extrabold text-[11px] sm:text-xs border border-secondary-200/80 shrink-0 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                      title="Click to view students who submitted"
                    >
                      <Users size={13} className="text-secondary-600 shrink-0" />
                      <span>{subCount} {subCount === 1 ? 'Submission' : 'Submissions'}</span>
                    </button>

                    {/* Course Pills & Actions */}
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
                          chapterText = share.chapter?.name || share.subject?.name || share.class?.name || '';
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

                      <button
                        onClick={() => handleDeleteShare(share.id)}
                        className="p-1.5 text-surface-400 hover:text-danger-600 rounded-lg hover:bg-danger-50 transition-colors cursor-pointer ml-1"
                        title="Delete Resource"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
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
        <div className="space-y-4">
          {/* Submissions Type Sub-Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-surface-100/90 rounded-2xl border border-surface-200 overflow-x-auto">
            {[
              { id: 'all', label: 'All Submissions', emoji: '📋', count: submissions.length },
              { id: 'activity', label: 'Activity', emoji: '🎮', count: submissions.filter(s => s.share?.type === 'activity').length },
              { id: 'copywork', label: 'Copywork', emoji: '✍️', count: submissions.filter(s => s.share?.type === 'copywork' || s.share?.type === 'link').length },
              { id: 'practical', label: 'Practical', emoji: '💻', count: submissions.filter(s => s.share?.type === 'practical').length },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubmissionSubTab(tab.id as any)}
                className={`
                  px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 flex items-center gap-2 shrink-0 cursor-pointer
                  ${
                    submissionSubTab === tab.id
                      ? 'bg-white text-surface-900 shadow-xs'
                      : 'text-surface-500 hover:text-surface-800'
                  }
                `}
              >
                <span>{tab.emoji} {tab.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  submissionSubTab === tab.id
                    ? 'bg-secondary-100 text-secondary-800'
                    : 'bg-surface-200 text-surface-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Filtered Submissions Card List */}
          {(() => {
            const filteredSubmissions = submissions.filter((sub) => {
              const sType = sub.share?.type;
              if (submissionSubTab === 'activity') return sType === 'activity';
              if (submissionSubTab === 'copywork') return sType === 'copywork' || sType === 'link';
              if (submissionSubTab === 'practical') return sType === 'practical';
              return true;
            });

            if (filteredSubmissions.length === 0) {
              return (
                <Card className="text-center py-16">
                  <div className="text-4xl mb-3">
                    {submissionSubTab === 'activity' ? '🎮' : submissionSubTab === 'copywork' ? '✍️' : submissionSubTab === 'practical' ? '💻' : '🏆'}
                  </div>
                  <h3 className="text-base font-extrabold text-surface-800 capitalize">
                    No {submissionSubTab === 'all' ? '' : submissionSubTab} submissions yet
                  </h3>
                  <p className="text-xs text-surface-400 mt-1 max-w-sm mx-auto font-medium">
                    When students complete or submit {submissionSubTab === 'all' ? 'materials' : submissionSubTab + ' resources'}, their results will appear here.
                  </p>
                </Card>
              );
            }

            return (
              <div className="space-y-3">
                {filteredSubmissions.map((sub) => {
                  const sh = sub.share;
                  const typeTheme =
                    sh?.type === 'activity'
                      ? { label: 'Activity', textClass: 'text-indigo-600', icon: '🎮' }
                      : sh?.type === 'practical'
                      ? { label: 'Practical', textClass: 'text-cyan-600', icon: '💻' }
                      : { label: 'Copywork', textClass: 'text-amber-600', icon: '✍️' };

                  let xpPerItemVal = 10;
                  let xpRewardVal = 50;
                  if (sh?.description) {
                    try {
                      const parsed = JSON.parse(sh.description);
                      if (parsed.xp_per_item !== undefined) xpPerItemVal = Number(parsed.xp_per_item) || 10;
                      if (parsed.xp !== undefined) xpRewardVal = Number(parsed.xp) || 50;
                    } catch {
                      // fallback
                    }
                  }

                  let earnedXp = xpRewardVal;
                  let scorePct: number | null = null;

                  if (sh?.type === 'activity') {
                    let itemCount = 10;
                    if (sh.url?.startsWith('content_ids:')) {
                      itemCount = sh.url.replace('content_ids:', '').split(',').filter(Boolean).length || 1;
                    }
                    const totalActivityXp = itemCount * xpPerItemVal;

                    if (sub.score !== null && sub.score !== undefined) {
                      if (sub.score <= itemCount && itemCount > 0) {
                        scorePct = Math.round((sub.score / itemCount) * 100);
                      } else {
                        scorePct = Math.min(100, Math.max(0, sub.score));
                      }
                      earnedXp = Math.round((totalActivityXp * scorePct) / 100);
                    } else {
                      earnedXp = totalActivityXp;
                    }
                  }

                  const studentName = sub.student?.full_name || 'Student';
                  const avatarUrl = sub.student?.avatar_url;
                  const isActivity = sh?.type === 'activity';
                  const isVerified = sub.status === 'verified';

                  return (
                    <div
                      key={sub.id}
                      className="relative p-4 sm:p-5 pr-28 sm:pr-72 min-h-[96px] rounded-2xl bg-white border border-surface-200/80 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-center gap-1"
                    >
                      {/* Top Right Header: Datetime & Card Type (no border, no fillcolor) */}
                      <div className="absolute top-3.5 right-4 flex items-center gap-3">
                        <span className="text-[11px] font-semibold text-surface-400 flex items-center gap-1">
                          <Calendar size={12} className="text-surface-400 shrink-0" />
                          <span>
                            {new Date(sub.completed_at || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(sub.completed_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </span>

                        <span className={`text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${typeTheme.textClass}`}>
                          <span>{typeTheme.icon}</span>
                          <span>{typeTheme.label}</span>
                        </span>
                      </div>

                      {/* Left: Student Avatar & Details */}
                      <div className="flex items-center gap-3 min-w-0">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={studentName}
                            className="w-10 h-10 rounded-full object-cover shrink-0 border border-surface-200 shadow-2xs"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 text-sm font-black flex items-center justify-center shrink-0 border border-emerald-200">
                            {studentName.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0 space-y-0.5">
                          <h4 className="text-sm font-extrabold text-surface-900 truncate">
                            {studentName}
                          </h4>
                          <p className="text-xs font-bold text-surface-700 truncate">
                            {sh?.title || 'Shared Resource'}
                          </p>
                        </div>
                      </div>

                      {/* Bottom Right Corner: Action Button & Score */}
                      <div className="absolute bottom-3.5 right-4 flex items-center gap-2">
                        {scorePct !== null && (
                          <span className="text-xs font-extrabold text-surface-600 bg-surface-100 px-2 py-0.5 rounded-md border border-surface-200">
                            Score: {scorePct}%
                          </span>
                        )}

                        <div>
                          {isActivity ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 font-extrabold text-xs border border-emerald-200 shadow-2xs">
                              <CheckCircle size={14} className="text-emerald-600 shrink-0" />
                              <span>Completed (+{earnedXp} XP)</span>
                            </div>
                          ) : isVerified ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 font-extrabold text-xs border border-emerald-200 shadow-2xs">
                              <CheckCircle size={14} className="text-emerald-600 shrink-0" />
                              <span>Verified (+{earnedXp} XP)</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleVerifySubmission(sub, earnedXp)}
                              disabled={verifyingId === sub.id}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                            >
                              {verifyingId === sub.id ? (
                                <Spinner size="sm" />
                              ) : (
                                <>
                                  <CheckCircle size={14} />
                                  Verify & Award {earnedXp} XP
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Share New Resource Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Share Resource with Classroom 🎒"
          size="lg"
        >
          <div className="space-y-4 py-2">
            {/* Share Type Selector */}
            <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-surface-100 rounded-xl border border-surface-200">
              {[
                { id: 'activity', label: '⚡ Activity' },
                { id: 'copywork', label: '✍️ Copywork' },
                { id: 'practical', label: '🔬 Practical' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setShareType(tab.id as any)}
                  className={`
                    py-2 px-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer text-center truncate
                    ${
                      shareType === tab.id
                        ? 'bg-white text-secondary-700 shadow-sm'
                        : 'text-surface-500 hover:text-surface-800'
                    }
                  `}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Side-by-Side First Three Inputs Grid Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Input 1: Title */}
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
                      ? 'e.g. Science Ch 3 Activity'
                      : shareType === 'copywork'
                      ? 'e.g. Handwriting Copywork'
                      : 'e.g. Science Experiment'
                  }
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-surface-200 focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all bg-surface-50/50"
                />
              </div>

              {/* Input 2: Select Game Activity OR URL Address */}
              {shareType === 'activity' ? (
                <Select
                  label="Select Game Activity"
                  value={activityType}
                  onChange={(e) => {
                    setActivityType(e.target.value);
                  }}
                  options={[
                    { value: 'quiz', label: '⚡ Quiz Quest' },
                    { value: 'flashcard', label: '🔄 Flash Flip' },
                    { value: 'matching', label: '🧩 Match Mania' },
                    { value: 'picture', label: '🖼️ Pic Picasso' },
                    { value: 'dragndrop', label: '📥 Drag & Drop' },
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
                    placeholder="e.g. docs.google.com/... or drive.google.com/..."
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-surface-200 focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all bg-surface-50/50"
                  />
                </div>
              )}

              {/* Input 3: XP per Item / Question OR XP Reward */}
              {shareType === 'activity' ? (
                <div>
                  <label className="block text-xs font-bold text-surface-500 uppercase tracking-wide mb-1.5">
                    XP per Item / Question
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={xpPerItem}
                      onChange={(e) => setXpPerItem(Math.max(1, parseInt(e.target.value) || 1))}
                      placeholder="e.g. 10"
                      className="w-full pl-9 pr-3 py-2.5 text-sm font-extrabold text-surface-900 rounded-xl border border-surface-200 focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all bg-surface-50/50"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">⭐</span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-surface-500 uppercase tracking-wide mb-1.5">
                    XP Reward for Completion
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={5}
                      max={1000}
                      step={5}
                      value={xpReward}
                      onChange={(e) => setXpReward(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="e.g. 50"
                      className="w-full pl-9 pr-3 py-2.5 text-sm font-extrabold text-surface-900 rounded-xl border border-surface-200 focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all bg-surface-50/50"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">⭐</span>
                  </div>
                </div>
              )}
            </div>

            {/* Additional Fields: Bulk Content Import for Activity */}
            {shareType === 'activity' && (
              <div className="bg-surface-50 border border-surface-200 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-surface-800">
                    <FileText size={15} className="text-secondary-600" />
                    <span>Bulk Activity Content (Text)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBulkText(getBulkTemplate(activityType))}
                    className="text-[11px] font-bold text-secondary-650 hover:text-secondary-800 bg-secondary-50 hover:bg-secondary-100 px-2.5 py-1 rounded-lg border border-secondary-200/60 transition-colors cursor-pointer"
                  >
                    Load Sample Template
                  </button>
                </div>

                <textarea
                  rows={6}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`Paste or type activity content in text format...\nClick "Load Sample Template" above to see an example.`}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-surface-200 focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all bg-white leading-relaxed resize-y"
                />

                {/* Live Validation Feedback */}
                {bulkText.trim() && (() => {
                  const { parsed, errors } = parseActivityBulkText(bulkText, activityType);
                  if (errors.length > 0) {
                    return (
                      <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-xs text-rose-700 space-y-1">
                        <p className="font-bold flex items-center gap-1">
                          <span>⚠️</span> {errors.length} formatting error(s) found:
                        </p>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                          {errors.slice(0, 3).map((err, idx) => (
                            <li key={idx}>Line {err.line}: {err.message}</li>
                          ))}
                          {errors.length > 3 && (
                            <li>...and {errors.length - 3} more error(s)</li>
                          )}
                        </ul>
                      </div>
                    );
                  } else if (parsed.length > 0) {
                    return (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 text-xs font-semibold text-emerald-700 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <CheckCircle size={14} className="text-emerald-600" />
                          {parsed.length} item(s) ready to share!
                        </span>
                        <span className="text-[10px] bg-emerald-100 px-2 py-0.5 rounded text-emerald-800 font-bold">
                          Students will play these items only
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
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

      {/* Modal: Submissions List for Selected Share */}
      {selectedShareForSubmissions && (
        <Modal
          isOpen={!!selectedShareForSubmissions}
          onClose={() => setSelectedShareForSubmissions(null)}
          title={`Submissions: ${selectedShareForSubmissions.title}`}
          size="lg"
        >
          <div className="space-y-4">
            {/* Share Header Info */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-surface-50 rounded-2xl border border-surface-200/70">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-secondary-700 bg-secondary-50 px-2.5 py-0.5 rounded-md border border-secondary-200 uppercase tracking-wider">
                  {selectedShareForSubmissions.type}
                </span>
                {selectedShareForSubmissions.chapter?.name && (
                  <span className="text-xs font-bold text-surface-700">
                    📁 {selectedShareForSubmissions.chapter.name}
                  </span>
                )}
              </div>
              <span className="text-xs font-extrabold text-secondary-800 bg-white px-3 py-1 rounded-full border border-secondary-200 shadow-2xs">
                {submissions.filter(s => s.share_id === selectedShareForSubmissions.id).length} Submissions
              </span>
            </div>

            {/* Submissions List */}
            {(() => {
              const shareSubs = submissions.filter(s => s.share_id === selectedShareForSubmissions.id);
              if (shareSubs.length === 0) {
                return (
                  <div className="text-center py-12 text-surface-400 space-y-2">
                    <Users size={40} className="mx-auto text-surface-300" />
                    <p className="text-base font-extrabold text-surface-700">No student submissions yet</p>
                    <p className="text-xs text-surface-400 max-w-xs mx-auto">
                      When students complete this activity or view materials, their submission will appear here.
                    </p>
                  </div>
                );
              }

              return (
                <div className="divide-y divide-surface-100 border border-surface-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  {shareSubs.map((sub) => {
                    const studentName = sub.student?.full_name || sub.student?.username || 'Student';
                    const avatarUrl = sub.student?.avatar_url;
                    return (
                      <div key={sub.id} className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-surface-50/60 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt={studentName} className="w-9 h-9 rounded-full object-cover shrink-0 border border-surface-200 shadow-2xs" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center shrink-0 border border-emerald-200">
                              {studentName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="text-sm font-extrabold text-surface-900 truncate">{studentName}</h4>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-right">
                          <div className="flex flex-col items-end gap-1">
                            {(() => {
                              let xpPerItemVal = 10;
                              let xpRewardVal = 50;
                              if (selectedShareForSubmissions.description) {
                                try {
                                  const parsed = JSON.parse(selectedShareForSubmissions.description);
                                  if (parsed.xp_per_item !== undefined) xpPerItemVal = Number(parsed.xp_per_item) || 10;
                                  if (parsed.xp !== undefined) xpRewardVal = Number(parsed.xp) || 50;
                                } catch {
                                  // fallback
                                }
                              }

                              let earnedXp = xpRewardVal;
                              let scorePct: number | null = null;

                              if (selectedShareForSubmissions.type === 'activity') {
                                let itemCount = 10;
                                if (selectedShareForSubmissions.url?.startsWith('content_ids:')) {
                                  itemCount = selectedShareForSubmissions.url.replace('content_ids:', '').split(',').filter(Boolean).length || 1;
                                }
                                const totalActivityXp = itemCount * xpPerItemVal;

                                if (sub.score !== null && sub.score !== undefined) {
                                  if (sub.score <= itemCount && itemCount > 0) {
                                    scorePct = Math.round((sub.score / itemCount) * 100);
                                  } else {
                                    scorePct = Math.min(100, Math.max(0, sub.score));
                                  }
                                  earnedXp = Math.round((totalActivityXp * scorePct) / 100);
                                } else {
                                  earnedXp = totalActivityXp;
                                }
                              }

                              return (
                                <>
                                  {selectedShareForSubmissions.type === 'activity' ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shadow-2xs">
                                      <CheckCircle size={13} className="text-emerald-600" />
                                      Completed (+{earnedXp} XP)
                                    </span>
                                  ) : sub.status === 'verified' ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shadow-2xs">
                                      <CheckCircle size={13} className="text-emerald-600" />
                                      Verified (+{earnedXp} XP)
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleVerifySubmission(sub, earnedXp)}
                                      disabled={verifyingId === sub.id}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                                    >
                                      {verifyingId === sub.id ? (
                                        <Spinner size="sm" />
                                      ) : (
                                        <>
                                          <CheckCircle size={14} />
                                          Verify & Award {earnedXp} XP
                                        </>
                                      )}
                                    </button>
                                  )}
                                  {scorePct !== null && (
                                    <span className="text-[10px] font-bold text-surface-500">
                                      Score: {scorePct}%
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary-50 text-secondary-750 font-extrabold text-[10px] sm:text-[11px] border border-secondary-200/70 mt-1">
                              <Calendar size={11} className="text-secondary-600 shrink-0" />
                              <span>
                                {new Date(sub.completed_at || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(sub.completed_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </Modal>
      )}
    </div>
  );
}
