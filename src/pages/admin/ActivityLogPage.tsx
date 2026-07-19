import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Select } from '../../components/ui/Select';
import type { ActivityLog, Profile } from '../../lib/types';


export default function ActivityLogPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedAction, setSelectedAction] = useState('');

  useEffect(() => {
    // Fetch teachers list for filter
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'teacher')
      .order('full_name')
      .then(({ data }) => setTeachers(data as Profile[] || []));
  }, []);

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      let query = supabase.from('activity_log').select('*');

      if (selectedTeacher) {
        query = query.eq('teacher_id', selectedTeacher);
      }
      if (selectedAction) {
        query = query.eq('action_type', selectedAction);
      }

      const { data } = await query.order('created_at', { ascending: false }).limit(100);
      setLogs(data as ActivityLog[] || []);
      setLoading(false);
    }
    fetchLogs();
  }, [selectedTeacher, selectedAction]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionColor = (action: string) => {
    if (action === 'create') return 'text-success-600 bg-success-50';
    if (action === 'update') return 'text-primary-600 bg-primary-50';
    return 'text-danger-600 bg-danger-50';
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-surface-900">Teacher Activity Audit Trail</h1>
        <p className="text-sm text-surface-500">Monitor all creation, modification, and deletion events</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            placeholder="All Teachers"
            value={selectedTeacher}
            onChange={(e) => setSelectedTeacher(e.target.value)}
            options={teachers.map((t) => ({ value: t.id, label: t.full_name || t.username || 'Anonymous' }))}
          />
          <Select
            placeholder="All Actions"
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            options={[
              { value: 'create', label: 'Create' },
              { value: 'update', label: 'Update' },
              { value: 'delete', label: 'Delete' },
            ]}
          />
        </div>
      </Card>

      {/* Logs Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : logs.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-surface-500">No activity logged.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto" padding="none">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-surface-100 border-b border-surface-200">
                <th className="p-4 font-bold text-surface-700 w-44">Timestamp</th>
                <th className="p-4 font-bold text-surface-700">Teacher</th>
                <th className="p-4 font-bold text-surface-700 w-28">Action</th>
                <th className="p-4 font-bold text-surface-700 w-32">Table</th>
                <th className="p-4 font-bold text-surface-700">Description</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const teacher = teachers.find((t) => t.id === log.teacher_id);
                return (
                  <tr key={log.id} className="border-b border-surface-100 hover:bg-surface-50">
                    <td className="p-4 text-surface-500 font-mono text-xs">{formatDate(log.created_at)}</td>
                    <td className="p-4 font-semibold text-surface-800">
                      {teacher?.full_name || 'System / ID: ' + log.teacher_id.slice(0, 8)}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${getActionColor(log.action_type)}`}>
                        {log.action_type}
                      </span>
                    </td>
                    <td className="p-4 text-surface-600 font-mono text-xs">{log.target_table}</td>
                    <td className="p-4 text-surface-700 font-medium">{log.description}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
