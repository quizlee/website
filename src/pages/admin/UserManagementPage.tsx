import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Input } from '../../components/ui/Input';
import { toast } from '../../components/ui/Toast';
import type { Profile, UserStatus } from '../../lib/types';
import { Ban, CheckCircle, Trash2 } from 'lucide-react';

export default function UserManagementPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  useEffect(() => {
    fetchUsers();
  }, [selectedRole, selectedStatus]);

  async function fetchUsers() {
    setLoading(true);
    let query = supabase.from('profiles').select('*');

    if (selectedRole) {
      query = query.eq('role', selectedRole);
    }
    if (selectedStatus) {
      query = query.eq('status', selectedStatus);
    }

    const { data } = await query.order('created_at', { ascending: false });
    setUsers(data as Profile[] || []);
    setLoading(false);
  }

  async function handleToggleStatus(user: Profile) {
    const nextStatus: UserStatus = user.status === 'active' ? 'suspended' : 'active';
    const { error } = await supabase
      .from('profiles')
      .update({ status: nextStatus })
      .eq('id', user.id);

    if (error) {
      toast(error.message, 'error');
    } else {
      toast(`User account ${nextStatus === 'suspended' ? 'suspended' : 'activated'}`, 'info');
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u))
      );
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm('Are you sure you want to permanently delete this user account?')) return;

    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) {
      toast(error.message, 'error');
    } else {
      toast('User deleted successfully.', 'info');
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    }
  }

  // Client side search filter
  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(term) ||
      u.username?.toLowerCase().includes(term) ||
      u.id.toLowerCase().includes(term)
    );
  });

  const getStatusBadge = (status: UserStatus) => {
    if (status === 'active') return <Badge variant="success" size="sm">Active</Badge>;
    if (status === 'suspended') return <Badge variant="warning" size="sm">Suspended</Badge>;
    return <Badge variant="danger" size="sm">Banned</Badge>;
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-surface-900">User Management</h1>
        <p className="text-sm text-surface-500">Search, monitor, suspend, or delete students and teachers</p>
      </div>

      {/* Filters and search */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2 relative">
            <Input
              label="Search User"
              placeholder="Search by name, username, or UID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              id="user-search"
            />
          </div>
          <Select
            label="Role"
            placeholder="All Roles"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            options={[
              { value: 'student', label: 'Students' },
              { value: 'teacher', label: 'Teachers' },
              { value: 'admin', label: 'Admins' },
            ]}
          />
          <Select
            label="Status"
            placeholder="All Statuses"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'banned', label: 'Banned' },
            ]}
          />
        </div>
      </Card>

      {/* User list table */}
      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : filteredUsers.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-surface-500">No users found.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto" padding="none">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-surface-100 border-b border-surface-200">
                <th className="p-4 font-bold text-surface-700">Full Name / Username</th>
                <th className="p-4 font-bold text-surface-700 w-32">Role</th>
                <th className="p-4 font-bold text-surface-700 w-32">Status</th>
                <th className="p-4 font-bold text-surface-700 text-right w-24">Points</th>
                <th className="p-4 font-bold text-surface-700 text-right w-44">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-surface-100 hover:bg-surface-50">
                  <td className="p-4">
                    <p className="font-semibold text-surface-850">{user.full_name || 'Anonymous'}</p>
                    <p className="text-xs text-surface-450">@{user.username || 'username'}</p>
                    <p className="text-[9px] text-surface-400 font-mono mt-0.5">{user.id}</p>
                  </td>
                  <td className="p-4">
                    <span className="capitalize font-semibold text-surface-650">{user.role}</span>
                  </td>
                  <td className="p-4">{getStatusBadge(user.status)}</td>
                  <td className="p-4 text-right font-extrabold text-surface-900">{user.points}</td>
                  <td className="p-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant={user.status === 'active' ? 'outline' : 'primary'}
                        onClick={() => handleToggleStatus(user)}
                        icon={user.status === 'active' ? <Ban size={14} /> : <CheckCircle size={14} />}
                        className="h-8 py-0 px-2"
                      >
                        {user.status === 'active' ? 'Suspend' : 'Activate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(user.id)}
                        icon={<Trash2 size={14} />}
                        className="h-8 py-0 px-2"
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
