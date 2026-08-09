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
import { Trash2, Edit, BookOpen, School as SchoolIcon, Plus, Lock, Unlock, Eye, EyeOff, Upload, FileText, CheckCircle2, AlertCircle, ListFilter, ChevronDown, Sparkles } from 'lucide-react';

interface ValidationError {
  line: number;
  message: string;
}

export default function ContentOversightPage() {
  const { profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'content' | 'import' | 'ai'>('content');

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

  // AI Generator states
  const [aiChapterText, setAiChapterText] = useState('');
  const [aiActivityType, setAiActivityType] = useState<ActivityType>('quiz');
  const [aiCount, setAiCount] = useState<number | string>(10);
  const [aiApiKey, setAiApiKey] = useState(localStorage.getItem('quizlee_gemini_api_key') || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [generatingChapters, setGeneratingChapters] = useState<Record<string, boolean>>({});
  const [chapterGeneratedItems, setChapterGeneratedItems] = useState<Record<string, ContentPayload[]>>({});
  const [chapterSelectedAiItemIds, setChapterSelectedAiItemIds] = useState<Record<string, number[]>>({});
  const [chapterActivityTypes, setChapterActivityTypes] = useState<Record<string, ActivityType>>({});
  const [aiImporting, setAiImporting] = useState(false);
  const [uploadingChapterText, setUploadingChapterText] = useState(false);
  const [deletingChapterText, setDeletingChapterText] = useState(false);

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

  // Derived states for currently selected chapter
  const isCurrentChapterGenerating = selectedChapter ? !!generatingChapters[selectedChapter] : false;
  const generatedItems = selectedChapter ? (chapterGeneratedItems[selectedChapter] || []) : [];
  const selectedAiItemIds = selectedChapter ? (chapterSelectedAiItemIds[selectedChapter] || []) : [];
  const activeGeneratingChapterIds = Object.keys(generatingChapters).filter((id) => generatingChapters[id]);

  const setSelectedAiItemIds = (updater: number[] | ((prev: number[]) => number[])) => {
    if (!selectedChapter) return;
    setChapterSelectedAiItemIds((prev) => {
      const existing = prev[selectedChapter] || [];
      const nextVal = typeof updater === 'function' ? updater(existing) : updater;
      return { ...prev, [selectedChapter]: nextVal };
    });
  };

  const setGeneratedItems = (updater: ContentPayload[] | ((prev: ContentPayload[]) => ContentPayload[])) => {
    if (!selectedChapter) return;
    setChapterGeneratedItems((prev) => {
      const existing = prev[selectedChapter] || [];
      const nextVal = typeof updater === 'function' ? updater(existing) : updater;
      return { ...prev, [selectedChapter]: nextVal };
    });
  };

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

  // Left panel resize state
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem('oversight_left_panel_width');
    return saved ? Math.max(220, Math.min(650, Number(saved))) : 320;
  });
  const [isDraggingLeftPanel, setIsDraggingLeftPanel] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [showMobileExplorer, setShowMobileExplorer] = useState(true);
  const [viewDensity, setViewDensity] = useState<'compact' | 'detailed'>('compact');

  function getPayloadPreview(item: Content): string {
    if (!item?.payload) return 'No content payload';
    const p = item.payload as any;

    if (item.activity_type === 'quiz') {
      return p.question || 'Quiz Question';
    }
    if (item.activity_type === 'flashcard') {
      return p.front && p.back ? `${p.front} ➔ ${p.back}` : (p.front || p.back || 'Flashcard Item');
    }
    if (item.activity_type === 'matching') {
      if (Array.isArray(p.pairs) && p.pairs.length > 0) {
        return p.pairs.map((pair: any) => `${pair.left} = ${pair.right}`).join(' | ');
      }
      return 'Matching Pairs';
    }
    if (item.activity_type === 'picture') {
      return p.question ? `📷 ${p.question}` : 'Picture Game Question';
    }
    if (item.activity_type === 'dragndrop') {
      return p.sentence || (Array.isArray(p.answers) ? p.answers.join(', ') : 'Drag & Drop Item');
    }

    if (typeof p === 'string') return p;
    if (p.question) return p.question;
    if (p.title) return p.title;
    if (p.sentence) return p.sentence;
    if (p.front) return p.front;
    return JSON.stringify(p);
  }

  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleStartResizeLeftPanel = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingLeftPanel(true);
    const startX = e.clientX;
    const startWidth = leftPanelWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(220, Math.min(650, startWidth + deltaX));
      setLeftPanelWidth(newWidth);
      localStorage.setItem('oversight_left_panel_width', newWidth.toString());
    };

    const handleMouseUp = () => {
      setIsDraggingLeftPanel(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

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
  };

  // AI Generation Handler via real API call with automatic model selection
  const handleGenerateAiQuestions = () => {
    if (!aiChapterText.trim()) {
      toast('Please enter or import the chapter text context first', 'warning');
      return;
    }
    if (!selectedChapter) {
      toast('Please select a destination chapter from the left sidebar', 'warning');
      return;
    }

    const activeApiKey = aiApiKey.trim() || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';

    if (!activeApiKey) {
      toast('Please enter your Gemini API Key in the field above to run AI generation', 'warning');
      return;
    }

    const targetChapterId = selectedChapter;
    const chapterObj = chapters.find((c) => c.id === targetChapterId);
    const chapterName = chapterObj?.name || 'Selected Chapter';
    const targetChapterText = aiChapterText.trim();
    const targetActivityType = aiActivityType;
    const targetCount = Math.max(1, Math.min(50, parseInt(String(aiCount)) || 10));

    // Mark chapter as generating
    setGeneratingChapters((prev) => ({ ...prev, [targetChapterId]: true }));
    setChapterActivityTypes((prev) => ({ ...prev, [targetChapterId]: targetActivityType }));
    toast(`Started AI generation for "${chapterName}"... ✨`, 'info');

    // Run generation asynchronously in background
    (async () => {
      const startTime = Date.now();
      try {
        const isBengali = /[\u0980-\u09FF]/.test(targetChapterText);
        const langInstruction = isBengali
          ? "CRITICAL: All questions, options, hints, and explanations MUST be written in fluent BENGALI language."
          : "CRITICAL: All questions, options, hints, and explanations MUST be written in ENGLISH language.";

        // 1. Dynamically query Google AI Studio for active models supporting generateContent for this API Key
        const listResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${activeApiKey}`
        );

        if (!listResponse.ok) {
          const errData = await listResponse.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Invalid API Key or HTTP ${listResponse.status}`);
        }

        const listData = await listResponse.json();
        const rawModels: any[] = listData?.models || [];
        const supportedModelNames = rawModels
          .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map((m: any) => m.name.replace('models/', ''));

        if (supportedModelNames.length === 0) {
          throw new Error('No active Gemini models supporting question generation were found for this API Key.');
        }

        // 2. Prioritize stable models with highest free tier limits
        const preferredList = [
          'gemini-1.5-flash',
          'gemini-1.5-flash-latest',
          'gemini-1.5-flash-8b',
          'gemini-1.5-pro',
          'gemini-1.5-pro-latest',
          'gemini-2.0-flash',
          'gemini-2.0-flash-exp',
        ];

        const targetModels = [
          ...preferredList.filter((m) => supportedModelNames.includes(m)),
          ...supportedModelNames,
        ];
        const uniqueTargets = Array.from(new Set(targetModels));

        // 3. Parallel Batch Chunking Configuration (Chunk size = 10 items per parallel request)
        const CHUNK_SIZE = 10;
        const numChunks = Math.ceil(targetCount / CHUNK_SIZE);
        const textSubstrings = targetChapterText.substring(0, 8000);

        const fetchChunk = async (chunkIndex: number): Promise<ContentPayload[]> => {
          const chunkCount = Math.min(CHUNK_SIZE, targetCount - chunkIndex * CHUNK_SIZE);
          const sectionInstruction = numChunks > 1
            ? `Focus on key concepts from part ${chunkIndex + 1} of ${numChunks} of the provided chapter text.`
            : '';

          const chunkPrompt = `You are an expert educational content generator for a school learning app.
Generate exactly ${chunkCount} high-quality, proper '${targetActivityType}' questions based strictly on the provided chapter text content.

${sectionInstruction}

Language Requirement:
${langInstruction}

JSON Output Format:
Return ONLY a valid JSON array of objects. Do NOT wrap in markdown codeblocks (no \`\`\`json).

Schema rules per activity type:
- If activity type is 'quiz':
  {"question": "Question text?", "options": ["Option 0", "Option 1", "Option 2", "Option 3"], "correct_answer": 0, "hint": "Hint text", "explanation": "Detailed explanation"}
- If activity type is 'flashcard':
  {"front": "Term / Question", "back": "Definition / Clear Answer"}
- If activity type is 'matching':
  {"pairs": [{"left": "Term 1", "right": "Match 1"}, {"left": "Term 2", "right": "Match 2"}, {"left": "Term 3", "right": "Match 3"}]}
- If activity type is 'dragndrop':
  {"sentence": "Sentence with __BLANK__ placeholder.", "answers": ["missing_word"]}
- If activity type is 'picture':
  {"image_url": "https://picsum.photos/400/300", "question": "Question text?", "options": ["Option 0", "Option 1", "Option 2", "Option 3"], "correct_answer": 0}

Chapter Text Content:
${textSubstrings}`;

          let lastErr = '';

          for (const modelEndpoint of uniqueTargets) {
            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                let response = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/${modelEndpoint}:generateContent?key=${activeApiKey}`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: [{ parts: [{ text: chunkPrompt }] }],
                      generationConfig: {
                        response_mime_type: 'application/json',
                      },
                    }),
                  }
                );

                if (!response.ok && response.status === 400) {
                  response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${modelEndpoint}:generateContent?key=${activeApiKey}`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        contents: [{ parts: [{ text: chunkPrompt }] }],
                      }),
                    }
                  );
                }

                if (response.status === 429) {
                  const errJson = await response.json().catch(() => ({}));
                  lastErr = errJson?.error?.message || 'Rate limit/Quota exceeded';
                  await new Promise((res) => setTimeout(res, 2000));
                  continue;
                }

                if (response.ok) {
                  const data = await response.json();
                  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
                  const res = JSON.parse(cleanedText);

                  if (Array.isArray(res)) {
                    return res as ContentPayload[];
                  }
                } else {
                  const errJson = await response.json().catch(() => ({}));
                  lastErr = errJson?.error?.message || `HTTP ${response.status}`;
                }
              } catch (err: any) {
                lastErr = err?.message || 'Network error';
              }
            }
          }

          throw new Error(lastErr || 'Batch generation failed across all available Gemini models');
        };

        const chunkPromises = Array.from({ length: numChunks }).map(async (_, idx) => {
          if (idx > 0) {
            await new Promise((res) => setTimeout(res, idx * 300));
          }
          return fetchChunk(idx);
        });

        const chunkResults = await Promise.all(chunkPromises);
        const allGeneratedItems = chunkResults.flat().slice(0, targetCount);

        if (allGeneratedItems.length === 0) {
          throw new Error('No valid question items returned from Gemini API.');
        }

        const elapsedSec = Math.round((Date.now() - startTime) / 1000);

        setChapterGeneratedItems((prev) => ({ ...prev, [targetChapterId]: allGeneratedItems }));
        setChapterSelectedAiItemIds((prev) => ({ ...prev, [targetChapterId]: allGeneratedItems.map((_, i) => i) }));
        toast(`Successfully generated ${allGeneratedItems.length} questions for "${chapterName}" in ${elapsedSec}s! ✨`, 'success');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'AI generation failed';
        toast(`API Error for "${chapterName}": ${message}`, 'error');
      } finally {
        setGeneratingChapters((prev) => ({ ...prev, [targetChapterId]: false }));
      }
    })();
  };

  const handleAiImport = async () => {
    if (!selectedChapter) {
      toast('Please select a destination chapter from the left sidebar first', 'warning');
      return;
    }
    const itemsToImport = (chapterGeneratedItems[selectedChapter] || []).filter((_, idx) => (chapterSelectedAiItemIds[selectedChapter] || []).includes(idx));
    if (itemsToImport.length === 0) {
      toast('Please select at least one generated item to import', 'warning');
      return;
    }

    setAiImporting(true);

    try {
      const targetActivityType = chapterActivityTypes[selectedChapter] || aiActivityType;
      const inserts = itemsToImport.map((payload) => ({
        chapter_id: selectedChapter,
        activity_type: targetActivityType,
        payload,
        created_by: profile?.id,
      }));

      const { error } = await supabase.from('content').insert(inserts);

      if (error) throw error;

      toast(`Successfully imported ${itemsToImport.length} item(s) to database! 🎉`, 'success');
      setChapterGeneratedItems((prev) => ({ ...prev, [selectedChapter]: [] }));
      setChapterSelectedAiItemIds((prev) => ({ ...prev, [selectedChapter]: [] }));
      await applyFilter();
      setActiveTab('content');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Import failed';
      toast(message, 'error');
    } finally {
      setAiImporting(false);
    }
  };

  // Upload chapter text context for selected chapter to database
  const handleUploadChapterText = async () => {
    if (!selectedChapter) {
      toast('Please select a destination chapter from the left sidebar first', 'warning');
      return;
    }
    if (!aiChapterText.trim()) {
      toast('Please enter chapter text content to upload', 'warning');
      return;
    }

    setUploadingChapterText(true);
    try {
      // Find existing chapter_text content item
      const { data: list, error: listError } = await supabase
        .from('content')
        .select('id, payload')
        .eq('chapter_id', selectedChapter);

      if (listError) throw listError;

      const existing = list?.find((item) => (item.payload as any)?._is_chapter_text === true);

      if (existing) {
        const { error } = await supabase
          .from('content')
          .update({ payload: { _is_chapter_text: true, text: aiChapterText.trim() } })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('content').insert({
          chapter_id: selectedChapter,
          activity_type: 'quiz',
          payload: { _is_chapter_text: true, text: aiChapterText.trim() },
          created_by: profile?.id,
        });
        if (error) throw error;
      }

      localStorage.setItem(`quizlee_chapter_text_${selectedChapter}`, aiChapterText.trim());
      toast('Chapter text uploaded & saved for this chapter! 📄', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast(`Upload error: ${msg}`, 'error');
    } finally {
      setUploadingChapterText(false);
    }
  };

  // Delete saved chapter text context for selected chapter from database
  const handleDeleteChapterText = async () => {
    if (!selectedChapter) {
      toast('Please select a destination chapter from the left sidebar first', 'warning');
      return;
    }

    setDeletingChapterText(true);
    try {
      const { data: list } = await supabase
        .from('content')
        .select('id, payload')
        .eq('chapter_id', selectedChapter);

      const existing = list?.find((item) => (item.payload as any)?._is_chapter_text === true);

      if (existing) {
        const { error } = await supabase
          .from('content')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
      }

      localStorage.removeItem(`quizlee_chapter_text_${selectedChapter}`);
      setAiChapterText('');
      toast('Chapter text deleted for this chapter! 🗑️', 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      toast(`Delete error: ${msg}`, 'error');
    } finally {
      setDeletingChapterText(false);
    }
  };

  // Auto-load chapter text when selectedChapter changes
  useEffect(() => {
    if (!selectedChapter) {
      setAiChapterText('');
      return;
    }

    async function loadSavedChapterText() {
      const localText = localStorage.getItem(`quizlee_chapter_text_${selectedChapter}`);
      if (localText) {
        setAiChapterText(localText);
      }

      const { data: list } = await supabase
        .from('content')
        .select('*')
        .eq('chapter_id', selectedChapter);

      const found = list?.find((item) => (item.payload as any)?._is_chapter_text === true);

      if (found && found.payload && typeof found.payload === 'object' && 'text' in found.payload) {
        const textFromDb = (found.payload as any).text || '';
        setAiChapterText(textFromDb);
        localStorage.setItem(`quizlee_chapter_text_${selectedChapter}`, textFromDb);
      } else if (!localText) {
        setAiChapterText('');
      }
    }

    loadSavedChapterText();
  }, [selectedChapter]);

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
    const rawList = (data as Content[]) || [];
    const validQuestions = rawList.filter((item) => !(item.payload as any)?._is_chapter_text);
    setContentList(validQuestions);
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

  return (
    <div className="animate-fade-in">
      {/* Mobile Toggle Button for Curriculum Explorer */}
      <button
        type="button"
        onClick={() => setShowMobileExplorer((prev) => !prev)}
        className="md:hidden flex items-center justify-between w-full px-4 py-2.5 bg-white border border-surface-200 rounded-xl mb-3 text-xs font-bold text-surface-800 shadow-2xs cursor-pointer hover:bg-surface-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-primary-600" />
          <span>Curriculum Explorer</span>
          {(selectedSchool || selectedClass || selectedSubject || selectedChapter) && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-primary-100 text-primary-700">
              Filter Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-primary-600 text-[11px] font-bold">
          <span>{showMobileExplorer ? 'Hide' : 'Show'}</span>
          <ChevronDown size={14} className={`transition-transform duration-200 ${showMobileExplorer ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <div className="flex flex-col md:flex-row gap-0 md:gap-3 items-stretch relative">
        {/* Left side: Navigation Explorer (School > Class > Subject > Chapter tree with inline management) */}
        <div
          style={{ width: isMobileScreen ? '100%' : `${leftPanelWidth}px` }}
          className={`w-full shrink-0 flex-col gap-4 bg-white p-4 rounded-xl border border-surface-200 shadow-2xs ${
            isMobileScreen && !showMobileExplorer ? 'hidden' : 'flex'
          } ${isMobileScreen ? 'max-h-[450px] mb-4' : 'max-h-[calc(100vh-140px)] min-h-[600px]'} overflow-y-auto`}
        >
          <div className="border-b border-surface-200 pb-3 mb-2 flex justify-between items-center">
            <div>
              <h2 className="text-base font-extrabold text-surface-900 uppercase tracking-wider">Curriculum Explorer</h2>
              <p className="text-xs text-surface-500 mt-0.5">Manage & filter by curriculum levels.</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setSelectedSchool('');
                  setSelectedClass('');
                  setSelectedSubject('');
                  setSelectedChapter('');
                }}
                className="text-xs text-primary bg-primary-50 hover:bg-primary-100 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setShowMobileExplorer(false)}
                className="md:hidden text-xs text-surface-600 hover:text-surface-900 bg-surface-100 hover:bg-surface-200 px-2 py-1 rounded-lg font-bold transition-all cursor-pointer"
                title="Hide Explorer"
              >
                Hide
              </button>
            </div>
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
                  className="text-xs text-emerald-600 font-bold hover:underline cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSchoolForm(false);
                    setSchoolFormValue('');
                  }}
                  className="text-xs text-slate-400 font-bold hover:underline cursor-pointer"
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
                className="text-xs text-slate-600 hover:text-primary font-bold py-1.5 flex items-center gap-1 cursor-pointer border-b border-surface-100 pb-2 mb-2 w-full text-left"
              >
                <Plus size={13} /> Add School
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
                          className="text-xs text-emerald-600 font-bold hover:underline cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSchoolId(null);
                            setSchoolFormValue('');
                          }}
                          className="text-xs text-slate-400 font-bold hover:underline cursor-pointer"
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
                          <span className="flex items-center gap-2 text-sm truncate font-semibold">
                            <SchoolIcon size={16} className={isSchoolExpanded ? 'text-primary shrink-0' : 'text-surface-400 shrink-0'} />
                            <span className="truncate">{school.name}</span>
                          </span>
                          <span className="text-xs text-surface-400 ml-1">{isSchoolExpanded ? '▼' : '▶'}</span>
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
                            <Edit size={13} />
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
                            <Trash2 size={13} />
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
                                    className={`flex-grow flex items-center gap-2 text-left py-0.5 text-sm font-semibold cursor-pointer truncate ${
                                      isClassExpanded ? 'text-primary font-bold' : 'text-slate-600'
                                    }`}
                                  >
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${isClassExpanded ? 'bg-primary-500' : 'bg-surface-300'}`} />
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
                                      <Edit size={13} />
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
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              )}

                              {isClassExpanded && (
                                <div className="pl-4 pr-1 py-0.5 space-y-0.5 ml-2 mt-0.5">
                                  {subjects.length === 0 ? (
                                    <p className="text-xs text-surface-400 pl-3 py-1 italic">No subjects</p>
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
                                                className="text-xs text-emerald-600 font-bold hover:underline cursor-pointer"
                                              >
                                                Save
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setEditingSubjectId(null);
                                                  setSubjectFormValue('');
                                                }}
                                                className="text-xs text-slate-400 font-bold hover:underline cursor-pointer"
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
                                                className={`flex-grow flex items-center gap-1.5 text-left py-0.5 text-sm font-semibold cursor-pointer truncate ${
                                                  isSubjExpanded ? 'text-primary font-bold' : 'text-slate-600'
                                                }`}
                                              >
                                                <BookOpen size={14} className={isSubjExpanded ? 'text-primary shrink-0' : 'text-slate-400 shrink-0'} />
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
                                                  <Edit size={13} />
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
                                                  <Trash2 size={13} />
                                                </button>
                                              </div>
                                            </div>
                                          )}

                                          {isSubjExpanded && (
                                            <div className="pl-3 pr-1 py-0.5 space-y-0.5 ml-2 mt-0.5">
                                              {chapters.length === 0 ? (
                                                <p className="text-xs text-surface-400 pl-2 py-1 italic">No chapters</p>
                                              ) : (
                                                chapters.map((chap, chapIdx) => {
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
                                                            className="text-xs text-emerald-600 font-bold hover:underline cursor-pointer"
                                                          >
                                                            Save
                                                          </button>
                                                          <button
                                                            type="button"
                                                            onClick={() => {
                                                              setEditingChapterId(null);
                                                              setChapterFormValue('');
                                                            }}
                                                            className="text-xs text-slate-400 font-bold hover:underline cursor-pointer"
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
                                                            className={`flex-grow flex items-center gap-1.5 text-left text-sm font-semibold cursor-pointer truncate ${
                                                              isChapSelected ? 'text-primary font-bold' : 'text-slate-600 hover:text-slate-900'
                                                            }`}
                                                          >
                                                            <span className={`text-xs font-extrabold px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1 ${
                                                              generatingChapters[chap.id]
                                                                ? 'bg-amber-500 text-white animate-pulse'
                                                                : isChapSelected
                                                                ? 'bg-primary-500 text-white'
                                                                : 'bg-surface-200 text-surface-700'
                                                            }`}>
                                                              {generatingChapters[chap.id] && <Sparkles size={11} className="animate-spin text-white" />}
                                                              C{chapIdx + 1}
                                                            </span>
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
                                                              {chap.is_locked ? <Lock size={13} /> : <Unlock size={13} />}
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
                                                              {chap.is_active ? <Eye size={13} /> : <EyeOff size={13} />}
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
                                                              <Edit size={13} />
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
                                                              <Trash2 size={13} />
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
                                                    className="text-xs text-emerald-600 font-bold hover:underline cursor-pointer"
                                                  >
                                                    Save
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setShowAddChapterFormSubjectId(null);
                                                      setChapterFormValue('');
                                                    }}
                                                    className="text-xs text-slate-400 font-bold hover:underline cursor-pointer"
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
                                                  className="text-xs text-slate-500 hover:text-primary font-bold pl-2 py-1 flex items-center gap-1 cursor-pointer"
                                                >
                                                  <Plus size={12} /> Add Chapter
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
                                        className="text-xs text-emerald-600 font-bold hover:underline cursor-pointer"
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowAddSubjectFormClassId(null);
                                          setSubjectFormValue('');
                                        }}
                                        className="text-xs text-slate-400 font-bold hover:underline cursor-pointer"
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
                                      className="text-xs text-slate-500 hover:text-primary font-bold pl-3 py-1 flex items-center gap-1 cursor-pointer"
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

        {/* Resizer Handle (Desktop only) */}
        <div
          onMouseDown={handleStartResizeLeftPanel}
          className={`hidden md:flex items-center justify-center w-3 cursor-col-resize select-none shrink-0 group z-10 hover:bg-primary-50/50 rounded-lg transition-colors ${
            isDraggingLeftPanel ? 'bg-primary-100/60' : ''
          }`}
          title="Hold & drag to resize left panel"
        >
          <div className={`w-1 h-16 rounded-full transition-all ${
            isDraggingLeftPanel
              ? 'bg-primary-600 scale-y-125 shadow-sm shadow-primary-500/50'
              : 'bg-surface-300 group-hover:bg-primary-500 group-hover:scale-y-110'
          }`} />
        </div>

        {/* Right side: Content oversight list and Bulk Import Tabs */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
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
              <button
                type="button"
                onClick={() => setActiveTab('ai')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'ai'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                    : 'text-surface-600 hover:bg-surface-100'
                }`}
              >
                <Sparkles size={15} className="text-amber-300" />
                AI Generate
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

              {/* Select All Action Banner & View Mode Toggle */}
              {!loading && contentList.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-surface-200 rounded-2xl px-4 py-2.5 text-sm shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        id="select-all"
                        checked={contentList.length > 0 && selectedIds.length === contentList.length}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                      />
                      <label htmlFor="select-all" className="font-bold text-surface-700 select-none cursor-pointer">
                        Select All ({contentList.length})
                      </label>
                    </div>
                    {selectedIds.length > 0 && (
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<Trash2 size={13} />}
                        onClick={handleBulkDelete}
                        className="py-1 px-2.5 text-xs"
                      >
                        Delete Selected ({selectedIds.length})
                      </Button>
                    )}
                  </div>

                  {/* View Density Switch */}
                  <div className="flex items-center gap-1 bg-surface-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setViewDensity('compact')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        viewDensity === 'compact'
                          ? 'bg-white text-primary-700 shadow-2xs'
                          : 'text-surface-600 hover:text-surface-900'
                      }`}
                    >
                      Compact List
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewDensity('detailed')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        viewDensity === 'detailed'
                          ? 'bg-white text-primary-700 shadow-2xs'
                          : 'text-surface-600 hover:text-surface-900'
                      }`}
                    >
                      Detailed Cards
                    </button>
                  </div>
                </div>
              )}

              {/* Content Oversight List */}
              {loading ? (
                <div className="flex justify-center py-20"><Spinner size="lg" /></div>
              ) : contentList.length === 0 ? (
                <Card className="text-center py-20 bg-white">
                  <p className="text-surface-500 font-medium">No content items found for this selection.</p>
                </Card>
              ) : viewDensity === 'compact' ? (
                /* Compact List View */
                <div className="bg-white border border-surface-200 rounded-2xl divide-y divide-surface-100 overflow-y-auto max-h-[calc(100vh-440px)] min-h-[180px] shadow-2xs">
                  {contentList.map((item, idx) => {
                    const isSelected = selectedIds.includes(item.id);
                    const previewText = getPayloadPreview(item);

                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-2.5 px-3.5 py-2 text-xs transition-colors hover:bg-surface-50 ${
                          isSelected ? 'bg-primary-50/40' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(item.id)}
                          className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500 cursor-pointer shrink-0"
                        />

                        {/* Question Index */}
                        <span className="text-[11px] font-bold text-surface-400 w-6 shrink-0 text-right">
                          #{idx + 1}
                        </span>

                        {/* Activity Badge */}
                        <span className="shrink-0">
                          <Badge
                            variant={
                              item.activity_type === 'quiz' ? 'info' :
                              item.activity_type === 'flashcard' ? 'default' :
                              (item.activity_type as string) === 'matching' ? 'success' :
                              (item.activity_type as string) === 'picture' ? 'danger' : 'warning'
                            }
                            size="sm"
                            className="text-[10px] px-2 py-0.5"
                          >
                            {item.activity_type === 'quiz' ? 'Quiz' :
                             item.activity_type === 'flashcard' ? 'Flashcard' :
                             item.activity_type === 'matching' ? 'Matching' :
                             item.activity_type === 'picture' ? 'Picture' :
                             item.activity_type === 'dragndrop' ? 'DragDrop' : item.activity_type}
                          </Badge>
                        </span>

                        {/* Question Preview Text */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-surface-800 line-clamp-2 text-xs leading-relaxed" title={previewText}>
                            {previewText}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setEditingContent(item);
                              setPayloadText(JSON.stringify(item.payload, null, 2));
                              setShowModal(true);
                            }}
                            className="p-1 hover:bg-surface-100 text-surface-600 hover:text-surface-900 rounded cursor-pointer transition-colors"
                            title="Edit Payload"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1 hover:bg-danger-50 text-danger-500 rounded cursor-pointer transition-colors"
                            title="Delete Item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Detailed Cards View */
                <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-440px)] min-h-[180px] pr-1">
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
                          Created: {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
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
          ) : activeTab === 'import' ? (
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
          ) : (
            /* AI Generation Panel */
            <div className="flex flex-col gap-4 animate-fade-in">
              {/* Active Background Generations Banner */}
              {activeGeneratingChapterIds.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs font-bold text-amber-900 shadow-2xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Sparkles size={16} className="text-amber-600 animate-spin shrink-0" />
                    <span>Background AI Generation active for {activeGeneratingChapterIds.length} chapter(s):</span>
                    {activeGeneratingChapterIds.map((cId) => {
                      const cName = chapters.find((ch) => ch.id === cId)?.name || 'Chapter';
                      const isCurrent = selectedChapter === cId;
                      return (
                        <button
                          key={cId}
                          type="button"
                          onClick={() => setSelectedChapter(cId)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-extrabold cursor-pointer transition-all flex items-center gap-1.5 ${
                            isCurrent
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                          }`}
                        >
                          <Sparkles size={12} className="animate-spin" /> {cName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Destination & Activity Setup Card */}
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

                  {/* Settings Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Activity Type Selection */}
                    <div>
                      <label className="text-xs font-bold text-surface-600 block mb-1">Activity Type</label>
                      <select
                        value={aiActivityType}
                        onChange={(e) => setAiActivityType(e.target.value as ActivityType)}
                        className="w-full text-xs font-bold px-3 py-2 border border-surface-200 rounded-xl bg-white focus:outline-none focus:border-primary-500"
                      >
                        {activities.map((act) => (
                          <option key={act.key} value={act.key}>
                            {act.emoji || '🎮'} {act.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Question Count Input */}
                    <div>
                      <label className="text-xs font-bold text-surface-600 block mb-1">Questions Count</label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={aiCount}
                        onChange={(e) => setAiCount(e.target.value)}
                        onBlur={() => {
                          const val = parseInt(String(aiCount), 10);
                          if (isNaN(val) || val < 1) setAiCount(1);
                          else if (val > 50) setAiCount(50);
                          else setAiCount(val);
                        }}
                        className="w-full text-xs font-bold px-3 py-2 border border-surface-200 rounded-xl bg-white focus:outline-none focus:border-primary-500"
                      />
                    </div>

                    {/* Gemini API Key Input */}
                    <div>
                      <label className="text-xs font-bold text-surface-600 block mb-1">Gemini API Key</label>
                      <div className="relative flex items-center">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          placeholder="Paste Gemini API Key..."
                          value={aiApiKey}
                          onChange={(e) => {
                            setAiApiKey(e.target.value);
                            localStorage.setItem('quizlee_gemini_api_key', e.target.value);
                          }}
                          className="w-full text-xs font-mono px-3 py-2 pr-9 border border-surface-200 rounded-xl bg-white focus:outline-none focus:border-primary-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2 text-surface-400 hover:text-surface-700 p-1 rounded transition-colors cursor-pointer"
                          title={showApiKey ? 'Hide API Key' : 'Show API Key'}
                        >
                          {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Text Import Area */}
              <Card className="bg-white">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-surface-600 uppercase tracking-wider">
                      Paste / Import Whole Chapter Text
                    </label>
                    <span className="text-xs text-surface-400 font-mono">
                      {aiChapterText.length} characters | {aiChapterText.split(/\s+/).filter(Boolean).length} words
                    </span>
                  </div>
                  <textarea
                    value={aiChapterText}
                    onChange={(e) => setAiChapterText(e.target.value)}
                    rows={6}
                    className="w-full px-4 py-3 rounded-xl border-2 border-surface-200 bg-white text-surface-800 text-xs leading-relaxed focus:outline-none focus:border-primary-400"
                    placeholder="Paste the raw text format of the chapter here (e.g. textbook notes, story text, definitions, or study material)..."
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 mt-2 pt-2 border-t border-surface-100">
                    {/* Left aligned: Upload & Delete chapter text */}
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleUploadChapterText}
                        loading={uploadingChapterText}
                        disabled={!selectedChapter || !aiChapterText.trim()}
                        icon={<Upload size={14} />}
                        className="font-bold text-xs"
                        title="Upload & save chapter text to database"
                      >
                        Upload
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleDeleteChapterText}
                        loading={deletingChapterText}
                        disabled={!selectedChapter || !aiChapterText.trim()}
                        icon={<Trash2 size={14} />}
                        className="font-bold text-xs text-danger-600 hover:bg-danger-50"
                        title="Delete saved chapter text from database"
                      >
                        Delete
                      </Button>
                    </div>

                    {/* Right aligned: Generate button */}
                    <Button
                      onClick={handleGenerateAiQuestions}
                      loading={isCurrentChapterGenerating}
                      disabled={!aiChapterText.trim() || !selectedChapter}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold"
                      icon={<Sparkles size={16} />}
                    >
                      {isCurrentChapterGenerating ? 'Generating...' : 'Generate ✨'}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Generated Results compact list */}
              {generatedItems.length > 0 && (
                <div className="flex flex-col gap-3 animate-fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-surface-200 rounded-2xl px-4 py-2.5 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="select-all-ai"
                        checked={selectedAiItemIds.length === generatedItems.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAiItemIds(generatedItems.map((_, i) => i));
                          } else {
                            setSelectedAiItemIds([]);
                          }
                        }}
                        className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                      />
                      <label htmlFor="select-all-ai" className="font-bold text-xs text-surface-800 select-none cursor-pointer">
                        Select All Generated ({generatedItems.length} items)
                      </label>
                    </div>

                    <Button
                      onClick={handleAiImport}
                      loading={aiImporting}
                      disabled={selectedAiItemIds.length === 0 || !selectedChapter}
                      icon={<Upload size={15} />}
                      className="font-bold text-xs"
                    >
                      Import {selectedAiItemIds.length} Selected to Database 🚀
                    </Button>
                  </div>

                  {/* Compact list of generated questions */}
                  <div className="bg-white border border-surface-200 rounded-2xl divide-y divide-surface-100 overflow-y-auto max-h-[calc(100vh-440px)] min-h-[180px] shadow-2xs">
                    {generatedItems.map((payload: any, idx: number) => {
                      const isSelected = selectedAiItemIds.includes(idx);
                      const tempContentItem: Content = {
                        id: `temp-${idx}`,
                        chapter_id: selectedChapter,
                        activity_type: aiActivityType,
                        payload,
                        created_by: profile?.id || '',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      };
                      const previewText = getPayloadPreview(tempContentItem);

                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-2.5 px-3.5 py-2 text-xs transition-colors hover:bg-surface-50 ${
                            isSelected ? 'bg-primary-50/40' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedAiItemIds((prev) =>
                                prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                              );
                            }}
                            className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500 cursor-pointer shrink-0"
                          />

                          <span className="text-[11px] font-bold text-surface-400 w-6 shrink-0 text-right">
                            #{idx + 1}
                          </span>

                          <span className="shrink-0">
                            <Badge variant="info" size="sm" className="text-[10px] px-2 py-0.5">
                              {aiActivityType}
                            </Badge>
                          </span>

                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-surface-800 line-clamp-2 text-xs leading-relaxed" title={previewText}>
                              {previewText}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setEditingContent(tempContentItem);
                                setPayloadText(JSON.stringify(payload, null, 2));
                                setShowModal(true);
                              }}
                              className="p-1 hover:bg-surface-100 text-surface-600 hover:text-surface-900 rounded cursor-pointer transition-colors"
                              title="Edit Payload"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setGeneratedItems((prev) => prev.filter((_, i) => i !== idx));
                                setSelectedAiItemIds((prev) => prev.filter((i) => i !== idx));
                              }}
                              className="p-1 hover:bg-danger-50 text-danger-500 rounded cursor-pointer transition-colors"
                              title="Remove Item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
