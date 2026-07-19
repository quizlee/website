import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { toast } from '../../components/ui/Toast';
import type { School, Class, Subject, Chapter } from '../../lib/types';
import { Plus, Edit, Trash2, School as SchoolIcon, BookOpen, Lock, Unlock, Eye, EyeOff } from 'lucide-react';

export default function CurriculumPage() {
  const [loading, setLoading] = useState(true);

  // Data lists
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // Selection states
  const [selectedSchool, setSelectedSchool] = useState(() => sessionStorage.getItem('curriculum_selected_school') || '');
  const [selectedClass, setSelectedClass] = useState(() => sessionStorage.getItem('curriculum_selected_class') || '');
  const [selectedSubject, setSelectedSubject] = useState(() => sessionStorage.getItem('curriculum_selected_subject') || '');

  // Form states
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Inline School state management
  const [showAddSchoolForm, setShowAddSchoolForm] = useState(false);
  const [editingSchoolId, setEditingSchoolId] = useState<string | null>(null);
  const [schoolFormValue, setSchoolFormValue] = useState('');

  // Inline Class / Subject state management
  const [showAddClassFormSchoolId, setShowAddClassFormSchoolId] = useState<string | null>(null);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [classFormValue, setClassFormValue] = useState('');

  const [showAddSubjectFormClassId, setShowAddSubjectFormClassId] = useState<string | null>(null);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [subjectFormValue, setSubjectFormValue] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    sessionStorage.setItem('curriculum_selected_school', selectedSchool);
  }, [selectedSchool]);

  useEffect(() => {
    sessionStorage.setItem('curriculum_selected_class', selectedClass);
  }, [selectedClass]);

  useEffect(() => {
    sessionStorage.setItem('curriculum_selected_subject', selectedSubject);
  }, [selectedSubject]);

  async function fetchInitialData() {
    setLoading(true);
    const [sData, cData] = await Promise.all([
      supabase.from('schools').select('*').order('name'),
      supabase.from('classes').select('*').order('sort_order'),
    ]);

    setSchools(sData.data as School[] || []);
    setClasses(cData.data as Class[] || []);
    setLoading(false);
  }

  // Fetch subjects when selectedClass changes
  useEffect(() => {
    if (!selectedClass) {
      setSubjects([]);
      return;
    }

    let query = supabase.from('subjects').select('*').eq('class_id', selectedClass);
    if (selectedSchool) {
      query = query.eq('school_id', selectedSchool);
    }

    query.order('name').then(({ data }) => setSubjects(data as Subject[] || []));
  }, [selectedClass, selectedSchool]);

  // Fetch chapters when selectedSubject changes
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (!selectedSubject) { toast('Please select a Subject first', 'warning'); return; }
      if (editingId) {
        const { error } = await supabase.from('chapters').update({ name, subject_id: selectedSubject }).eq('id', editingId);
        if (error) throw error;
        setChapters((prev) => prev.map((c) => (c.id === editingId ? { ...c, name, subject_id: selectedSubject } : c)));
        toast('Chapter updated', 'success');
      } else {
        const { data, error } = await supabase.from('chapters').insert({ name, subject_id: selectedSubject }).select().single();
        if (error) throw error;
        if (data) setChapters((prev) => [...prev, data as Chapter]);
        toast('Chapter added', 'success');
      }

      setName('');
      setEditingId(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Operation failed';
      toast(message, 'error');
    }
  }

  async function handleDelete(id: string, tab: 'schools' | 'classes' | 'subjects' | 'chapters') {
    if (!confirm('Are you sure you want to delete this? This action will cascade delete child data!')) return;

    try {
      const { error } = await supabase.from(tab).delete().eq('id', id);
      if (error) throw error;

      if (tab === 'schools') setSchools((prev) => prev.filter((x) => x.id !== id));
      else if (tab === 'classes') setClasses((prev) => prev.filter((x) => x.id !== id));
      else if (tab === 'subjects') setSubjects((prev) => prev.filter((x) => x.id !== id));
      else if (tab === 'chapters') setChapters((prev) => prev.filter((x) => x.id !== id));

      toast('Deleted successfully', 'info');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Deletion failed';
      toast(message, 'error');
    }
  }

  function handleEdit(item: { id: string; name: string }) {
    setEditingId(item.id);
    setName(item.name);
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

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  return <div className="animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        {/* Left side: Navigation Explorer (School > Class > Subject tree) */}
        <div className="md:col-span-3 flex flex-col gap-4 max-h-[calc(100vh-140px)] min-h-[600px] overflow-y-auto bg-white p-4">
          <div className="border-b border-surface-200 pb-3 mb-2">
            <h2 className="text-sm font-bold text-surface-800 uppercase tracking-wider">Curriculum Explorer</h2>
            <p className="text-xs text-surface-400 mt-1">Select a school, class, and subject to view chapters.</p>
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
                  className="text-xs border-b border-primary-300 focus:border-primary-500 focus:outline-none py-0.5 w-40 bg-transparent font-medium"
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
              <p className="text-sm text-surface-400 text-center py-4">No schools found.</p>
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
                      <div className="flex items-center justify-between hover:bg-surface-50 group">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSchool(isSchoolExpanded ? '' : school.id);
                            setSelectedClass('');
                            setSelectedSubject('');
                            setName('');
                            setEditingId(null);
                          }}
                          className={`flex-grow flex items-center justify-between py-1 text-left transition-colors cursor-pointer ${
                            isSchoolExpanded ? 'text-primary-600 font-bold' : 'hover:text-surface-900 text-surface-700 font-semibold'
                          }`}
                        >
                          <span className="flex items-center gap-2 text-xs">
                            <SchoolIcon size={15} className={isSchoolExpanded ? 'text-primary' : 'text-surface-400'} />
                            {school.name}
                          </span>
                          <span className="text-[10px] text-surface-400">{isSchoolExpanded ? '▼' : '▶'}</span>
                        </button>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSchoolId(school.id);
                              setSchoolFormValue(school.name);
                            }}
                            className="p-1 text-slate-400 hover:text-primary cursor-pointer"
                            title="Edit School"
                          >
                            <Edit size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(school.id, 'schools');
                            }}
                            className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
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
                                <div className="flex gap-1.5 pl-6 py-1 items-center">
                                  <input
                                    type="text"
                                    value={classFormValue}
                                    onChange={(e) => setClassFormValue(e.target.value)}
                                    className="text-xs border-b border-primary-300 focus:border-primary-500 focus:outline-none py-0.5 w-32 bg-transparent font-medium"
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
                                <div className="flex items-center justify-between pl-4 pr-3 py-0.5 hover:bg-surface-50 group">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedClass(isClassExpanded ? '' : cls.id);
                                      setSelectedSubject('');
                                      setName('');
                                      setEditingId(null);
                                    }}
                                    className={`flex-grow flex items-center gap-2 text-left py-0.5 text-xs font-semibold cursor-pointer ${
                                      isClassExpanded ? 'text-primary font-bold' : 'text-slate-600'
                                    }`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${isClassExpanded ? 'bg-primary-500' : 'bg-surface-300'}`} />
                                    {cls.name}
                                  </button>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingClassId(cls.id);
                                        setClassFormValue(cls.name);
                                      }}
                                      className="p-1 text-slate-400 hover:text-primary cursor-pointer"
                                      title="Edit Class"
                                    >
                                      <Edit size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(cls.id, 'classes');
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                                      title="Delete Class"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>
                              )}

                              {isClassExpanded && (
                                <div className="pl-6 pr-2 py-1 space-y-0.5 ml-3 mt-0.5">
                                  {subjects.length === 0 ? (
                                    <p className="text-[10px] text-surface-400 pl-4 py-1 italic">No subjects</p>
                                  ) : (
                                    subjects.map((subj) => {
                                      const isSubjSelected = selectedSubject === subj.id;
                                      const isEditingSubj = editingSubjectId === subj.id;
                                      return (
                                        <div key={subj.id}>
                                          {isEditingSubj ? (
                                            <div className="flex gap-1.5 pl-6 py-1 items-center">
                                              <input
                                                type="text"
                                                value={subjectFormValue}
                                                onChange={(e) => setSubjectFormValue(e.target.value)}
                                                className="text-xs border-b border-primary-300 focus:border-primary-500 focus:outline-none py-0.5 w-32 bg-transparent font-medium"
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
                                            <div className="flex items-center justify-between pl-4 pr-3 py-0.5 hover:bg-surface-50 group">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setSelectedSubject(subj.id);
                                                  setName('');
                                                  setEditingId(null);
                                                }}
                                                className={`flex-grow flex items-center gap-2 text-left py-0.5 text-xs font-semibold cursor-pointer ${
                                                  isSubjSelected ? 'text-primary font-bold' : 'text-slate-500'
                                                }`}
                                              >
                                                <BookOpen size={11} className={isSubjSelected ? 'text-primary' : 'text-slate-400'} />
                                                {subj.name}
                                              </button>
                                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingSubjectId(subj.id);
                                                    setSubjectFormValue(subj.name);
                                                  }}
                                                  className="p-1 text-slate-400 hover:text-primary cursor-pointer"
                                                  title="Edit Subject"
                                                >
                                                  <Edit size={11} />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(subj.id, 'subjects');
                                                  }}
                                                  className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                                                  title="Delete Subject"
                                                >
                                                  <Trash2 size={11} />
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                  )}

                                  {/* Add Subject Inline Form */}
                                  {showAddSubjectFormClassId === cls.id ? (
                                    <div className="flex gap-1.5 pl-6 py-1 items-center">
                                      <input
                                        type="text"
                                        placeholder="New subject..."
                                        value={subjectFormValue}
                                        onChange={(e) => setSubjectFormValue(e.target.value)}
                                        className="text-xs border-b border-primary-300 focus:border-primary-500 focus:outline-none py-0.5 w-32 bg-transparent font-medium"
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
                                      className="text-[10px] text-slate-400 hover:text-primary font-bold pl-6 py-1.5 flex items-center gap-1 cursor-pointer"
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
                          <div className="flex gap-1.5 pl-6 py-1 items-center">
                            <input
                              type="text"
                              placeholder="New class..."
                              value={classFormValue}
                              onChange={(e) => setClassFormValue(e.target.value)}
                              className="text-xs border-b border-primary-300 focus:border-primary-500 focus:outline-none py-0.5 w-32 bg-transparent font-medium"
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
                            className="text-[10px] text-slate-400 hover:text-primary font-bold pl-6 py-1.5 flex items-center gap-1 cursor-pointer"
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

        {/* Right side: Chapters Management */}
        <div className="md:col-span-9 flex flex-col gap-6">
          {!selectedSubject ? (
            <div className="flex flex-col items-center justify-center text-center py-20 text-surface-400 bg-surface-50/50 h-full">
              <BookOpen size={48} className="mb-4 text-surface-300" />
              <h3 className="font-bold text-surface-600 mb-1">No Subject Selected</h3>
              <p className="text-xs max-w-xs text-surface-400 px-4">
                Choose a school, class, and subject from the curriculum explorer on the left to start managing chapters.
              </p>
            </div>
          ) : (
            <div className="flex-grow flex flex-col gap-4 bg-white p-4">
              <div className="flex items-center justify-between border-b border-surface-100 pb-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">Chapters List</span>
                  <h3 className="text-base font-bold text-surface-900 mt-0.5">
                    {subjects.find((s) => s.id === selectedSubject)?.name || 'Subject'} Chapters
                  </h3>
                </div>
              </div>

              {/* Inline Add/Edit Form */}
              <form onSubmit={handleSubmit} className="flex gap-2 bg-surface-50 p-3">
                <div className="flex-1">
                  <Input
                    placeholder="e.g. Chapter 1: Fractions"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="bg-white text-surface-900"
                  />
                </div>
                <div className="flex items-end gap-1.5">
                  <Button type="submit" icon={editingId ? <Edit size={16} /> : <Plus size={16} />}>
                    {editingId ? 'Update' : 'Add'}
                  </Button>
                  {editingId && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditingId(null);
                        setName('');
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>

              {/* List of Chapters */}
              <div className="flex flex-col gap-2 max-h-[calc(100vh-280px)] min-h-[450px] overflow-y-auto pr-1">
                {chapters.length === 0 ? (
                  <p className="text-sm text-surface-400 text-center py-10">
                    No chapters created for this subject yet. Add one above!
                  </p>
                ) : (
                  chapters.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center bg-white py-1.5 border-b border-surface-100 transition-all"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs text-surface-400 font-semibold uppercase tracking-wider">Chapter {idx + 1}</span>
                        <span className="font-semibold text-surface-800 text-sm mt-0.5">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Lock/Unlock Toggle */}
                        <button
                          type="button"
                          onClick={() => toggleChapterLock(item.id, item.is_locked)}
                          className={`flex items-center gap-1.5 py-1 text-xs font-bold transition-all duration-200 cursor-pointer ${
                            item.is_locked
                              ? 'text-rose-600 hover:text-rose-700'
                              : 'text-emerald-600 hover:text-emerald-700'
                          }`}
                          title={item.is_locked ? 'Click to Unlock' : 'Click to Lock'}
                        >
                          {item.is_locked ? <Lock size={12} /> : <Unlock size={12} />}
                          <span>{item.is_locked ? 'Locked' : 'Unlocked'}</span>
                        </button>

                        {/* Active/Inactive Toggle */}
                        <button
                          type="button"
                          onClick={() => toggleChapterActive(item.id, item.is_active)}
                          className={`flex items-center gap-1.5 py-1 text-xs font-bold transition-all duration-200 cursor-pointer ${
                            item.is_active
                              ? 'text-emerald-600 hover:text-emerald-700'
                              : 'text-slate-400 hover:text-slate-500'
                          }`}
                          title={item.is_active ? 'Click to Deactivate' : 'Click to Activate'}
                        >
                          {item.is_active ? <Eye size={12} /> : <EyeOff size={12} />}
                          <span>{item.is_active ? 'Active' : 'Inactive'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="p-2 hover:bg-surface-50 text-surface-500 hover:text-primary cursor-pointer transition-colors"
                          title="Edit Name"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id, 'chapters')}
                          className="p-2 hover:bg-danger-50 text-danger-500 cursor-pointer transition-colors"
                          title="Delete Chapter"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>;
}
