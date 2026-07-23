import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Spinner } from '../../components/ui/Spinner';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import {
  Users,
  GraduationCap,
  School,
  BookOpen,
  MessageSquare,
  Calendar,
  Clock,
  Award,
  Search,
  BarChart3,
  TrendingUp,
  X,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Activity,
  FileText,
  Book,
} from 'lucide-react';

interface AdminStats {
  students: number;
  teachers: number;
  schools: number;
  questions: number;
  attemptsToday: number;
  attemptsThisWeek: number;
  attemptsThisMonth: number;
  attemptsTotal: number;
}

interface StudentProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  points: number;
  title: string | null;
  school_id: string | null;
  class_id: string | null;
  created_at: string;
  school_name?: string;
}

interface ActivityAttempt {
  id: string;
  user_id: string;
  chapter_ids?: string[];
  activity_type: string;
  mode: string;
  score: number;
  total_questions: number;
  points_earned: number;
  time_taken_seconds?: number;
  created_at: string;
}

// Level calculation helper
const getLevelFromXP = (totalXP: number) => {
  if (totalXP < 100) return 0;
  if (totalXP < 200) return Math.min(4, Math.floor(1 + (totalXP - 100) / 25));
  if (totalXP < 500) return Math.min(9, Math.floor(5 + (totalXP - 200) / 60));
  return Math.min(100, Math.floor(Math.sqrt(totalXP / 5)));
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats>({
    students: 0,
    teachers: 0,
    schools: 0,
    questions: 0,
    attemptsToday: 0,
    attemptsThisWeek: 0,
    attemptsThisMonth: 0,
    attemptsTotal: 0,
  });

  const [studentsList, setStudentsList] = useState<StudentProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Student Detail Modal state
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [studentAttempts, setStudentAttempts] = useState<ActivityAttempt[]>([]);
  const [chaptersMap, setChaptersMap] = useState<Map<string, { name: string; subjectName: string }>>(new Map());
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    async function fetchDashboardData() {
      const now = new Date();
      
      // Start of Today (00:00:00)
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      // Start of This Week (7 days ago)
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();

      // Start of This Month (1st day of current month)
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      try {
        const [
          { count: studentsCount },
          { count: teachersCount },
          { count: schoolsCount },
          { count: questionsCount },
          { count: attemptsTodayCount },
          { count: attemptsWeekCount },
          { count: attemptsMonthCount },
          { count: attemptsTotalCount },
          { data: rawStudents },
          { data: rawSchools },
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
          supabase.from('schools').select('*', { count: 'exact', head: true }),
          supabase.from('content').select('*', { count: 'exact', head: true }),
          supabase.from('activity_attempts').select('*', { count: 'exact', head: true }).gte('created_at', startOfDay),
          supabase.from('activity_attempts').select('*', { count: 'exact', head: true }).gte('created_at', startOfWeek),
          supabase.from('activity_attempts').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth),
          supabase.from('activity_attempts').select('*', { count: 'exact', head: true }),
          supabase.from('profiles').select('id, full_name, username, avatar_url, points, title, school_id, class_id, created_at').eq('role', 'student').order('points', { ascending: false }),
          supabase.from('schools').select('id, name'),
        ]);

        const schoolsMap = new Map<string, string>();
        if (rawSchools) {
          rawSchools.forEach((s) => schoolsMap.set(s.id, s.name));
        }

        const formattedStudents: StudentProfile[] = (rawStudents || []).map((st) => ({
          ...st,
          school_name: st.school_id ? schoolsMap.get(st.school_id) || 'N/A' : 'Unassigned',
        }));

        setStats({
          students: studentsCount || 0,
          teachers: teachersCount || 0,
          schools: schoolsCount || 0,
          questions: questionsCount || 0,
          attemptsToday: attemptsTodayCount || 0,
          attemptsThisWeek: attemptsWeekCount || 0,
          attemptsThisMonth: attemptsMonthCount || 0,
          attemptsTotal: attemptsTotalCount || 0,
        });

        setStudentsList(formattedStudents);
      } catch (err) {
        console.error('Error fetching admin stats:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  // Open modal and fetch student performance attempts + subject/chapter mapping
  const handleOpenStudentModal = async (student: StudentProfile) => {
    setSelectedStudent(student);
    setModalLoading(true);
    try {
      const [
        { data: attemptsData, error: attemptsErr },
        { data: chaptersData },
        { data: subjectsData },
      ] = await Promise.all([
        supabase
          .from('activity_attempts')
          .select('*')
          .eq('user_id', student.id)
          .order('created_at', { ascending: false }),
        supabase.from('chapters').select('id, name, subject_id'),
        supabase.from('subjects').select('id, name'),
      ]);

      if (attemptsErr) throw attemptsErr;

      const subMap = new Map<string, string>();
      if (subjectsData) {
        subjectsData.forEach((s) => subMap.set(s.id, s.name));
      }

      const chMap = new Map<string, { name: string; subjectName: string }>();
      if (chaptersData) {
        chaptersData.forEach((ch) => {
          chMap.set(ch.id, {
            name: ch.name,
            subjectName: subMap.get(ch.subject_id) || 'Subject',
          });
        });
      }

      setChaptersMap(chMap);
      setStudentAttempts(attemptsData || []);
    } catch (err) {
      console.error('Failed to fetch student attempts or subject/chapter data:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedStudent(null);
    setStudentAttempts([]);
  };

  // Compute metrics for the selected student
  const studentMetrics = useMemo(() => {
    if (!selectedStudent || !studentAttempts) return null;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let todayQuiz = 0, weekQuiz = 0, monthQuiz = 0, totalQuiz = studentAttempts.length;
    let todayQAttempted = 0, weekQAttempted = 0, monthQAttempted = 0, totalQAttempted = 0;
    let todayQFailed = 0, weekQFailed = 0, monthQFailed = 0, totalQFailed = 0;
    let todayQCorrect = 0, weekQCorrect = 0, monthQCorrect = 0, totalCorrect = 0;

    studentAttempts.forEach((attempt) => {
      const attemptTime = new Date(attempt.created_at).getTime();
      const totalQ = attempt.total_questions || 0;
      const score = attempt.score || 0;
      const failedQ = Math.max(0, totalQ - score);

      totalQAttempted += totalQ;
      totalQFailed += failedQ;
      totalCorrect += score;

      if (attemptTime >= startOfDay) {
        todayQuiz++;
        todayQAttempted += totalQ;
        todayQCorrect += score;
        todayQFailed += failedQ;
      }

      if (attemptTime >= startOfWeek) {
        weekQuiz++;
        weekQAttempted += totalQ;
        weekQCorrect += score;
        weekQFailed += failedQ;
      }

      if (attemptTime >= startOfMonth) {
        monthQuiz++;
        monthQAttempted += totalQ;
        monthQCorrect += score;
        monthQFailed += failedQ;
      }
    });

    const accuracy = totalQAttempted > 0 ? ((totalCorrect / totalQAttempted) * 100).toFixed(1) : '0';

    return {
      todayQuiz,
      weekQuiz,
      monthQuiz,
      totalQuiz,
      todayQAttempted,
      weekQAttempted,
      monthQAttempted,
      totalQAttempted,
      todayQCorrect,
      weekQCorrect,
      monthQCorrect,
      todayQFailed,
      weekQFailed,
      monthQFailed,
      totalQFailed,
      totalCorrect,
      accuracy,
    };
  }, [selectedStudent, studentAttempts]);

  // Filtered students list based on search query and level filter
  const filteredStudents = useMemo(() => {
    return studentsList.filter((student) => {
      const nameMatch =
        (student.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.username || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!nameMatch) return false;

      const lvl = getLevelFromXP(student.points || 0);

      if (levelFilter === 'level0') return lvl === 0;
      if (levelFilter === 'level1_9') return lvl >= 1 && lvl <= 9;
      if (levelFilter === 'level10_49') return lvl >= 10 && lvl <= 49;
      if (levelFilter === 'level50_100') return lvl >= 50;

      return true;
    });
  }, [studentsList, searchQuery, levelFilter]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Page Title */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 font-headline-md flex items-center gap-2.5">
            <BarChart3 size={26} className="text-primary-600" />
            Platform Analytics & Quiz Tracking
          </h1>
          <p className="text-sm text-surface-500 font-body-md mt-1">
            Real-time insights on quiz attempts (daily, weekly, monthly) and student level breakdown.
          </p>
        </div>
      </div>

      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Students */}
        <Card className="flex items-center gap-4 p-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center text-primary-600 shrink-0">
            <GraduationCap size={24} />
          </div>
          <div>
            <p className="text-2xl font-black text-surface-900">{stats.students}</p>
            <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Total Students</p>
          </div>
        </Card>

        {/* Total Teachers */}
        <Card className="flex items-center gap-4 p-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
            <Users size={24} />
          </div>
          <div>
            <p className="text-2xl font-black text-surface-900">{stats.teachers}</p>
            <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Total Teachers</p>
          </div>
        </Card>

        {/* Total Schools */}
        <Card className="flex items-center gap-4 p-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
            <School size={24} />
          </div>
          <div>
            <p className="text-2xl font-black text-surface-900">{stats.schools}</p>
            <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Active Schools</p>
          </div>
        </Card>

        {/* Total Questions */}
        <Card className="flex items-center gap-4 p-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-2xl font-black text-surface-900">{stats.questions}</p>
            <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Question Bank</p>
          </div>
        </Card>
      </div>

      {/* Quiz Attempt Breakdown Section (Per Day, This Week, This Month) */}
      <Card className="p-6 mb-8">
        <div className="flex items-center gap-3 border-b border-surface-100 pb-4 mb-6">
          <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center shrink-0">
            <TrendingUp size={22} />
          </div>
          <div>
            <h2 className="font-bold text-lg text-surface-900">Quiz Attempt Activity Metrics</h2>
            <p className="text-xs text-surface-500">Track quiz attempt velocity across daily, weekly, and monthly timelines.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Per Day (Today) */}
          <div className="p-5 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/50 via-white to-blue-50/10 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-blue-700 tracking-wider block mb-1">
                Today's Attempts
              </span>
              <p className="text-3xl font-black text-blue-950 font-headline-md leading-none">
                {stats.attemptsToday}
              </p>
              <p className="text-[11px] font-semibold text-blue-600 mt-1.5 flex items-center gap-1">
                <Clock size={12} /> Today's Quizzes
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-100/70 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
              <Calendar size={22} />
            </div>
          </div>

          {/* This Week */}
          <div className="p-5 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 via-white to-indigo-50/10 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-indigo-700 tracking-wider block mb-1">
                This Week's Attempts
              </span>
              <p className="text-3xl font-black text-indigo-950 font-headline-md leading-none">
                {stats.attemptsThisWeek}
              </p>
              <p className="text-[11px] font-semibold text-indigo-600 mt-1.5 flex items-center gap-1">
                <Calendar size={12} /> Last 7 Days
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-100/70 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
              <TrendingUp size={22} />
            </div>
          </div>

          {/* This Month */}
          <div className="p-5 rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/50 via-white to-purple-50/10 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-purple-700 tracking-wider block mb-1">
                This Month's Attempts
              </span>
              <p className="text-3xl font-black text-purple-950 font-headline-md leading-none">
                {stats.attemptsThisMonth}
              </p>
              <p className="text-[11px] font-semibold text-purple-600 mt-1.5 flex items-center gap-1">
                <Calendar size={12} /> Current Month
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-100/70 border border-purple-200 text-purple-700 flex items-center justify-center shrink-0">
              <BarChart3 size={22} />
            </div>
          </div>

          {/* All Time Attempts */}
          <div className="p-5 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/10 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-emerald-700 tracking-wider block mb-1">
                Total Attempts (All-Time)
              </span>
              <p className="text-3xl font-black text-emerald-950 font-headline-md leading-none">
                {stats.attemptsTotal}
              </p>
              <p className="text-[11px] font-semibold text-emerald-600 mt-1.5 flex items-center gap-1">
                <MessageSquare size={12} /> Total Solved
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <MessageSquare size={22} />
            </div>
          </div>
        </div>
      </Card>

      {/* Student Current Levels Tracker & Inspector Table */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-100 pb-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
              <Award size={22} />
            </div>
            <div>
              <h2 className="font-bold text-lg text-surface-900">Student Current Level Tracker</h2>
              <p className="text-xs text-surface-500">Click on any student to inspect detailed quiz & question attempt metrics (daily, weekly, monthly).</p>
            </div>
          </div>

          {/* Search & Level Filter */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="w-full sm:w-64">
              <Input
                placeholder="Search student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftElement={<Search size={16} className="text-surface-400" />}
              />
            </div>
            <div className="w-full sm:w-44">
              <Select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Levels' },
                  { value: 'level0', label: 'Level 0 (<100 XP)' },
                  { value: 'level1_9', label: 'Level 1 - 9' },
                  { value: 'level10_49', label: 'Level 10 - 49' },
                  { value: 'level50_100', label: 'Level 50+' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-surface-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-100/70 border-b border-surface-200 text-xs font-extrabold uppercase text-surface-600 tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Student</th>
                <th className="px-5 py-3.5">Current Level</th>
                <th className="px-5 py-3.5">Total XP</th>
                <th className="px-5 py-3.5">Equipped Title</th>
                <th className="px-5 py-3.5">School / Institution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 bg-white font-body-md">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-surface-400 font-semibold">
                    No students found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => {
                  const studentLvl = getLevelFromXP(st.points || 0);
                  const studentInitials = st.full_name?.[0]?.toUpperCase() || '?';

                  return (
                    <tr
                      key={st.id}
                      onClick={() => handleOpenStudentModal(st)}
                      className="hover:bg-primary-50/40 transition-colors cursor-pointer group"
                      title="Click to view detailed quiz & question attempt stats"
                    >
                      {/* Student Info */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar
                            avatarUrl={st.avatar_url}
                            initials={studentInitials}
                            className="w-10 h-10 border border-surface-200 shrink-0 text-sm font-extrabold group-hover:scale-105 transition-transform"
                          />
                          <div className="min-w-0">
                            <p className="font-extrabold text-surface-900 truncate group-hover:text-primary transition-colors">
                              {st.full_name || 'Unnamed Student'}
                            </p>
                            <p className="text-xs text-surface-400 truncate">
                              @{st.username || 'username'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Current Level */}
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black shadow-2xs select-none border ${
                          studentLvl === 0
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : studentLvl >= 50
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-primary-50 text-primary border-primary-200'
                        }`}>
                          <Award size={12} />
                          Level {studentLvl}
                        </span>
                      </td>

                      {/* Total XP */}
                      <td className="px-5 py-3.5">
                        <span className="font-extrabold text-warning-700 bg-warning-50 border border-warning-200 px-2.5 py-0.5 rounded-full text-xs">
                          {(st.points || 0).toLocaleString()} XP
                        </span>
                      </td>

                      {/* Equipped Title */}
                      <td className="px-5 py-3.5">
                        {st.title ? (
                          <span className="text-xs font-extrabold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                            {st.title}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-slate-400 italic">
                            No Title Equipped
                          </span>
                        )}
                      </td>

                      {/* School / Institution */}
                      <td className="px-5 py-3.5 text-xs font-bold text-surface-600 truncate max-w-[180px]" title={st.school_name}>
                        {st.school_name}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* STUDENT PERFORMANCE DETAILS MODAL */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 relative shadow-2xl border border-surface-200 my-8 max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={handleCloseModal}
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-surface-100 hover:bg-surface-200 text-surface-600 flex items-center justify-center transition-colors cursor-pointer"
              title="Close modal"
            >
              <X size={20} />
            </button>

            {/* Modal Student Header */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 border-b border-surface-100 pb-6 mb-6">
              <Avatar
                avatarUrl={selectedStudent.avatar_url}
                initials={selectedStudent.full_name?.[0]?.toUpperCase() || '?'}
                className="w-20 h-20 text-2xl font-black ring-4 ring-primary/20 shrink-0"
              />
              <div className="text-center sm:text-left min-w-0 flex-grow">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                  <h2 className="text-2xl font-black text-surface-950 font-headline-md truncate">
                    {selectedStudent.full_name || 'Student Performance'}
                  </h2>
                  <span className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-black border ${
                    getLevelFromXP(selectedStudent.points || 0) === 0
                      ? 'bg-slate-100 text-slate-700 border-slate-200'
                      : 'bg-primary-50 text-primary border-primary-200'
                  }`}>
                    <Award size={12} />
                    Level {getLevelFromXP(selectedStudent.points || 0)}
                  </span>
                </div>
                <p className="text-xs text-surface-500 font-semibold">
                  @{selectedStudent.username || 'username'} &bull; {selectedStudent.school_name}
                </p>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3">
                  <span className="font-extrabold text-xs text-warning-700 bg-warning-50 border border-warning-200 px-3 py-1 rounded-full">
                    {(selectedStudent.points || 0).toLocaleString()} Total XP
                  </span>
                  {selectedStudent.title && (
                    <span className="font-extrabold text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                      {selectedStudent.title}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {modalLoading ? (
              <div className="flex justify-center py-16">
                <Spinner size="lg" />
              </div>
            ) : studentMetrics ? (
              <div className="space-y-6">
                {/* 1. QUIZ ATTEMPTED BREAKDOWN */}
                <div>
                  <h3 className="font-bold text-sm text-surface-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Activity size={16} className="text-primary-600" />
                    Quiz Attempts Breakdown (Per Day, Week, Month)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-center">
                      <span className="text-[10px] font-extrabold uppercase text-blue-700 tracking-wider block">Today (Per Day)</span>
                      <p className="text-2xl font-black text-blue-950 mt-1">{studentMetrics.todayQuiz}</p>
                      <span className="text-[10px] text-blue-600 font-bold">Quiz Attempted</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-center">
                      <span className="text-[10px] font-extrabold uppercase text-indigo-700 tracking-wider block">This Week</span>
                      <p className="text-2xl font-black text-indigo-950 mt-1">{studentMetrics.weekQuiz}</p>
                      <span className="text-[10px] text-indigo-600 font-bold">Quiz Attempted</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 text-center">
                      <span className="text-[10px] font-extrabold uppercase text-purple-700 tracking-wider block">This Month</span>
                      <p className="text-2xl font-black text-purple-950 mt-1">{studentMetrics.monthQuiz}</p>
                      <span className="text-[10px] text-purple-600 font-bold">Quiz Attempted</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center">
                      <span className="text-[10px] font-extrabold uppercase text-emerald-700 tracking-wider block">All-Time Total</span>
                      <p className="text-2xl font-black text-emerald-950 mt-1">{studentMetrics.totalQuiz}</p>
                      <span className="text-[10px] text-emerald-600 font-bold">Quiz Attempted</span>
                    </div>
                  </div>
                </div>

                {/* 2. QUESTIONS ATTEMPTED, CORRECT & FAILED BREAKDOWN */}
                <div>
                  <h3 className="font-bold text-sm text-surface-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <HelpCircle size={16} className="text-amber-600" />
                    Questions Attempted, Correct & Failed Analysis
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Per Day */}
                    <div className="p-4 rounded-2xl border border-surface-200 bg-surface-50/50 space-y-2">
                      <span className="text-[10px] font-extrabold uppercase text-surface-500 tracking-wider block border-b border-surface-200 pb-1 mb-1.5">Today (Per Day)</span>
                      <div className="flex items-center justify-between text-xs font-bold text-surface-800">
                        <span className="flex items-center gap-1.5 text-surface-600"><FileText size={14} /> Attempted:</span>
                        <span className="font-black text-surface-950">{studentMetrics.todayQAttempted} Questions</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-700">
                        <span className="flex items-center gap-1.5"><CheckCircle2 size={14} /> Correct:</span>
                        <span className="font-black">{studentMetrics.todayQCorrect} Questions</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold text-rose-600">
                        <span className="flex items-center gap-1.5"><XCircle size={14} /> Failed / Incorrect:</span>
                        <span className="font-black">{studentMetrics.todayQFailed} Questions</span>
                      </div>
                    </div>

                    {/* This Week */}
                    <div className="p-4 rounded-2xl border border-surface-200 bg-surface-50/50 space-y-2">
                      <span className="text-[10px] font-extrabold uppercase text-surface-500 tracking-wider block border-b border-surface-200 pb-1 mb-1.5">This Week</span>
                      <div className="flex items-center justify-between text-xs font-bold text-surface-800">
                        <span className="flex items-center gap-1.5 text-surface-600"><FileText size={14} /> Attempted:</span>
                        <span className="font-black text-surface-950">{studentMetrics.weekQAttempted} Questions</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-700">
                        <span className="flex items-center gap-1.5"><CheckCircle2 size={14} /> Correct:</span>
                        <span className="font-black">{studentMetrics.weekQCorrect} Questions</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold text-rose-600">
                        <span className="flex items-center gap-1.5"><XCircle size={14} /> Failed / Incorrect:</span>
                        <span className="font-black">{studentMetrics.weekQFailed} Questions</span>
                      </div>
                    </div>

                    {/* This Month */}
                    <div className="p-4 rounded-2xl border border-surface-200 bg-surface-50/50 space-y-2">
                      <span className="text-[10px] font-extrabold uppercase text-surface-500 tracking-wider block border-b border-surface-200 pb-1 mb-1.5">This Month</span>
                      <div className="flex items-center justify-between text-xs font-bold text-surface-800">
                        <span className="flex items-center gap-1.5 text-surface-600"><FileText size={14} /> Attempted:</span>
                        <span className="font-black text-surface-950">{studentMetrics.monthQAttempted} Questions</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-700">
                        <span className="flex items-center gap-1.5"><CheckCircle2 size={14} /> Correct:</span>
                        <span className="font-black">{studentMetrics.monthQCorrect} Questions</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold text-rose-600">
                        <span className="flex items-center gap-1.5"><XCircle size={14} /> Failed / Incorrect:</span>
                        <span className="font-black">{studentMetrics.monthQFailed} Questions</span>
                      </div>
                    </div>
                  </div>

                  {/* Summary accuracy banner */}
                  <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-primary-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-emerald-950">Overall Accuracy Rate</p>
                        <p className="text-xs text-emerald-700">{studentMetrics.totalCorrect} Correct out of {studentMetrics.totalQAttempted} Total Questions</p>
                      </div>
                    </div>
                    <span className="text-2xl font-black text-emerald-700 font-headline-md">
                      {studentMetrics.accuracy}%
                    </span>
                  </div>
                </div>

                {/* 3. RECENT ACTIVITY LOG FOR THIS STUDENT */}
                <div>
                  <h3 className="font-bold text-sm text-surface-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Book size={16} className="text-primary-600" />
                    Recent Activity History ({studentAttempts.length} Total)
                  </h3>

                  <div className="max-h-64 overflow-y-auto rounded-2xl border border-surface-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-100 text-surface-600 uppercase font-extrabold sticky top-0">
                        <tr>
                          <th className="px-4 py-2.5">Activity</th>
                          <th className="px-4 py-2.5">Subject & Chapter</th>
                          <th className="px-4 py-2.5">Mode</th>
                          <th className="px-4 py-2.5">Score</th>
                          <th className="px-4 py-2.5">XP Earned</th>
                          <th className="px-4 py-2.5">Date & Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100 bg-white font-body-md">
                        {studentAttempts.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-6 text-surface-400 italic">
                              No quiz attempts recorded yet for this student.
                            </td>
                          </tr>
                        ) : (
                          studentAttempts.slice(0, 15).map((att) => {
                            let subjectName = 'General';
                            let chapterName = 'All Chapters';

                            if (att.chapter_ids && att.chapter_ids.length > 0) {
                              const firstCh = chaptersMap.get(att.chapter_ids[0]);
                              if (firstCh) {
                                subjectName = firstCh.subjectName;
                                chapterName = att.chapter_ids.length > 1
                                  ? `${firstCh.name} (+${att.chapter_ids.length - 1} more)`
                                  : firstCh.name;
                              }
                            }

                            return (
                              <tr key={att.id} className="hover:bg-surface-50/80 transition-colors">
                                <td className="px-4 py-2.5 font-bold uppercase text-primary">
                                  {att.activity_type}
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex flex-col">
                                    <span className="font-extrabold text-surface-900 text-xs truncate max-w-[160px]" title={subjectName}>
                                      {subjectName}
                                    </span>
                                    <span className="text-[11px] font-semibold text-surface-500 truncate max-w-[160px]" title={chapterName}>
                                      {chapterName}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 capitalize text-surface-600">
                                  {att.mode}
                                </td>
                                <td className="px-4 py-2.5 font-extrabold">
                                  {att.score} / {att.total_questions}
                                </td>
                                <td className="px-4 py-2.5 font-extrabold text-warning-700">
                                  +{att.points_earned} XP
                                </td>
                                <td className="px-4 py-2.5 text-surface-400">
                                  {new Date(att.created_at).toLocaleString()}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button onClick={handleCloseModal} variant="outline" className="font-bold">
                    Close Details
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
