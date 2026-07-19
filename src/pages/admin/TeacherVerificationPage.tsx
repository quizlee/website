import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { toast } from '../../components/ui/Toast';
import type { Profile } from '../../lib/types';
import { CheckCircle, XCircle } from 'lucide-react';

export default function TeacherVerificationPage() {
  const { profile: adminProfile } = useAuthStore();
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState<Profile | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    fetchPendingTeachers();
  }, []);

  async function fetchPendingTeachers() {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'teacher')
      .eq('verification_status', 'pending');
    setTeachers(data as Profile[] || []);
    setLoading(false);
  }

  async function handleApprove(teacherId: string) {
    if (!adminProfile) return;
    const { error } = await supabase
      .from('profiles')
      .update({
        verification_status: 'approved',
        verified_by: adminProfile.id,
        verified_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq('id', teacherId);

    if (error) {
      toast(error.message, 'error');
    } else {
      toast('Teacher account approved!', 'success');
      setTeachers((prev) => prev.filter((t) => t.id !== teacherId));
    }
  }

  async function handleReject() {
    if (!selectedTeacher || !adminProfile) return;
    setRejecting(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        verification_status: 'rejected',
        verified_by: adminProfile.id,
        verified_at: new Date().toISOString(),
        rejection_reason: rejectionReason,
      })
      .eq('id', selectedTeacher.id);

    if (error) {
      toast(error.message, 'error');
    } else {
      toast('Teacher account rejected.', 'info');
      setTeachers((prev) => prev.filter((t) => t.id !== selectedTeacher.id));
      setSelectedTeacher(null);
      setRejectionReason('');
    }
    setRejecting(false);
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
      <div className="mb-6">
        <h1 className="text-xl font-bold text-surface-900">Teacher Verification Queue</h1>
        <p className="text-sm text-surface-500">Approve or reject pending teacher accounts</p>
      </div>

      {teachers.length === 0 ? (
        <Card className="text-center py-12">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-surface-500 font-medium">All caught up! No pending verification requests.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {teachers.map((teacher) => (
            <Card key={teacher.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-surface-900">{teacher.full_name || 'Anonymous'}</h3>
                  <Badge variant="warning" size="sm">Pending</Badge>
                </div>
                <p className="text-xs text-surface-400 mb-2">{teacher.username ? `@${teacher.username}` : ''}</p>
                <div className="text-sm text-surface-600 space-y-1">
                  <p><strong>Claimed School:</strong> {teacher.school_id || 'Not Specified'}</p>
                  <p><strong>Claimed Subject(s):</strong> {teacher.subjects_claimed?.join(', ') || 'Not Specified'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleApprove(teacher.id)}
                  icon={<CheckCircle size={16} />}
                  className="bg-success-600 hover:bg-success-700 text-white"
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setSelectedTeacher(teacher)}
                  icon={<XCircle size={16} />}
                >
                  Reject
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      <Modal
        isOpen={!!selectedTeacher}
        onClose={() => setSelectedTeacher(null)}
        title="Reject Teacher Registration"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-surface-600">
            Please provide a reason for rejecting <strong>{selectedTeacher?.full_name}</strong>'s request.
          </p>
          <Input
            label="Rejection Reason"
            placeholder="e.g. Invalid school credential, incorrect subject fields"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            required
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setSelectedTeacher(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={rejecting}
              onClick={handleReject}
            >
              Confirm Reject
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
