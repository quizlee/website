import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { toast } from '../../components/ui/Toast';
import type { School, Class, Subject, Chapter, ActivityType, ContentPayload, Activity } from '../../lib/types';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  School as SchoolIcon,
  BookOpen,
} from 'lucide-react';

interface ValidationError {
  line: number;
  message: string;
}

export default function AdminBulkImportPage() {
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(true);

  // Curriculum lists
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  // Selection states (initialized from sessionStorage to persist previous choice)
  const [selectedSchool, setSelectedSchool] = useState(sessionStorage.getItem('admin_import_school') || '');
  const [selectedClass, setSelectedClass] = useState(sessionStorage.getItem('admin_import_class') || '');
  const [selectedSubject, setSelectedSubject] = useState(sessionStorage.getItem('admin_import_subject') || '');
  const [selectedChapter, setSelectedChapter] = useState(sessionStorage.getItem('admin_import_chapter') || '');
  const [activityType, setActivityType] = useState<ActivityType>((sessionStorage.getItem('admin_import_type') as ActivityType) || 'quiz');

  // Input & validation states
  const [inputText, setInputText] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [parsedData, setParsedData] = useState<ContentPayload[]>([]);
  const [isValidated, setIsValidated] = useState(false);
  const [importing, setImporting] = useState(false);

  // Fetch initial data (schools, classes, activities)
  useEffect(() => {
    Promise.all([
      supabase.from('schools').select('*').order('name'),
      supabase.from('classes').select('*').order('sort_order'),
      supabase.from('activities').select('*').eq('is_active', true).order('zone').order('sort_order'),
    ]).then(([schRes, clsRes, actRes]) => {
      if (schRes.data) setSchools(schRes.data as School[]);
      if (clsRes.data) setClasses(clsRes.data as Class[]);
      if (actRes.data) setActivities(actRes.data as Activity[]);
      setLoading(false);
    });
  }, []);

  // Fetch subjects (school + class specific)
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
      .then(({ data }) => {
        if (data) setSubjects(data as Subject[]);
      });
  }, [selectedSchool, selectedClass]);

  // Fetch chapters
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
      .then(({ data }) => {
        if (data) setChapters(data as Chapter[]);
      });
  }, [selectedSubject]);

  // Save selections to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('admin_import_school', selectedSchool);
    sessionStorage.setItem('admin_import_class', selectedClass);
    sessionStorage.setItem('admin_import_subject', selectedSubject);
    sessionStorage.setItem('admin_import_chapter', selectedChapter);
    sessionStorage.setItem('admin_import_type', activityType);
  }, [selectedSchool, selectedClass, selectedSubject, selectedChapter, activityType]);

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

  // Set default template when text is empty
  useEffect(() => {
    if (!inputText) {
      setInputText(getTemplate(activityType));
    }
  }, [activityType]);

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

      const lineNum = itemIdx + 1;

      if (activityType === 'quiz') {
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
      } else if (activityType === 'flashcard') {
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
          });
        }
      } else if (activityType === 'matching') {
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
            });
          }
        }
      } else if (activityType === 'picture') {
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
      } else if (activityType === 'dragndrop') {
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
        // Fallback for custom activity types (parse as key-value pairs)
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
      toast('Please select a destination chapter first', 'warning');
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
        activity_type: activityType,
        payload,
        created_by: profile?.id,
      }));

      const { error } = await supabase.from('content').insert(inserts);
      if (error) throw error;

      toast(`Successfully imported ${inserts.length} content items! 🎉`, 'success');
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
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        
        {/* Left side: Navigation Explorer (School > Class > Subject > Chapter tree) */}
        <div className="md:col-span-3 flex flex-col gap-4 max-h-[calc(100vh-140px)] min-h-[600px] overflow-y-auto bg-white p-4">
          <div className="border-b border-surface-200 pb-3 mb-2 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-surface-800 uppercase tracking-wider">Curriculum Explorer</h2>
              <p className="text-xs text-surface-400 mt-1">Select a chapter to import into.</p>
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
                                                      <span className={`w-1.5 h-1.5 rounded-full ${isChapSelected ? 'bg-primary-500' : 'bg-surface-300'}`} />
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

        {/* Right side: Bulk Import panel */}
        <div className="md:col-span-9 flex flex-col gap-4 max-h-[calc(100vh-140px)] overflow-y-auto">
          {/* Destination & Activity Filters Card */}
          <Card padding="sm" className="bg-white">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-surface-100 pb-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-surface-500">Destination: </span>
                  <span className="text-xs font-bold text-primary-600">
                    {selectedChapter 
                      ? `${schools.find(s=>s.id===selectedSchool)?.name} · ${classes.find(c=>c.id===selectedClass)?.name} · ${subjects.find(s=>s.id===selectedSubject)?.name} · ${chapters.find(c=>c.id===selectedChapter)?.name}`
                      : 'None selected'
                    }
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-surface-400 w-24 shrink-0">Activity Type:</span>
                  {activities.map((act) => {
                    const isSelected = activityType === act.key;
                    const cardColor = act.color || '#6366f1';
                    return (
                      <button
                        key={act.key}
                        onClick={() => handleTypeChange(act.key as ActivityType)}
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
                    onClick={() => setInputText(getTemplate(activityType))}
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
      </div>
    </div>
  );
}
