import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { toast } from '../../components/ui/Toast';
import type { Class, Subject, Chapter, Content, ActivityType } from '../../lib/types';
import { Plus, Edit, Trash2, Filter } from 'lucide-react';

export default function ContentManagerPage() {
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(true);

  // Curriculum data
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [contentList, setContentList] = useState<Content[]>([]);

  // Filters
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingContent, setEditingContent] = useState<Content | null>(null);
  const [activityType, setActivityType] = useState<ActivityType>('quiz');
  const [payloadText, setPayloadText] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch classes
  useEffect(() => {
    supabase
      .from('classes')
      .select('*')
      .order('sort_order')
      .then(({ data }) => {
        if (data) setClasses(data);
        setLoading(false);
      });
  }, []);

  // Fetch subjects
  useEffect(() => {
    if (!selectedClass) { setSubjects([]); return; }
    supabase.from('subjects').select('*').eq('class_id', selectedClass).eq('school_id', profile?.school_id).order('name')
      .then(({ data }) => { if (data) setSubjects(data); });
  }, [selectedClass, profile]);

  useEffect(() => {
    if (!selectedSubject) { setChapters([]); return; }
    supabase.from('chapters').select('*').eq('subject_id', selectedSubject).order('sort_order').order('created_at')
      .then(({ data }) => { if (data) setChapters(data); });
  }, [selectedSubject]);

  // Fetch content
  useEffect(() => {
    if (!selectedChapter) { setContentList([]); return; }
    supabase
      .from('content')
      .select('*')
      .eq('chapter_id', selectedChapter)
      .eq('created_by', profile?.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setContentList(data as Content[]);
      });
  }, [selectedChapter, profile]);

  async function handleSaveContent() {
    if (!selectedChapter || !profile) return;
    setSaving(true);

    try {
      const payload = JSON.parse(payloadText);

      if (editingContent) {
        const { error } = await supabase
          .from('content')
          .update({ payload, activity_type: activityType })
          .eq('id', editingContent.id);
        if (error) throw error;

        // Log the edit
        await supabase.from('activity_log').insert({
          teacher_id: profile.id,
          action_type: 'update',
          target_table: 'content',
          target_id: editingContent.id,
          description: `Updated ${activityType} question`,
        });

        toast('Content updated!', 'success');
      } else {
        const { error } = await supabase
          .from('content')
          .insert({
            chapter_id: selectedChapter,
            activity_type: activityType,
            payload,
            created_by: profile.id,
          });
        if (error) throw error;

        // Log the creation
        await supabase.from('activity_log').insert({
          teacher_id: profile.id,
          action_type: 'create',
          target_table: 'content',
          target_id: null,
          description: `Created new ${activityType} question`,
        });

        toast('Content added!', 'success');
      }

      // Refresh
      const { data } = await supabase
        .from('content')
        .select('*')
        .eq('chapter_id', selectedChapter)
        .eq('created_by', profile.id)
        .order('created_at', { ascending: false });
      if (data) setContentList(data as Content[]);

      setShowModal(false);
      setEditingContent(null);
      setPayloadText('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid JSON payload';
      toast(message, 'error');
    }
    setSaving(false);
  }

  async function handleDelete(content: Content) {
    if (!confirm('Are you sure you want to delete this content?')) return;

    const { error } = await supabase.from('content').delete().eq('id', content.id);
    if (error) {
      toast(error.message, 'error');
      return;
    }

    await supabase.from('activity_log').insert({
      teacher_id: profile!.id,
      action_type: 'delete',
      target_table: 'content',
      target_id: content.id,
      description: `Deleted ${content.activity_type} question`,
    });

    setContentList((prev) => prev.filter((c) => c.id !== content.id));
    toast('Content deleted', 'info');
  }

  function openEditModal(content: Content) {
    setEditingContent(content);
    setActivityType(content.activity_type);
    setPayloadText(JSON.stringify(content.payload, null, 2));
    setShowModal(true);
  }

  function openNewModal() {
    setEditingContent(null);
    setActivityType('quiz');
    setPayloadText(getTemplate('quiz'));
    setShowModal(true);
  }

  function getTemplate(type: ActivityType): string {
    const templates: Record<ActivityType, object> = {
      quiz: { question: 'What is 2+2?', options: ['3', '4', '5', '6'], correct_answer: 1, hint: 'Think simple!', explanation: '2+2 equals 4' },
      flashcard: { front: 'What is the capital of India?', back: 'New Delhi' },
      matching: { pairs: [{ left: 'H2O', right: 'Water' }, { left: 'CO2', right: 'Carbon Dioxide' }] },
      picture: { image_url: 'https://example.com/image.jpg', question: 'What animal is this?', options: ['Dog', 'Cat', 'Bird', 'Fish'], correct_answer: 0 },
      dragndrop: { sentence: 'The solar system has __BLANK__ planets, and the largest one is __BLANK__.', answers: ['eight', 'Jupiter'] },
    };
    return JSON.stringify(templates[type], null, 2);
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-surface-900">Content Manager ✏️</h1>
          <p className="text-surface-500">Create and manage your learning content</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-surface-500" />
          <span className="text-sm font-semibold text-surface-600">Navigate Curriculum</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            placeholder="Select Class"
            value={selectedClass}
            onChange={(e) => { setSelectedClass(e.target.value); setSelectedSubject(''); setSelectedChapter(''); }}
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Select
            placeholder="Select Subject"
            value={selectedSubject}
            onChange={(e) => { setSelectedSubject(e.target.value); setSelectedChapter(''); }}
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            disabled={!selectedClass}
          />
          <Select
            placeholder="Select Chapter"
            value={selectedChapter}
            onChange={(e) => setSelectedChapter(e.target.value)}
            options={chapters.map((c) => ({ value: c.id, label: c.name }))}
            disabled={!selectedSubject}
          />
        </div>
      </Card>

      {/* Content List */}
      {selectedChapter && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-surface-900">
              Questions ({contentList.length})
            </h2>
            <Button size="sm" icon={<Plus size={16} />} onClick={openNewModal}>
              Add Content
            </Button>
          </div>

          {contentList.length === 0 ? (
            <Card className="text-center py-12">
              <div className="text-4xl mb-3">📝</div>
              <p className="text-surface-500">No content yet. Click "Add Content" to create questions!</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {contentList.map((item) => (
                <Card key={item.id} className="flex items-center gap-4" padding="sm">
                  <Badge variant="info" size="sm">{item.activity_type}</Badge>
                  <p className="flex-1 text-sm text-surface-700 truncate">
                    {JSON.stringify(item.payload).slice(0, 100)}...
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-2 text-surface-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 cursor-pointer"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-2 text-surface-400 hover:text-danger-600 rounded-lg hover:bg-danger-50 cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingContent ? 'Edit Content' : 'Add Content'}
        size="lg"
      >
        <div className="flex flex-col gap-4">
          <Select
            label="Activity Type"
            value={activityType}
            onChange={(e) => {
              const type = e.target.value as ActivityType;
              setActivityType(type);
              if (!editingContent) setPayloadText(getTemplate(type));
            }}
            options={[
              { value: 'quiz', label: 'Quiz' },
              { value: 'flashcard', label: 'Flashcard' },
              { value: 'matching', label: 'Matching' },
              { value: 'picture', label: 'Picture Game' },
              { value: 'dragndrop', label: 'Drag & Drop' },
            ]}
          />

          <div>
            <label className="text-sm font-semibold text-surface-700 block mb-1.5">
              Content Payload (JSON)
            </label>
            <textarea
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              rows={12}
              className="w-full px-4 py-3 rounded-xl border-2 border-surface-200 bg-white text-surface-800 font-mono text-sm focus:outline-none focus:border-primary-400 focus:ring-3 focus:ring-primary-100 resize-y"
              placeholder="Enter JSON payload..."
            />
          </div>

          <Button
            size="lg"
            loading={saving}
            onClick={handleSaveContent}
            className="w-full"
          >
            {editingContent ? 'Update Content' : 'Save Content'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
