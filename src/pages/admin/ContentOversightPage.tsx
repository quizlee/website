import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/Toast';
import type { Content, School, Class, Subject, Chapter, Activity } from '../../lib/types';
import { Trash2, Edit, Play, BookOpen, School as SchoolIcon } from 'lucide-react';

export default function ContentOversightPage() {
  const [contentList, setContentList] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

    const { data } = await query.order('created_at', { ascending: false }).limit(100);
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
        {/* Left side: Navigation Explorer (School > Class > Subject > Chapter tree) */}
        <div className="md:col-span-3 flex flex-col gap-4 max-h-[calc(100vh-140px)] min-h-[600px] overflow-y-auto bg-white p-4">
          <div className="border-b border-surface-200 pb-3 mb-2 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-surface-800 uppercase tracking-wider">Curriculum Explorer</h2>
              <p className="text-xs text-surface-400 mt-1">Select a chapter to see its content.</p>
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
            {schools.length === 0 ? (
              <p className="text-xs text-surface-400 text-center py-4">No schools found.</p>
            ) : (
              schools.map((school) => {
                const isSchoolExpanded = selectedSchool === school.id;
                return (
                  <div key={school.id} className="bg-white">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSchool(isSchoolExpanded ? '' : school.id);
                        setSelectedClass('');
                        setSelectedSubject('');
                        setSelectedChapter('');
                      }}
                      className={`w-full flex items-center justify-between py-1 text-left transition-colors cursor-pointer ${
                        isSchoolExpanded ? 'text-primary-600 font-bold' : 'hover:text-surface-900 text-surface-700 font-semibold'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-xs">
                        <SchoolIcon size={14} className={isSchoolExpanded ? 'text-primary' : 'text-surface-400'} />
                        {school.name}
                      </span>
                      <span className="text-[10px] text-surface-400">{isSchoolExpanded ? '▼' : '▶'}</span>
                    </button>

                    {isSchoolExpanded && (
                      <div className="py-0.5 bg-white space-y-0.5">
                        {classes.map((cls) => {
                          const isClassExpanded = selectedClass === cls.id;
                          return (
                            <div key={cls.id} className="overflow-hidden">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedClass(isClassExpanded ? '' : cls.id);
                                  setSelectedSubject('');
                                  setSelectedChapter('');
                                }}
                                className={`w-full flex items-center gap-2 text-left pl-4 pr-3 py-0.5 text-xs font-semibold cursor-pointer ${
                                  isClassExpanded ? 'text-primary font-bold' : 'text-slate-600'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${isClassExpanded ? 'bg-primary-500' : 'bg-surface-300'}`} />
                                {cls.name}
                              </button>

                              {isClassExpanded && (
                                <div className="pl-6 pr-2 py-0.5 space-y-0.5 ml-3 mt-0.5">
                                  {subjects.length === 0 ? (
                                    <p className="text-[10px] text-surface-400 pl-4 py-1 italic">No subjects</p>
                                  ) : (
                                    subjects.map((subj) => {
                                      const isSubjExpanded = selectedSubject === subj.id;
                                      return (
                                        <div key={subj.id}>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedSubject(isSubjExpanded ? '' : subj.id);
                                              setSelectedChapter('');
                                            }}
                                            className={`w-full flex items-center gap-2 text-left py-0.5 text-xs font-semibold cursor-pointer ${
                                              isSubjExpanded ? 'text-primary font-bold' : 'text-slate-500'
                                            }`}
                                          >
                                            <BookOpen size={11} className={isSubjExpanded ? 'text-primary' : 'text-slate-400'} />
                                            {subj.name}
                                          </button>

                                          {isSubjExpanded && (
                                            <div className="pl-6 pr-2 py-0.5 space-y-0.5 ml-3 mt-0.5">
                                              {chapters.length === 0 ? (
                                                <p className="text-[10px] text-surface-400 pl-4 py-1 italic">No chapters</p>
                                              ) : (
                                                chapters.map((chap) => {
                                                  const isChapSelected = selectedChapter === chap.id;
                                                  return (
                                                    <button
                                                      key={chap.id}
                                                      type="button"
                                                      onClick={() => {
                                                        setSelectedChapter(isChapSelected ? '' : chap.id);
                                                      }}
                                                      className={`w-full flex items-center gap-1.5 py-0.5 text-left text-xs font-semibold cursor-pointer ${
                                                        isChapSelected ? 'text-primary font-bold' : 'text-slate-400'
                                                      }`}
                                                    >
                                                      <span className={`w-1 h-1 rounded-full ${isChapSelected ? 'bg-primary-500' : 'bg-surface-300'}`} />
                                                      {chap.name}
                                                    </button>
                                                  );
                                                })
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right side: Content oversight list and Activity filter */}
        <div className="md:col-span-9 flex flex-col gap-4 max-h-[calc(100vh-140px)] overflow-y-auto">
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
