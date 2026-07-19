import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Spinner } from '../../components/ui/Spinner';
import { toast } from '../../components/ui/Toast';
import type { Class, Subject, Chapter, ActivityType, ContentPayload } from '../../lib/types';
import { Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface ValidationError {
  line: number;
  message: string;
}

export default function BulkImportPage() {
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>('quiz');
  const [inputText, setInputText] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [parsedData, setParsedData] = useState<ContentPayload[]>([]);
  const [isValidated, setIsValidated] = useState(false);
  const [importing, setImporting] = useState(false);

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

  // Fetch chapters
  useEffect(() => {
    if (!selectedSubject) { setChapters([]); return; }
    supabase.from('chapters').select('*').eq('subject_id', selectedSubject).order('sort_order').order('created_at')
      .then(({ data }) => { if (data) setChapters(data); });
  }, [selectedSubject]);

  const getTemplate = (type: ActivityType) => {
    const templates: Record<ActivityType, string> = {
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
    return templates[type];
  };

  const handleTypeChange = (type: ActivityType) => {
    setActivityType(type);
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

      if (activityType === 'quiz') {
        const question = data['question'];
        const optionsStr = data['options'];
        const answerStr = data['answer'];
        const hint = data['hint'];
        const explanation = data['explanation'];

        if (!question) errors.push({ line: itemIdx + 1, message: 'Missing question' });
        if (!optionsStr) {
          errors.push({ line: itemIdx + 1, message: 'Missing options' });
        }
        if (!answerStr) {
          errors.push({ line: itemIdx + 1, message: 'Missing correct answer' });
        }

        if (question && optionsStr && answerStr) {
          const options = optionsStr.split('|').map((o) => o.trim());
          const correct_answer = parseInt(answerStr);
          if (isNaN(correct_answer) || correct_answer < 0 || correct_answer >= options.length) {
            errors.push({ line: itemIdx + 1, message: `Answer must be an index between 0 and ${options.length - 1}` });
          } else {
            parsed.push({ question, options, correct_answer, hint, explanation });
          }
        }
      } else if (activityType === 'flashcard') {
        const front = data['front'];
        const back = data['back'];
        if (!front) errors.push({ line: itemIdx + 1, message: 'Missing front side text' });
        if (!back) errors.push({ line: itemIdx + 1, message: 'Missing back side text' });
        if (front && back) {
          parsed.push({ front, back });
        }
      } else if (activityType === 'matching') {
        const pairsStr = data['pairs'];
        if (!pairsStr) {
          errors.push({ line: itemIdx + 1, message: 'Missing pairs list' });
        } else {
          const pairsList = pairsStr.split('|').map((p) => {
            const parts = p.split('=').map((x) => x.trim());
            return { left: parts[0] || '', right: parts[1] || '' };
          });
          if (pairsList.some((p) => !p.left || !p.right)) {
            errors.push({ line: itemIdx + 1, message: 'Invalid pair format (use left = right)' });
          } else {
            parsed.push({ pairs: pairsList });
          }
        }
      } else if (activityType === 'picture') {
        const url = data['url'];
        const question = data['question'];
        const optionsStr = data['options'];
        const answerStr = data['answer'];

        if (!url) errors.push({ line: itemIdx + 1, message: 'Missing image URL' });
        if (!question) errors.push({ line: itemIdx + 1, message: 'Missing question' });
        if (!optionsStr) errors.push({ line: itemIdx + 1, message: 'Missing options' });
        if (!answerStr) errors.push({ line: itemIdx + 1, message: 'Missing correct answer' });

        if (url && question && optionsStr && answerStr) {
          const options = optionsStr.split('|').map((o) => o.trim());
          const correct_answer = parseInt(answerStr);
          if (isNaN(correct_answer) || correct_answer < 0 || correct_answer >= options.length) {
            errors.push({ line: itemIdx + 1, message: `Answer must be index between 0 and ${options.length - 1}` });
          } else {
            parsed.push({ image_url: url, question, options, correct_answer });
          }
        }
      } else if (activityType === 'dragndrop') {
        const sentence = data['sentence'];
        const answersStr = data['answers'];

        if (!sentence) errors.push({ line: itemIdx + 1, message: 'Missing sentence text' });
        if (!answersStr) errors.push({ line: itemIdx + 1, message: 'Missing answers' });

        if (sentence && answersStr) {
          const answersList = answersStr.split('|').map((a) => a.trim());
          const blankCount = (sentence.match(/__BLANK__/g) || []).length;
          if (blankCount === 0) {
            errors.push({ line: itemIdx + 1, message: 'Sentence must contain at least one "__BLANK__" placeholder' });
          }
          if (blankCount !== answersList.length) {
            errors.push({
              line: itemIdx + 1,
              message: `Number of "__BLANK__" placeholders (${blankCount}) does not match the number of answers (${answersList.length})`
            });
          } else {
            parsed.push({ sentence, answers: answersList });
          }
        }
      }
    });

    setValidationErrors(errors);
    setParsedData(parsed);
    setIsValidated(true);

    if (errors.length === 0) {
      toast('All items validated successfully! 🎉', 'success');
    } else {
      toast('Validation failed. Please correct errors.', 'error');
    }
  };

  async function handleImport() {
    if (!selectedChapter || !profile) return;
    setImporting(true);

    try {
      const inserts = parsedData.map((payload) => ({
        chapter_id: selectedChapter,
        activity_type: activityType,
        payload,
        created_by: profile.id,
      }));

      const { error } = await supabase.from('content').insert(inserts);
      if (error) throw error;

      await supabase.from('activity_log').insert({
        teacher_id: profile.id,
        action_type: 'create',
        target_table: 'content',
        target_id: null,
        description: `Bulk imported ${parsedData.length} items of type ${activityType}`,
      });

      toast(`Successfully imported ${parsedData.length} items! 🚀`, 'success');
      setInputText('');
      setParsedData([]);
      setIsValidated(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Import failed';
      toast(message, 'error');
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-extrabold text-surface-900 mb-2">Bulk Import 🚀</h1>
      <p className="text-surface-500 mb-6">Import multiple questions/cards from a text template</p>

      {/* Curriculum Destination */}
      <Card className="mb-6">
        <h2 className="text-sm font-bold text-surface-600 uppercase tracking-wide mb-3">Destination Chapter</h2>
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

      {/* Import Configuration */}
      <Card className="mb-6">
        <div className="flex flex-col gap-4">
          <Select
            label="Activity Type"
            value={activityType}
            onChange={(e) => handleTypeChange(e.target.value as ActivityType)}
            options={[
              { value: 'quiz', label: 'Quiz' },
              { value: 'flashcard', label: 'Flashcard' },
              { value: 'matching', label: 'Matching' },
              { value: 'picture', label: 'Picture Game' },
              { value: 'dragndrop', label: 'Drag & Drop' },
            ]}
          />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-surface-700">Paste Text Template</label>
              <button
                onClick={() => setInputText(getTemplate(activityType))}
                className="text-xs text-primary-600 font-bold hover:text-primary-700 cursor-pointer"
              >
                Reset Template
              </button>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => { setInputText(e.target.value); setIsValidated(false); }}
              rows={10}
              className="w-full px-4 py-3 rounded-xl border-2 border-surface-200 bg-white text-surface-800 font-mono text-sm focus:outline-none focus:border-primary-400 focus:ring-3"
              placeholder="Paste content here..."
            />
          </div>
        </div>
      </Card>

      {/* Validation feedback */}
      {isValidated && (
        <Card className="mb-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            {validationErrors.length === 0 ? (
              <CheckCircle2 className="text-success-500" />
            ) : (
              <AlertCircle className="text-danger-500" />
            )}
            <h3 className="font-bold text-surface-900">
              Validation Result: {validationErrors.length === 0 ? 'All Good!' : 'Fix Errors'}
            </h3>
          </div>

          {validationErrors.length > 0 ? (
            <ul className="text-sm text-danger-700 bg-danger-50 p-4 rounded-xl space-y-1">
              {validationErrors.map((err, i) => (
                <li key={i}>
                  • <strong>Item {err.line}:</strong> {err.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-success-800 bg-success-50 p-4 rounded-xl">
              Ready to import {parsedData.length} item(s) to the selected chapter.
            </p>
          )}
        </Card>
      )}

      {/* Import actions */}
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
            className="flex-grow"
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
  );
}
