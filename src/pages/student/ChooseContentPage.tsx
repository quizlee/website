import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import type { Subject, Chapter } from '../../lib/types';
import { ChevronRight, Check, Play } from 'lucide-react';

export default function ChooseContentPage() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  const [selectedClass, setSelectedClass] = useState<string>(profile?.class_id || '');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);

  // Sync selectedClass with profile.class_id when profile loads
  useEffect(() => {
    if (profile?.class_id) {
      setSelectedClass(profile.class_id);
    }
  }, [profile?.class_id]);

  // Fetch subjects when class changes
  useEffect(() => {
    if (!selectedClass) {
      setSubjects([]);
      return;
    }
    setSelectedSubject('');
    setSelectedChapters([]);
    setLoading(true);

    supabase
      .from('subjects')
      .select('*')
      .eq('class_id', selectedClass)
      .eq('school_id', profile?.school_id)
      .order('name')
      .then(({ data }) => {
        if (data) setSubjects(data);
        setLoading(false);
      });
  }, [selectedClass, profile]);

  // Fetch chapters when subject changes
  useEffect(() => {
    if (!selectedSubject) {
      setChapters([]);
      return;
    }
    setSelectedChapters([]);

    supabase
      .from('chapters')
      .select('*')
      .eq('subject_id', selectedSubject)
      .order('sort_order')
      .order('created_at')
      .then(({ data }) => {
        if (data) setChapters(data);
      });
  }, [selectedSubject]);

  function handleToggleChapter(chapterId: string) {
    setSelectedChapters((prev) =>
      prev.includes(chapterId)
        ? prev.filter((id) => id !== chapterId)
        : [...prev, chapterId]
    );
  }

  function handleContinue() {
    const params = new URLSearchParams();
    selectedChapters.forEach((id) => params.append('chapters', id));
    navigate(`/student/activity?${params.toString()}`);
  }

  if (!profile?.class_id) {
    return (
      <div className="flex justify-center items-center py-20 animate-fade-in">
        <Card className="text-center py-12 max-w-lg mx-auto">
          <span className="text-4xl mb-4 block">🏫</span>
          <h2 className="text-lg font-bold text-surface-900 mb-2">Class Not Selected</h2>
          <p className="text-surface-500 mb-6">
            Please select your class in your account settings first so we can load your curriculum.
          </p>
          <Button onClick={() => navigate('/student/account')}>Go to Account Settings</Button>
        </Card>
      </div>
    );
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
      <h1 className="text-2xl font-extrabold text-surface-900 mb-2">Choose Content 📖</h1>
      <p className="text-surface-500 mb-8">Select what you want to learn today</p>

      {/* Step 1: Subject */}
      <div className="mb-6 animate-fade-in">
        <h2 className="text-sm font-bold text-surface-600 uppercase tracking-wide mb-3">
          1. Select Subject
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {subjects.map((subject) => (
            <Card
              key={subject.id}
              hover
              onClick={() => setSelectedSubject(subject.id)}
              className={`flex items-center justify-between cursor-pointer ${
                selectedSubject === subject.id
                  ? 'ring-2 ring-primary-500 bg-primary-50/50'
                  : ''
              }`}
              padding="sm"
            >
              <span className="font-semibold text-surface-800">{subject.name}</span>
              <ChevronRight size={18} className="text-surface-400" />
            </Card>
          ))}
        </div>
        {subjects.length === 0 && (
          <p className="text-surface-400 text-center py-6">No subjects available for your class.</p>
        )}
      </div>

      {/* Step 2: Chapters (multi-select) */}
      {selectedSubject && (
        <div className="mb-8 animate-fade-in">
          <h2 className="text-sm font-bold text-surface-600 uppercase tracking-wide mb-3">
            2. Select Chapters
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {chapters.map((chapter) => {
              const isSelected = selectedChapters.includes(chapter.id);
              return (
                <Card
                  key={chapter.id}
                  hover
                  onClick={() => handleToggleChapter(chapter.id)}
                  className={`flex items-center justify-between cursor-pointer border-2 transition-all ${
                    isSelected ? 'border-primary-500 bg-primary-50/20' : 'border-surface-200'
                  }`}
                  padding="sm"
                >
                  <span className="font-medium text-surface-800">{chapter.name}</span>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                      isSelected
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : 'border-surface-300'
                    }`}
                  >
                    {isSelected && <Check size={14} />}
                  </div>
                </Card>
              );
            })}
          </div>
          {chapters.length === 0 && (
            <p className="text-surface-400 text-center py-6">No chapters available for this subject.</p>
          )}

          {selectedChapters.length > 0 && (
            <Button
              size="lg"
              className="w-full sm:w-auto animate-fade-in cursor-pointer"
              onClick={handleContinue}
              icon={<Play size={18} />}
            >
              Start Learning ({selectedChapters.length} Selected)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
