import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/Toast';
import { useAuthStore } from '../../stores/authStore';
import type { Content, School, Class, Subject, Chapter, Activity, ActivityType, ContentPayload } from '../../lib/types';
import { Trash2, Edit, Play, BookOpen, School as SchoolIcon, Plus, Lock, Unlock, Eye, EyeOff, Upload, FileText, CheckCircle2, AlertCircle, ListFilter } from 'lucide-react';

interface ValidationError {
  line: number;
  message: string;
}

export default function ContentOversightPage() {
  const { profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'content' | 'import'>('content');

  const [contentList, setContentList] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Bulk import states
  const [importActivityType, setImportActivityType] = useState<ActivityType>('quiz');
  const [inputText, setInputText] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [parsedData, setParsedData] = useState<ContentPayload[]>([]);
  const [isValidated, setIsValidated] = useState(false);
  const [importing, setImporting] = useState(false);

  // Filter lists
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // Selection filters (initialized from sessionStorage to persist previous choice)
  const [selectedSchool, setSelectedSchool] = useState(sessionStorage.getItem('oversight_filter_school') || '');
  const [selectedClass, setSelectedClass] = useState(sessionStorage.getItem('oversight_filter_class') || '');
  const [selectedSubject, setSelectedSubject] = useState(sessionStorage.getItem('oversight_filter_subject') || '');
  const [selectedChapter, setSelectedChapter] = useState(sessionStorage.getItem('oversight_filter_chapter') || '');
  const [selectedType, setSelectedType] = useState(sessionStorage.getItem('oversight_filter_type') || '');
  const [activities, setActivities] = useState<Activity[]>([]);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingContent, setEditingContent] = useState<Content | null>(null);
  const [payloadText, setPayloadText] = useState('');
  const [saving, setSaving] = useState(false);

  // Inline School state management
  const [showAddSchoolForm, setShowAddSchoolForm] = useState(false);
  const [editingSchoolId, setEditingSchoolId] = useState<string | null>(null);
  const [schoolFormValue, setSchoolFormValue] = useState('');

  // Inline Class / Subject / Chapter state management
  const [showAddClassFormSchoolId, setShowAddClassFormSchoolId] = useState<string | null>(null);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [classFormValue, setClassFormValue] = useState('');

  const [showAddSubjectFormClassId, setShowAddSubjectFormClassId] = useState<string | null>(null);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [subjectFormValue, setSubjectFormValue] = useState('');

  const [showAddChapterFormSubjectId, setShowAddChapterFormSubjectId] = useState<string | null>(null);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [chapterFormValue, setChapterFormValue] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    const [clsData, schData, actData] = await Promise.all([
      supabase.from('classes').select('*').order('sort_order'),
      supabase.from('schools').select('*').order('name'),
      supabase.from('activities').select('*').eq('is_active', true).order('zone').order('sort_order'),
    ]);

    setClasses(clsData.data as Class[] || []);
    setSchools(schData.data as School[] || []);
    setActivities(actData.data as Activity[] || []);
    setInitialized(true);
  }

  // Fetch subjects when school and class are selected
  useEffect(() => {
    if (!selectedSchool || !selectedClass) {
      setSubjects([]);
      setChapters([]);
      return;
    }
    supabase
      .from('subjects')
      .select('*')
      .eq('class_id', selectedClass)
      .eq('school_id', selectedSchool)
      .order('name')
      .then(({ data }) => setSubjects(data as Subject[] || []));
  }, [selectedSchool, selectedClass]);

  // Fetch chapters when subject is selected
  useEffect(() => {
    if (!selectedSubject) {
      setChapters([]);
      return;
    }
    supabase
      .from('chapters')
      .select('*')
      .eq('subject_id', selectedSubject)
      .order('sort_order')
      .order('created_at')
      .then(({ data }) => setChapters(data as Chapter[] || []));
  }, [selectedSubject]);

  // Save selection states to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('oversight_filter_school', selectedSchool);
    sessionStorage.setItem('oversight_filter_class', selectedClass);
    sessionStorage.setItem('oversight_filter_subject', selectedSubject);
    sessionStorage.setItem('oversight_filter_chapter', selectedChapter);
    sessionStorage.setItem('oversight_filter_type', selectedType);
  }, [selectedSchool, selectedClass, selectedSubject, selectedChapter, selectedType]);

  // CRUD & Toggle Handlers for School, Class, Subject, Chapter
  async function handleDeleteItem(id: string, tab: 'schools' | 'classes' | 'subjects' | 'chapters') {
    if (!confirm('Are you sure you want to delete this? This action will cascade delete child data!')) return;

    try {
      const { error } = await supabase.from(tab).delete().eq('id', id);
      if (error) throw error;

      if (tab === 'schools') {
        setSchools((prev) => prev.filter((x) => x.id !== id));
        if (selectedSchool === id) setSelectedSchool('');
      } else if (tab === 'classes') {
        setClasses((prev) => prev.filter((x) => x.id !== id));
        if (selectedClass === id) setSelectedClass('');
      } else if (tab === 'subjects') {
        setSubjects((prev) => prev.filter((x) => x.id !== id));
        if (selectedSubject === id) setSelectedSubject('');
      } else if (tab === 'chapters') {
        setChapters((prev) => prev.filter((x) => x.id !== id));
        if (selectedChapter === id) setSelectedChapter('');
      }

      toast('Deleted successfully', 'info');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Deletion failed';
      toast(message, 'error');
    }
  }

  async function toggleChapterLock(chapterId: string, currentLockStatus: boolean) {
    try {
      const { error } = await supabase
        .from('chapters')
        .update({ is_locked: !currentLockStatus })
        .eq('id', chapterId);
      if (error) throw error;
      setChapters((prev) =>
        prev.map((c) => (c.id === chapterId ? { ...c, is_locked: !currentLockStatus } : c))
      );
      toast(currentLockStatus ? 'Chapter unlocked!' : 'Chapter locked! 🔒', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Operation failed';
      toast(message, 'error');
    }
  }

  async function toggleChapterActive(chapterId: string, currentActiveStatus: boolean) {
    try {
      const { error } = await supabase
        .from('chapters')
        .update({ is_active: !currentActiveStatus })
        .eq('id', chapterId);
      if (error) throw error;
      setChapters((prev) =>
        prev.map((c) => (c.id === chapterId ? { ...c, is_active: !currentActiveStatus } : c))
      );
      toast(currentActiveStatus ? 'Chapter deactivated!' : 'Chapter activated! ✅', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Operation failed';
      toast(message, 'error');
    }
  }

  async function addSchoolInline(name: string) {
    try {
      const { data, error } = await supabase.from('schools').insert({ name }).select().single();
      if (error) throw error;
      if (data) setSchools((prev) => [...prev, data as School]);
      toast('School added', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add school', 'error');
    }
  }

  async function updateSchoolInline(id: string, name: string) {
    try {
      const { error } = await supabase.from('schools').update({ name }).eq('id', id);
      if (error) throw error;
      setSchools((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
      toast('School updated', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update school', 'error');
    }
  }

  async function addClassInline(name: string) {
    try {
      const { data, error } = await supabase.from('classes').insert({ name }).select().single();
      if (error) throw error;
      if (data) setClasses((prev) => [...prev, data as Class]);
      toast('Class added', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add class', 'error');
    }
  }

  async function updateClassInline(id: string, name: string) {
    try {
      const { error } = await supabase.from('classes').update({ name }).eq('id', id);
      if (error) throw error;
      setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
      toast('Class updated', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update class', 'error');
    }
  }

  async function addSubjectInline(name: string, classId: string, schoolId: string) {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .insert({ name, class_id: classId, school_id: schoolId })
        .select()
        .single();
      if (error) throw error;
      if (data) setSubjects((prev) => [...prev, data as Subject]);
      toast('Subject added', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add subject', 'error');
    }
  }

  async function updateSubjectInline(id: string, name: string, classId: string, schoolId: string) {
    try {
      const { error } = await supabase
        .from('subjects')
        .update({ name, class_id: classId, school_id: schoolId })
        .eq('id', id);
      if (error) throw error;
      setSubjects((prev) =>
        prev.map((s) => (s.id === id ? { ...s, name, class_id: classId, school_id: schoolId } : s))
      );
      toast('Subject updated', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update subject', 'error');
    }
  }

  async function addChapterInline(name: string, subjectId: string) {
    try {
      const { data, error } = await supabase
        .from('chapters')
        .insert({ name, subject_id: subjectId })
        .select()
        .single();
      if (error) throw error;
      if (data) setChapters((prev) => [...prev, data as Chapter]);
      toast('Chapter added', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add chapter', 'error');
    }
  }

  async function updateChapterInline(id: string, name: string) {
    try {
      const { error } = await supabase.from('chapters').update({ name }).eq('id', id);
      if (error) throw error;
      setChapters((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
      toast('Chapter updated', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update chapter', 'error');
    }
  }

  // Bulk Import Helper Functions
  const getTemplate = (type: ActivityType) => {
    const templates: Record<string, string> = {
      quiz: `Question: What is 2 + 2?
Options: 3 | 4 | 5 | 6
Answer: 1
Hint: Think simple!
Explanation: Basic arithmetic.
---
Question: What is the capital of France?
Options: London | Berlin | Paris | Rome
Answer: 2
Hint: The Eiffel Tower is here.
Explanation: Paris is the capital.`,
      flashcard: `Front: Newton's First Law
Back: An object at rest remains at rest unless acted upon by an force.
---
Front: Speed of Light
Back: Approximately 300,000 km/s.`,
      matching: `Pairs: H2O = Water | CO2 = Carbon Dioxide | O2 = Oxygen`,
      picture: `URL: https://example.com/lion.jpg
Question: Which animal is this?
Options: Cat | Lion | Tiger | Dog
Answer: 1`,
      dragndrop: `Sentence: The solar system has __BLANK__ planets, and the largest one is __BLANK__.
Answers: eight | Jupiter
---
Sentence: Photosynthesis requires __BLANK__, water, and __BLANK__ to produce glucose.
Answers: sunlight | carbon dioxide
---
Sentence: The __BLANK__ is the powerhouse of the cell.
Answers: mitochondria`
    };
    return templates[type] || `// Template for ${type} not available. Put your raw contents here.`;
  };

  useEffect(() => {
    if (!inputText) {
      setInputText(getTemplate(importActivityType));
    }
  }, [importActivityType]);

  const handleImportTypeChange = (type: ActivityType) => {
    setImportActivityType(type);
    setInputText(getTemplate(type));
    setValidationErrors([]);
    setParsedData([]);
    setIsValidated(false);
  };

  const validateAndParse = () => {
    const errors: ValidationError[] = [];
    const parsed: ContentPayload[] = [];
    const items = inputText.split(/\n---\n/);

    if (!inputText.trim()) {
      toast('Please enter some content to import', 'warning');
      return;
    }

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

      const lineNum = itemIdx + 1;

      if (importActivityType === 'quiz') {
        if (!data.question) {
          errors.push({ line: lineNum, message: 'Missing "Question:" field' });
        }
        if (!data.options) {
          errors.push({ line: lineNum, message: 'Missing "Options:" field' });
        } else {
          const opts = data.options.split('|').map((o) => o.trim());
          if (opts.length < 2) {
            errors.push({ line: lineNum, message: 'Options must have at least 2 items separated by "|"' });
          }
          if (data.answer) {
            const ansIdx = parseInt(data.answer, 10);
            if (isNaN(ansIdx) || ansIdx < 0 || ansIdx >= opts.length) {
              errors.push({
                line: lineNum,
                message: `Answer index "${data.answer}" must be between 0 and ${opts.length - 1}`,
              });
            }
          }
        }
        if (!data.answer) {
          errors.push({ line: lineNum, message: 'Missing "Answer:" field (index of correct option)' });
        }

        if (errors.length === 0) {
          parsed.push({
            question: data.question,
            options: data.options.split('|').map((o) => o.trim()),
            correct_answer: parseInt(data.answer, 10),
            hint: data.hint || undefined,
            explanation: data.explanation || undefined,
          } as any);
        }
      } else if (importActivityType === 'flashcard') {
        if (!data.front) {
          errors.push({ line: lineNum, message: 'Missing "Front:" side content' });
        }
        if (!data.back) {
          errors.push({ line: lineNum, message: 'Missing "Back:" side content' });
        }

        if (errors.length === 0) {
          parsed.push({
            front: data.front,
            back: data.back,
          } as any);
        }
      } else if (importActivityType === 'matching') {
        if (!data.pairs) {
          errors.push({ line: lineNum, message: 'Missing "Pairs:" field' });
        } else {
          const pairsList = data.pairs.split('|').map((p) => p.trim());
          const structuredPairs: Array<{ left: string; right: string }> = [];

          pairsList.forEach((pair) => {
            const eqIdx = pair.indexOf('=');
            if (eqIdx === -1) {
              errors.push({ line: lineNum, message: `Invalid pair format "${pair}". Must be "Left = Right"` });
            } else {
              structuredPairs.push({
                left: pair.substring(0, eqIdx).trim(),
                right: pair.substring(eqIdx + 1).trim(),
              });
            }
          });

          if (errors.length === 0) {
            parsed.push({
              pairs: structuredPairs,
            } as any);
          }
        }
      } else if (importActivityType === 'picture') {
        if (!data.url) {
          errors.push({ line: lineNum, message: 'Missing "URL:" field' });
        }
        if (!data.question) {
          errors.push({ line: lineNum, message: 'Missing "Question:" field' });
        }
        if (!data.options) {
          errors.push({ line: lineNum, message: 'Missing "Options:" field' });
        } else {
          const opts = data.options.split('|').map((o) => o.trim());
          if (opts.length < 2) {
            errors.push({ line: lineNum, message: 'Options must have at least 2 items separated by "|"' });
          }
          if (data.answer) {
            const ansIdx = parseInt(data.answer, 10);
            if (isNaN(ansIdx) || ansIdx < 0 || ansIdx >= opts.length) {
              errors.push({
                line: lineNum,
                message: `Answer index "${data.answer}" must be between 0 and ${opts.length - 1}`,
              });
            }
          }
        }
        if (!data.answer) {
          errors.push({ line: lineNum, message: 'Missing "Answer:" index' });
        }

        if (errors.length === 0) {
          parsed.push({
            image_url: data.url,
            question: data.question,
            options: data.options.split('|').map((o) => o.trim()),
            correct_answer: parseInt(data.answer, 10),
            hint: data.hint || undefined,
            explanation: data.explanation || undefined,
          } as any);
        }
      } else if (importActivityType === 'dragndrop') {
        if (!data.sentence) {
          errors.push({ line: lineNum, message: 'Missing "Sentence:" field' });
        }
        if (!data.answers) {
          errors.push({ line: lineNum, message: 'Missing "Answers:" field' });
        } else {
          const answersList = data.answers.split('|').map((a) => a.trim());
          const blankCount = (data.sentence?.match(/__BLANK__/g) || []).length;
          if (blankCount === 0) {
            errors.push({ line: lineNum, message: 'Sentence must contain at least one "__BLANK__" placeholder' });
          }
          if (blankCount !== answersList.length) {
            errors.push({
              line: lineNum,
              message: `Number of "__BLANK__" placeholders (${blankCount}) does not match the number of answers (${answersList.length})`
            });
          }
        }

        if (errors.length === 0) {
          parsed.push({
            sentence: data.sentence,
            answers: data.answers.split('|').map((a) => a.trim()),
          } as any);
        }
      } else {
        parsed.push({
          raw_data: data,
        } as any);
      }
    });

    setValidationErrors(errors);
    setParsedData(parsed);
    setIsValidated(true);

    if (errors.length === 0) {
      toast(`Successfully validated ${parsed.length} items!`, 'success');
    } else {
      toast(`Validation failed with ${errors.length} errors.`, 'error');
    }
  };

  async function handleImport() {
    if (!selectedChapter) {
      toast('Please select a destination chapter from the left sidebar first', 'warning');
      return;
    }
    if (parsedData.length === 0 || validationErrors.length > 0) {
      toast('Please validate data successfully before importing', 'warning');
      return;
    }

    setImporting(true);

    try {
      const inserts = parsedData.map((payload) => ({
        chapter_id: selectedChapter,
        activity_type: importActivityType,
        payload,
        created_by: profile?.id,
      }));

      const { error } = await supabase.from('content').insert(inserts);
      if (error) throw error;

      toast(`Successfully imported ${inserts.length} content items! 🎉`, 'success');
      setInputText('');
      setParsedData([]);
      setIsValidated(false);
      await applyFilter();
      setActiveTab('content');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Import failed';
      toast(message, 'error');
    } finally {
      setImporting(false);
    }
  }

  // Apply filters
  async function applyFilter() {
    setSelectedIds([]); // Clear selection
    let query = supabase.from('content').select('*');

    if (selectedChapter) {
      query = query.eq('chapter_id', selectedChapter);
    } else if (selectedSubject) {
      // Get all chapter IDs for subject
      const { data: chs } = await supabase.from('chapters').select('id').eq('subject_id', selectedSubject);
      const chIds = chs?.map((c) => c.id) || [];
      if (chIds.length === 0) {
        setContentList([]);
        return;
      }
      query = query.in('chapter_id', chIds);
    } else if (selectedSchool && selectedClass) {
      // Get subjects of this school and class
      const { data: subs } = await supabase.from('subjects').select('id').eq('class_id', selectedClass).eq('school_id', selectedSchool);
      const subIds = subs?.map((s) => s.id) || [];
      if (subIds.length === 0) {
        setContentList([]);
        return;
      }
      const { data: chs } = await supabase.from('chapters').select('id').in('subject_id', subIds);
      const chIds = chs?.map((c) => c.id) || [];
      if (chIds.length === 0) {
        setContentList([]);
        return;
      }
      query = query.in('chapter_id', chIds);
    } else if (selectedSchool) {
      // Get all subjects of this school
      const { data: subs } = await supabase.from('subjects').select('id').eq('school_id', selectedSchool);
      const subIds = subs?.map((s) => s.id) || [];
      if (subIds.length === 0) {
        setContentList([]);
        return;
      }
      const { data: chs } = await supabase.from('chapters').select('id').in('subject_id', subIds);
      const chIds = chs?.map((c) => c.id) || [];
      if (chIds.length === 0) {
        setContentList([]);
        return;
      }
      query = query.in('chapter_id', chIds);
    }

    if (selectedType) {
      query = query.eq('activity_type', selectedType);
    }

    const { data } = await query.order('created_at', { ascending: false });
    setContentList(data as Content[] || []);
  }

  // Automatic filter execution
  useEffect(() => {
    if (!initialized) return;

    let active = true;
    async function runFilter() {
      setLoading(true);
      await applyFilter();
      if (active) setLoading(false);
    }
    runFilter();

    return () => {
      active = false;
    };
  }, [selectedSchool, selectedClass, selectedSubject, selectedChapter, selectedType, initialized]);

  async function handleSave() {
    if (!editingContent) return;
    setSaving(true);

    try {
      const payload = JSON.parse(payloadText);
      const { error } = await supabase
        .from('content')
        .update({ payload })
        .eq('id', editingContent.id);

      if (error) throw error;

      setContentList((prev) =>
        prev.map((c) => (c.id === editingContent.id ? { ...c, payload } : c))
      );
      toast('Content updated successfully!', 'success');
      setShowModal(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid JSON payload';
      toast(message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(contentId: string) {
    if (!confirm('Are you sure you want to delete this content item?')) return;

    const { error } = await supabase.from('content').delete().eq('id', contentId);
    if (error) {
      toast(error.message, 'error');
    } else {
      toast('Content deleted.', 'info');
      setContentList((prev) => prev.filter((c) => c.id !== contentId));
      setSelectedIds((prev) => prev.filter((id) => id !== contentId));
    }
  }

  // Bulk selection toggles
  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.checked) {
      setSelectedIds(contentList.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  }

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete the ${selectedIds.length} selected items?`)) return;

    setLoading(true);
    const { error } = await supabase
      .from('content')
      .delete()
      .in('id', selectedIds);

    if (error) {
      toast(error.message, 'error');
    } else {
      toast(`Successfully deleted ${selectedIds.length} items.`, 'info');
      setContentList((prev) => prev.filter((c) => !selectedIds.includes(c.id)));
      setSelectedIds([]);
    }
    setLoading(false);
  }

  const handlePlayContent = (item: Content) => {
    const params = new URLSearchParams();
    params.set('chapters', item.chapter_id);
    params.set('mode', 'practice');
    params.set('type', item.activity_type);
    params.set('count', '10');
    window.open(`/student/play?${params.toString()}`, '_blank');
  };

  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        {/* Left side: Navigation Explorer (School > Class > Subject > Chapter tree with inline management) */}
        <div className="md:col-span-3 flex flex-col gap-4 max-h-[calc(100vh-140px)] min-h-[600px] overflow-y-auto bg-white p-4">
          <div className="border-b border-surface-200 pb-3 mb-2 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-surface-800 uppercase tracking-wider">Curriculum Explorer</h2>
              <p className="text-xs text-surface-400 mt-1">Manage & filter by curriculum levels.</p>
            </div>
            <button
              onClick={() => {
                setSelectedSchool('');
                setSelectedClass('');
                setSelectedSubject('');
                setSelectedChapter('');
              }}
              className="text-xs text-primary bg-primary-50 hover:bg-primary-100 px-2 py-1 rounded-lg font-bold transition-all cursor-pointer"
            >
              Clear
            </button>
          </div>

          <div className="space-y-3">
            {/* Add School Inline Form */}
            {showAddSchoolForm ? (
              <div className="flex gap-1.5 py-1 items-center border-b border-surface-100 pb-2 mb-2">
                <input
                  type="text"
                  placeholder="New school name..."
                  value={schoolFormValue}
                  onChange={(e) => setSchoolFormValue(e.target.value)}
                  className="text-xs border-b border-primary-300 focus:border-primary-500 focus:outline-none py-0.5 w-36 bg-transparent font-medium"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (schoolFormValue.trim()) {
                        addSchoolInline(schoolFormValue.trim());
                        setShowAddSchoolForm(false);
                        setSchoolFormValue('');
                      }
                    } else if (e.key === 'Escape') {
                      setShowAddSchoolForm(false);
                      setSchoolFormValue('');
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (schoolFormValue.trim()) {
                      addSchoolInline(schoolFormValue.trim());
                      setShowAddSchoolForm(false);
                      setSchoolFormValue('');
                    }
                  }}
                  className="text-[10px] text-emerald-600 font-bold hover:underline cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSchoolForm(false);
                    setSchoolFormValue('');
                  }}
                  className="text-[10px] text-slate-400 font-bold hover:underline cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowAddSchoolForm(true);
                  setSchoolFormValue('');
                }}
                className="text-[11px] text-slate-500 hover:text-primary font-bold py-1.5 flex items-center gap-1 cursor-pointer border-b border-surface-100 pb-2 mb-2 w-full text-left"
              >
                <Plus size={12} /> Add School
              </button>
            )}

            {schools.length === 0 ? (
              <p className="text-xs text-surface-400 text-center py-4">No schools found.</p>
            ) : (
              schools.map((school) => {
                const isSchoolExpanded = selectedSchool === school.id;
                const isEditingSchool = editingSchoolId === school.id;
                return (
                  <div key={school.id} className="bg-white">
                    {isEditingSchool ? (
                      <div className="flex gap-1.5 py-1 items-center">
                        <input
                          type="text"
                          value={schoolFormValue}
                          onChange={(e) => setSchoolFormValue(e.target.value)}
                          className="text-xs border-b border-primary-300 focus:border-primary-500 focus:outline-none py-0.5 w-32 bg-transparent font-medium"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (schoolFormValue.trim()) {
                                updateSchoolInline(school.id, schoolFormValue.trim());
                                setEditingSchoolId(null);
                                setSchoolFormValue('');
                              }
                            } else if (e.key === 'Escape') {
                              setEditingSchoolId(null);
                              setSchoolFormValue('');
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (schoolFormValue.trim()) {
                              updateSchoolInline(school.id, schoolFormValue.trim());
                              setEditingSchoolId(null);
                              setSchoolFormValue('');
                            }
                          }}
                          className="text-[10px] text-emerald-600 font-bold hover:underline cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSchoolId(null);
                            setSchoolFormValue('');
                          }}
                          className="text-[10px] text-slate-400 font-bold hover:underline cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between hover:bg-surface-50 group rounded px-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSchool(isSchoolExpanded ? '' : school.id);
                            setSelectedClass('');
                            setSelectedSubject('');
                            setSelectedChapter('');
                          }}
                          className={`flex-grow flex items-center justify-between py-1 text-left transition-colors cursor-pointer ${
                            isSchoolExpanded ? 'text-primary-600 font-bold' : 'hover:text-surface-900 text-surface-700 font-semibold'
                          }`}
                        >
                          <span className="flex items-center gap-2 text-xs truncate">
                            <SchoolIcon size={14} className={isSchoolExpanded ? 'text-primary shrink-0' : 'text-surface-400 shrink-0'} />
                            <span className="truncate">{school.name}</span>
                          </span>
                          <span className="text-[10px] text-surface-400 ml-1">{isSchoolExpanded ? '▼' : '▶'}</span>
                        </button>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSchoolId(school.id);
                              setSchoolFormValue(school.name);
                            }}
                            className="p-0.5 text-slate-400 hover:text-primary cursor-pointer"
                            title="Edit School"
                          >
                            <Edit size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(school.id, 'schools');
                            }}
                            className="p-0.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                            title="Delete School"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    )}

                    {isSchoolExpanded && (
                      <div className="py-0.5 bg-white space-y-0.5">
                        {classes.map((cls) => {
                          const isClassExpanded = selectedClass === cls.id;
                          const isEditingClass = editingClassId === cls.id;
                          return (
                            <div key={cls.id} className="overflow-hidden">
                              {isEditingClass ? (
                                <div className="flex gap-1.5 pl-4 py-1 items-center">
                                  <input
                                    type="text"
                                    value={classFormValue}
                                    onChange={(e) => setClassFormValue(e.target.value)}
                                    className="text-xs border-b border-primary-300 focus:border-primary-500 focus:outline-none py-0.5 w-28 bg-transparent font-medium"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        if (classFormValue.trim()) {
                                          updateClassInline(cls.id, classFormValue.trim());
                                          setEditingClassId(null);
                                          setClassFormValue('');
                                        }
                                      } else if (e.key === 'Escape') {
                                        setEditingClassId(null);
                                        setClassFormValue('');
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (classFormValue.trim()) {
                                        updateClassInline(cls.id, classFormValue.trim());
                                        setEditingClassId(null);
                                        setClassFormValue('');
                                      }
                                    }}
                                    className="text-[10px] text-emerald-600 font-bold hover:underline cursor-pointer"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingClassId(null);
                                      setClassFormValue('');
                                    }}
                                    className="text-[10px] text-slate-400 font-bold hover:underline cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between pl-3 pr-1 py-0.5 hover:bg-surface-50 group rounded">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedClass(isClassExpanded ? '' : cls.id);
                                      setSelectedSubject('');
                                      setSelectedChapter('');
                                    }}
                                    className={`flex-grow flex items-center gap-2 text-left py-0.5 text-xs font-semibold cursor-pointer truncate ${
                                      isClassExpanded ? 'text-primary font-bold' : 'text-slate-600'
                                    }`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isClassExpanded ? 'bg-primary-500' : 'bg-surface-300'}`} />
                                    <span className="truncate">{cls.name}</span>
                                  </button>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingClassId(cls.id);
                                        setClassFormValue(cls.name);
                                      }}
                                      className="p-0.5 text-slate-400 hover:text-primary cursor-pointer"
                                      title="Edit Class"
                                    >
                                      <Edit size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteItem(cls.id, 'classes');
                                      }}
                                      className="p-0.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                                      title="Delete Class"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>
                              )}

                              {isClassExpanded && (
                                <div className="pl-4 pr-1 py-0.5 space-y-0.5 ml-2 mt-0.5">
                                  {subjects.length === 0 ? (
                                    <p className="text-[10px] text-surface-400 pl-3 py-1 italic">No subjects</p>
                                  ) : (
                                    subjects.map((subj) => {
                                      const isSubjExpanded = selectedSubject === subj.id;
                                      const isEditingSubj = editingSubjectId === subj.id;
                                      return (
                                        <div key={subj.id}>
                                          {isEditingSubj ? (
                                            <div className="flex gap-1.5 pl-3 py-1 items-center">
                                              <input
                                                type="text"
                                                value={subjectFormValue}
                                                onChange={(e) => setSubjectFormValue(e.target.value)}
                                                className="text-xs border-b border-primary-300 focus:border-primary-500 focus:outline-none py-0.5 w-28 bg-transparent font-medium"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    if (subjectFormValue.trim()) {
                                                      updateSubjectInline(subj.id, subjectFormValue.trim(), cls.id, school.id);
                                                      setEditingSubjectId(null);
                                                      setSubjectFormValue('');
                                                    }
                                                  } else if (e.key === 'Escape') {
                                                    setEditingSubjectId(null);
                                                    setSubjectFormValue('');
                                                  }
                                                }}
                                              />
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (subjectFormValue.trim()) {
                                                    updateSubjectInline(subj.id, subjectFormValue.trim(), cls.id, school.id);
                                                    setEditingSubjectId(null);
                                                    setSubjectFormValue('');
                                                  }
                                                }}
                                                className="text-[10px] text-emerald-600 font-bold hover:underline cursor-pointer"
                                              >
                                                Save
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setEditingSubjectId(null);
                                                  setSubjectFormValue('');
                                                }}
                                                className="text-[10px] text-slate-400 font-bold hover:underline cursor-pointer"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="flex items-center justify-between pl-2 pr-1 py-0.5 hover:bg-surface-50 group rounded">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setSelectedSubject(isSubjExpanded ? '' : subj.id);
                                                  setSelectedChapter('');
                                                }}
                                                className={`flex-grow flex items-center gap-1.5 text-left py-0.5 text-xs font-semibold cursor-pointer truncate ${
                                                  isSubjExpanded ? 'text-primary font-bold' : 'text-slate-500'
                                                }`}
                                              >
                                                <BookOpen size={11} className={isSubjExpanded ? 'text-primary shrink-0' : 'text-slate-400 shrink-0'} />
                                                <span className="truncate">{subj.name}</span>
                                              </button>
                                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingSubjectId(subj.id);
                                                    setSubjectFormValue(subj.name);
                                                  }}
                                                  className="p-0.5 text-slate-400 hover:text-primary cursor-pointer"
                                                  title="Edit Subject"
                                                >
                                                  <Edit size={11} />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteItem(subj.id, 'subjects');
                                                  }}
                                                  className="p-0.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                                                  title="Delete Subject"
                                                >
                                                  <Trash2 size={11} />
                                                </button>
                                              </div>
                                            </div>
                                          )}

                                          {isSubjExpanded && (
                                            <div className="pl-3 pr-1 py-0.5 space-y-0.5 ml-2 mt-0.5">
                                              {chapters.length === 0 ? (
                                                <p className="text-[10px] text-surface-400 pl-2 py-1 italic">No chapters</p>
                                              ) : (
                                                chapters.map((chap) => {
                                                  const isChapSelected = selectedChapter === chap.id;
                                                  const isEditingChap = editingChapterId === chap.id;
                                                  return (
                                                    <div key={chap.id} className="group flex items-center justify-between py-0.5 pl-1 pr-1 rounded hover:bg-surface-50">
                                                      {isEditingChap ? (
                                                        <div className="flex gap-1 items-center w-full">
                                                          <input
                                                            type="text"
                                                            value={chapterFormValue}
                                                            onChange={(e) => setChapterFormValue(e.target.value)}
                                                            className="text-xs border-b border-primary-300 focus:border-primary-500 focus:outline-none py-0.5 w-24 bg-transparent font-medium"
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                              if (e.key === 'Enter') {
                                                                if (chapterFormValue.trim()) {
                                                                  updateChapterInline(chap.id, chapterFormValue.trim());
                                                                  setEditingChapterId(null);
                                                                  setChapterFormValue('');
                                                                }
                                                              } else if (e.key === 'Escape') {
                                                                setEditingChapterId(null);
                                                                setChapterFormValue('');
                                                              }
                                                            }}
                                                          />
                                                          <button
                                                            type="button"
                                                            onClick={() => {
                                                              if (chapterFormValue.trim()) {
                                                                updateChapterInline(chap.id, chapterFormValue.trim());
                                                                setEditingChapterId(null);
                                                                setChapterFormValue('');
                                                              }
                                                            }}
                                                            className="text-[10px] text-emerald-600 font-bold hover:underline cursor-pointer"
                                                          >
                                                            Save
                                                          </button>
                                                          <button
                                                            type="button"
                                                            onClick={() => {
                                                              setEditingChapterId(null);
                                                              setChapterFormValue('');
                                                            }}
                                                            className="text-[10px] text-slate-400 font-bold hover:underline cursor-pointer"
                                                          >
                                                            Cancel
                                                          </button>
                                                        </div>
                                                      ) : (
                                                        <>
                                                          <button
                                                            type="button"
                                                            onClick={() => {
                                                              setSelectedChapter(isChapSelected ? '' : chap.id);
                                                            }}
                                                            className={`flex-grow flex items-center gap-1.5 text-left text-xs font-semibold cursor-pointer truncate ${
                                                              isChapSelected ? 'text-primary font-bold' : 'text-slate-500 hover:text-slate-800'
                                                            }`}
                                                          >
                                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isChapSelected ? 'bg-primary-500' : 'bg-surface-300'}`} />
                                                            <span className="truncate">{chap.name}</span>
                                                          </button>

                                                          <div className="flex items-center gap-1 shrink-0">
                                                            {/* Lock/Unlock Toggle */}
                                                            <button
                                                              type="button"
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleChapterLock(chap.id, chap.is_locked);
                                                              }}
                                                              className={`p-0.5 cursor-pointer transition-colors ${
                                                                chap.is_locked ? 'text-rose-600 hover:text-rose-700' : 'text-slate-400 hover:text-emerald-600'
                                                              }`}
                                                              title={chap.is_locked ? 'Locked (Click to Unlock)' : 'Unlocked (Click to Lock)'}
                                                            >
                                                              {chap.is_locked ? <Lock size={11} /> : <Unlock size={11} />}
                                                            </button>

                                                            {/* Active/Inactive Toggle */}
                                                            <button
                                                              type="button"
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleChapterActive(chap.id, chap.is_active);
                                                              }}
                                                              className={`p-0.5 cursor-pointer transition-colors ${
                                                                chap.is_active ? 'text-emerald-600 hover:text-emerald-700' : 'text-slate-300 hover:text-slate-500'
                                                              }`}
                                                              title={chap.is_active ? 'Active (Click to Deactivate)' : 'Inactive (Click to Activate)'}
                                                            >
                                                              {chap.is_active ? <Eye size={11} /> : <EyeOff size={11} />}
                                                            </button>

                                                            {/* Edit Button */}
                                                            <button
                                                              type="button"
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingChapterId(chap.id);
                                                                setChapterFormValue(chap.name);
                                                              }}
                                                              className="p-0.5 text-slate-400 hover:text-primary cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                                              title="Edit Chapter"
                                                            >
                                                              <Edit size={11} />
                                                            </button>

                                                            {/* Delete Button */}
                                                            <button
                                                              type="button"
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteItem(chap.id, 'chapters');
                                                              }}
                                                              className="p-0.5 text-slate-400 hover:text-rose-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                                              title="Delete Chapter"
                                                            >
                                                              <Trash2 size={11} />
                                                            </button>
                                                          </div>
                                                        </>
                                                      )}
                                                    </div>
                                                  );
                                                })
                                              )}

                                              {/* Add Chapter Inline Form */}
                                              {showAddChapterFormSubjectId === subj.id ? (
                                                <div className="flex gap-1.5 pl-2 py-1 items-center">
                                                  <input
                                                    type="text"
                                                    placeholder="New chapter..."
                                                    value={chapterFormValue}
                                                    onChange={(e) => setChapterFormValue(e.target.value)}
                                                    className="text-xs border-b border-primary-300 focus:border-primary-500 focus:outline-none py-0.5 w-24 bg-transparent font-medium"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Enter') {
                                                        if (chapterFormValue.trim()) {
                                                          addChapterInline(chapterFormValue.trim(), subj.id);
                                                          setShowAddChapterFormSubjectId(null);
                                                          setChapterFormValue('');
                                                        }
                                                      } else if (e.key === 'Escape') {
                                                        setShowAddChapterFormSubjectId(null);
                                                        setChapterFormValue('');
                                                      }
                                                    }}
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      if (chapterFormValue.trim()) {
                                                        addChapterInline(chapterFormValue.trim(), subj.id);
                                                        setShowAddChapterFormSubjectId(null);
                                                        setChapterFormValue('');
                                                      }
                                                    }}
                                                    className="text-[10px] text-emerald-600 font-bold hover:underline cursor-pointer"
                                                  >
                                                    Save
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setShowAddChapterFormSubjectId(null);
                                                      setChapterFormValue('');
                                                    }}
                                                    className="text-[10px] text-slate-400 font-bold hover:underline cursor-pointer"
                                                  >
                                                    Cancel
                                                  </button>
                                                </div>
                                              ) : (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setShowAddChapterFormSubjectId(subj.id);
                                                    setChapterFormValue('');
                                                  }}
                                                  className="text-[10px] text-slate-400 hover:text-primary font-bold pl-2 py-1 flex items-center gap-1 cursor-pointer"
                                                >
                                                  <Plus size={10} /> Add Chapter
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                  )}

                                  {/* Add Subject Inline Form */}
                                  {showAddSubjectFormClassId === cls.id ? (
                                    <div className="flex gap-1.5 pl-3 py-1 items-center">
                                      <input
                                        type="text"
                                        placeholder="New subject..."
                                        value={subjectFormValue}
                                        onChange={(e) => setSubjectFormValue(e.target.value)}
                                        className="text-xs border-b border-primary-300 focus:border-primary-500 focus:outline-none py-0.5 w-28 bg-transparent font-medium"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            if (subjectFormValue.trim()) {
                                              addSubjectInline(subjectFormValue.trim(), cls.id, school.id);
                                              setShowAddSubjectFormClassId(null);
                                              setSubjectFormValue('');
                                            }
                                          } else if (e.key === 'Escape') {
                                            setShowAddSubjectFormClassId(null);
                                            setSubjectFormValue('');
                                          }
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (subjectFormValue.trim()) {
                                            addSubjectInline(subjectFormValue.trim(), cls.id, school.id);
                                            setShowAddSubjectFormClassId(null);
                                            setSubjectFormValue('');
                                          }
                                        }}
                                        className="text-[10px] text-emerald-600 font-bold hover:underline cursor-pointer"
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowAddSubjectFormClassId(null);
                                          setSubjectFormValue('');
                                        }}
                                        className="text-[10px] text-slate-400 font-bold hover:underline cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowAddSubjectFormClassId(cls.id);
                                        setSubjectFormValue('');
                                      }}
                                      className="text-[10px] text-slate-400 hover:text-primary font-bold pl-3 py-1 flex items-center gap-1 cursor-pointer"
                                    >
                                      <Plus size={10} /> Add Subject
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Add Class Inline Form */}
                        {showAddClassFormSchoolId === school.id ? (
                          <div className="flex gap-1.5 pl-4 py-1 items-center">
                            <input
                              type="text"
                              placeholder="New class..."
                              value={classFormValue}
                              onChange={(e) => setClassFormValue(e.target.value)}
                              className="text-xs border-b border-primary-300 focus:border-primary-500 focus:outline-none py-0.5 w-28 bg-transparent font-medium"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  if (classFormValue.trim()) {
                                    addClassInline(classFormValue.trim());
                                    setShowAddClassFormSchoolId(null);
                                    setClassFormValue('');
                                  }
                                } else if (e.key === 'Escape') {
                                  setShowAddClassFormSchoolId(null);
                                  setClassFormValue('');
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (classFormValue.trim()) {
                                  addClassInline(classFormValue.trim());
                                  setShowAddClassFormSchoolId(null);
                                  setClassFormValue('');
                                }
                              }}
                              className="text-[10px] text-emerald-600 font-bold hover:underline cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddClassFormSchoolId(null);
                                setClassFormValue('');
                              }}
                              className="text-[10px] text-slate-400 font-bold hover:underline cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddClassFormSchoolId(school.id);
                              setClassFormValue('');
                            }}
                            className="text-[10px] text-slate-400 hover:text-primary font-bold pl-4 py-1 flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={10} /> Add Class
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right side: Content oversight list and Bulk Import Tabs */}
        <div className="md:col-span-9 flex flex-col gap-4 max-h-[calc(100vh-140px)] overflow-y-auto">
          {/* Top Tabs Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-surface-200 p-1.5 rounded-2xl shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('content')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'content'
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-surface-600 hover:bg-surface-100'
                }`}
              >
                <ListFilter size={15} />
                Filtered Content ({contentList.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('import')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'import'
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-surface-600 hover:bg-surface-100'
                }`}
              >
                <Upload size={15} />
                Bulk Import
              </button>
            </div>

            {selectedChapter && (
              <span className="text-[11px] font-semibold text-surface-500 bg-surface-100 px-3 py-1 rounded-lg truncate max-w-xs">
                Destination: <span className="font-bold text-primary-600">{chapters.find(c => c.id === selectedChapter)?.name}</span>
              </span>
            )}
          </div>

          {activeTab === 'content' ? (
            <>
              {/* Activity Filters Card */}
              <Card padding="sm" className="bg-white">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-surface-100 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-surface-500">Activity Type Filter</span>
                    {selectedType && (
                      <button
                        onClick={() => setSelectedType('')}
                        className="text-xs text-primary hover:underline font-bold cursor-pointer"
                      >
                        Clear Filter
                      </button>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {/* Play Zone Group */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-surface-400 w-20 shrink-0">Play Zone:</span>
                      {activities.filter(a => a.zone === 'play').map((activity) => {
                        const isSelected = selectedType === activity.key;
                        const cardColor = activity.color || '#6366f1';
                        return (
                          <button
                            key={activity.key}
                            onClick={() => setSelectedType(selectedType === activity.key ? '' : activity.key)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer`}
                            style={
                              isSelected
                                ? {
                                    backgroundColor: `${cardColor}15`,
                                    borderColor: cardColor,
                                    color: cardColor,
                                  }
                                : {
                                    backgroundColor: '#ffffff',
                                    borderColor: '#e2e8f0',
                                    color: '#475569',
                                  }
                            }
                          >
                            {activity.emoji || '⚡'} {activity.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Test Zone Group */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-surface-400 w-20 shrink-0">Test Zone:</span>
                      {activities.filter(a => a.zone === 'test').map((activity) => {
                        const isSelected = selectedType === activity.key;
                        const cardColor = activity.color || '#6366f1';
                        return (
                          <button
                            key={activity.key}
                            onClick={() => setSelectedType(selectedType === activity.key ? '' : activity.key)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer`}
                            style={
                              isSelected
                                ? {
                                    backgroundColor: `${cardColor}15`,
                                    borderColor: cardColor,
                                    color: cardColor,
                                  }
                                : {
                                    backgroundColor: '#ffffff',
                                    borderColor: '#e2e8f0',
                                    color: '#475569',
                                  }
                            }
                          >
                            {activity.emoji || '📄'} {activity.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Select All Action Banner */}
              {!loading && contentList.length > 0 && (
                <div className="flex items-center justify-between bg-white border border-surface-200 rounded-2xl px-4 py-3 text-sm">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="select-all"
                      checked={contentList.length > 0 && selectedIds.length === contentList.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                    <label htmlFor="select-all" className="font-semibold text-surface-700 select-none cursor-pointer">
                      Select All ({contentList.length})
                    </label>
                  </div>
                  {selectedIds.length > 0 && (
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<Trash2 size={14} />}
                      onClick={handleBulkDelete}
                    >
                      Delete Selected ({selectedIds.length})
                    </Button>
                  )}
                </div>
              )}

              {/* Content Oversight List */}
              {loading ? (
                <div className="flex justify-center py-20"><Spinner size="lg" /></div>
              ) : contentList.length === 0 ? (
                <Card className="text-center py-20 bg-white">
                  <p className="text-surface-500 font-medium">No content items found for this selection.</p>
                </Card>
              ) : (
                <div className="flex flex-col gap-3">
                  {contentList.map((item) => (
                    <Card key={item.id} className="flex items-center gap-4 bg-white" padding="sm">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => handleToggleSelect(item.id)}
                        className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500 cursor-pointer flex-shrink-0"
                      />
                      <Badge variant={
                        item.activity_type === 'quiz' ? 'info' :
                        item.activity_type === 'flashcard' ? 'default' :
                        (item.activity_type as string) === 'matching' ? 'success' :
                        (item.activity_type as string) === 'picture' ? 'danger' : 'warning'
                      } size="sm">
                        {item.activity_type === 'quiz' ? 'Quiz Quest' :
                         item.activity_type === 'flashcard' ? 'Flash Flip' :
                         item.activity_type === 'matching' ? 'Match Mania' :
                         item.activity_type === 'picture' ? 'Pic Picasso' :
                         item.activity_type === 'dragndrop' ? 'Drag & Drop' :
                         (item.activity_type as string) === 'groupsort' ? 'Group Sort' :
                         (item.activity_type as string) === 'wheel' ? 'Spin the Wheel' :
                         (item.activity_type as string) === 'unjumble' ? 'Unjumble' :
                         (item.activity_type as string) === 'anagram' ? 'Anagram' :
                         (item.activity_type as string) === 'matchingpairs' ? 'Matching Pairs' :
                         (item.activity_type as string) === 'openthebox' ? 'Open the Box' :
                         (item.activity_type as string) === 'worksheet' ? 'Worksheet' :
                         (item.activity_type as string) === 'testpaper' ? 'Test Paper' : item.activity_type}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-surface-700 font-mono truncate">
                          {JSON.stringify(item.payload)}
                        </p>
                        <p className="text-[10px] text-surface-400 mt-1">
                          Chapter: {chapters.find(c => c.id === item.chapter_id)?.name || 'Loading name...'} | Created: {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePlayContent(item)}
                          className="p-2 hover:bg-primary-50 text-primary hover:text-primary-700 rounded-lg cursor-pointer transition-colors"
                          title="Play Activity"
                        >
                          <Play size={16} className="fill-current" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingContent(item);
                            setPayloadText(JSON.stringify(item.payload, null, 2));
                            setShowModal(true);
                          }}
                          className="p-2 hover:bg-surface-100 rounded-lg cursor-pointer transition-colors"
                          title="Edit Payload"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 hover:bg-danger-50 text-danger-500 rounded-lg cursor-pointer transition-colors"
                          title="Delete Item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Bulk Import Panel */
            <div className="flex flex-col gap-4 animate-fade-in">
              {/* Destination & Activity Filters Card */}
              <Card padding="sm" className="bg-white">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-surface-100 pb-2">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-surface-500">Target Destination: </span>
                      <span className="text-xs font-bold text-primary-600">
                        {selectedChapter 
                          ? `${schools.find(s=>s.id===selectedSchool)?.name || ''} · ${classes.find(c=>c.id===selectedClass)?.name || ''} · ${subjects.find(s=>s.id===selectedSubject)?.name || ''} · ${chapters.find(c=>c.id===selectedChapter)?.name || ''}`
                          : '⚠️ None selected (Select a chapter in the left sidebar)'
                        }
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-surface-400 w-24 shrink-0">Activity Type:</span>
                      {activities.map((act) => {
                        const isSelected = importActivityType === act.key;
                        const cardColor = act.color || '#6366f1';
                        return (
                          <button
                            key={act.key}
                            onClick={() => handleImportTypeChange(act.key as ActivityType)}
                            className="px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer"
                            style={
                              isSelected
                                ? {
                                    backgroundColor: `${cardColor}15`,
                                    borderColor: cardColor,
                                    color: cardColor,
                                  }
                                : {
                                    backgroundColor: '#ffffff',
                                    borderColor: '#e2e8f0',
                                    color: '#475569',
                                  }
                            }
                          >
                            {act.emoji || '🎮'} {act.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Import text editor */}
              <Card className="bg-white">
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-surface-600 uppercase tracking-wider">Paste Text Template</label>
                      <button
                        onClick={() => setInputText(getTemplate(importActivityType))}
                        className="text-xs text-primary hover:underline font-bold cursor-pointer"
                      >
                        Reset Template
                      </button>
                    </div>
                    <textarea
                      value={inputText}
                      onChange={(e) => {
                        setInputText(e.target.value);
                        setIsValidated(false);
                      }}
                      rows={10}
                      className="w-full px-4 py-3 rounded-xl border-2 border-surface-200 bg-white text-surface-800 font-mono text-sm focus:outline-none focus:border-primary-400"
                      placeholder="Paste content here..."
                    />
                  </div>
                </div>
              </Card>

              {/* Validation feedback */}
              {isValidated && (
                <Card className="mb-2 animate-fade-in bg-white">
                  <div className="flex items-center gap-2 mb-3">
                    {validationErrors.length === 0 ? (
                      <CheckCircle2 className="text-emerald-500" />
                    ) : (
                      <AlertCircle className="text-rose-500" />
                    )}
                    <h3 className="font-bold text-surface-900">
                      Validation Result: {validationErrors.length === 0 ? 'All Good!' : 'Fix Errors'}
                    </h3>
                  </div>

                  {validationErrors.length > 0 ? (
                    <ul className="text-sm text-rose-700 bg-rose-50 p-4 rounded-xl space-y-1">
                      {validationErrors.map((err, i) => (
                        <li key={i}>
                          • <strong>Item {err.line}:</strong> {err.message}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-emerald-800 bg-emerald-50 p-4 rounded-xl font-semibold">
                      Ready to import {parsedData.length} item(s) to the selected chapter.
                    </p>
                  )}
                </Card>
              )}

              {/* Action buttons */}
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  className="flex-grow"
                  size="lg"
                  onClick={validateAndParse}
                  icon={<FileText size={18} />}
                >
                  Validate Format
                </Button>

                {isValidated && validationErrors.length === 0 && selectedChapter && (
                  <Button
                    className="flex-grow font-bold animate-pulse"
                    size="lg"
                    onClick={handleImport}
                    loading={importing}
                    icon={<Upload size={18} />}
                  >
                    Import {parsedData.length} Items 🚀
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Oversight: Edit Content Payload"
        size="lg"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-surface-500">
            Moderate payload JSON. Make sure you maintain schema structure for the {editingContent?.activity_type} type.
          </p>

          <textarea
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
            rows={12}
            className="w-full px-4 py-3 rounded-xl border-2 border-surface-200 bg-white text-surface-800 font-mono text-sm focus:outline-none focus:border-primary-400"
          />

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Save Payload
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
