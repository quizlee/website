import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Select } from '../../components/ui/Select';
import type { School, Class, LeaderboardEntry } from '../../lib/types';
import { Trophy } from 'lucide-react';

export default function AdminLeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedClass, setSelectedClass] = useState('');

  useEffect(() => {
    // Fetch initial filter lists
    Promise.all([
      supabase.from('schools').select('*').order('name'),
      supabase.from('classes').select('*').order('sort_order'),
    ]).then(([schRes, clsRes]) => {
      setSchools(schRes.data as School[] || []);
      setClasses(clsRes.data as Class[] || []);
    });
  }, []);

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      let query = supabase.from('leaderboard').select('*');

      if (selectedSchool) {
        query = query.eq('school_id', selectedSchool);
      }
      if (selectedClass) {
        query = query.eq('class_id', selectedClass);
      }

      const { data } = await query.order('points', { ascending: false }).limit(100);
      setEntries(data as LeaderboardEntry[] || []);
      setLoading(false);
    }

    fetchLeaderboard();
  }, [selectedSchool, selectedClass]);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-surface-900">Leaderboard Overview</h1>
        <p className="text-sm text-surface-500">Monitor engagement rankings globally or by school/class segment</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            placeholder="All Schools"
            value={selectedSchool}
            onChange={(e) => setSelectedSchool(e.target.value)}
            options={schools.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Select
            placeholder="All Classes"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
      </Card>

      {/* Ranking List */}
      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : entries.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-surface-500">No entries match the selected filters.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto" padding="none">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-surface-100 border-b border-surface-200">
                <th className="p-4 font-bold text-surface-700 w-16">Rank</th>
                <th className="p-4 font-bold text-surface-700">Name / Username</th>
                <th className="p-4 font-bold text-surface-700">School</th>
                <th className="p-4 font-bold text-surface-700 text-right">Activities</th>
                <th className="p-4 font-bold text-surface-700 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const rank = index + 1;
                return (
                  <tr key={entry.user_id} className="border-b border-surface-100 hover:bg-surface-50">
                    <td className="p-4 font-bold flex items-center gap-1.5">
                      {rank === 1 && <Trophy size={16} className="text-warning-500" />}
                      {rank}
                    </td>
                    <td className="p-4 font-semibold text-surface-800">
                      {entry.privacy === 'public'
                        ? entry.full_name || entry.username || 'Anonymous'
                        : entry.username || 'Hidden'}
                    </td>
                    <td className="p-4 text-surface-600">
                      {schools.find((s) => s.id === entry.school_id)?.name || 'Global'}
                    </td>
                    <td className="p-4 text-right text-surface-600">{entry.total_activities}</td>
                    <td className="p-4 text-right font-extrabold text-surface-900">{entry.points}</td>
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
