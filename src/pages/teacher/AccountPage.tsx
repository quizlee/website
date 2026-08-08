import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { toast } from '../../components/ui/Toast';
import { Select } from '../../components/ui/Select';

import { Avatar } from '../../components/ui/Avatar';

import { Camera, Save, ShieldCheck, Trash2, Loader2, Check, X } from 'lucide-react';

export default function TeacherAccountPage() {
  const { profile, user, setProfile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [schoolName, setSchoolName] = useState('Loading...');
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState(profile?.school_id || '');

  useEffect(() => {
    async function fetchSchools() {
      const { data } = await supabase
        .from('schools')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      if (data) {
        setSchools(data);
      }
    }
    fetchSchools();
  }, []);

  useEffect(() => {
    if (profile?.school_id) {
      setSelectedSchoolId(profile.school_id);
    } else {
      setSelectedSchoolId('');
    }
  }, [profile?.school_id]);

  // Student-Teacher Relations state
  const [studentRelations, setStudentRelations] = useState<any[]>([]);
  const [fetchingRelations, setFetchingRelations] = useState(false);

  const fetchStudentRelations = async () => {
    if (!profile?.id) return;
    setFetchingRelations(true);
    try {
      // 1. Fetch relations
      const { data: relations, error: relError } = await supabase
        .from('student_teacher_relations')
        .select('*')
        .eq('teacher_id', profile.id);

      if (relError) throw relError;

      // 2. Fetch profiles for these students
      if (relations && relations.length > 0) {
        const studentIds = relations.map(r => r.student_id);
        const { data: studentProfiles, error: profError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', studentIds);

        if (profError) throw profError;

        const relationsWithProfiles = relations.map(r => {
          const prof = studentProfiles?.find(p => p.id === r.student_id);
          return {
            id: r.id,
            status: r.status,
            student_id: r.student_id,
            student: prof || null
          };
        });
        setStudentRelations(relationsWithProfiles);
      } else {
        setStudentRelations([]);
      }
    } catch (err) {
      console.error('Error fetching student relations:', err);
    } finally {
      setFetchingRelations(false);
    }
  };

  const handleUpdateRelationStatus = async (relationId: string, newStatus: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('student_teacher_relations')
        .update({ status: newStatus })
        .eq('id', relationId);

      if (error) {
        toast(error.message, 'error');
      } else {
        toast(`Request ${newStatus === 'approved' ? 'approved' : 'declined'} successfully!`, 'success');
        fetchStudentRelations();
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleDisconnectStudent = async (relationId: string) => {
    if (!confirm('Are you sure you want to disconnect this student?')) return;
    try {
      const { error } = await supabase
        .from('student_teacher_relations')
        .delete()
        .eq('id', relationId);

      if (error) {
        toast(error.message, 'error');
      } else {
        toast('Student disconnected.', 'success');
        fetchStudentRelations();
      }
    } catch (err) {
      console.error('Error deleting relation:', err);
    }
  };

  useEffect(() => {
    fetchStudentRelations();
  }, [profile]);

  useEffect(() => {
    async function fetchSchool() {
      if (!profile?.school_id) {
        setSchoolName('None');
        return;
      }
      const { data } = await supabase
        .from('schools')
        .select('name')
        .eq('id', profile.school_id)
        .single();
      if (data) {
        setSchoolName(data.name);
      } else {
        setSchoolName('Unknown School');
      }
    }
    fetchSchool();
  }, [profile]);

  async function handleSave() {
    if (!profile) return;
    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        username,
        school_id: selectedSchoolId || null,
      })
      .eq('id', profile.id);

    if (error) {
      toast(error.message, 'error');
    } else {
      setProfile({ ...profile, full_name: fullName, username, school_id: selectedSchoolId || null });
      toast('Profile updated! 🎉', 'success');
    }
    setLoading(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!profile || !e.target.files?.[0]) return;

    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const filePath = `${profile.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast(uploadError.message, 'error');
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', profile.id);

    if (updateError) {
      toast(updateError.message, 'error');
    } else {
      setProfile({ ...profile, avatar_url: publicUrl });
      toast('Avatar updated!', 'success');
    }
  }

  async function handleRemoveAvatar() {
    if (!profile) return;
    setLoading(true);

    try {
      if (profile.avatar_url) {
        const bucketName = 'avatars';
        const parts = profile.avatar_url.split(`/${bucketName}/`);
        if (parts.length > 1) {
          const storagePath = decodeURIComponent(parts[1].split('?')[0]);
          await supabase.storage.from(bucketName).remove([storagePath]);
        }
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', profile.id);

      if (updateError) {
        toast(updateError.message, 'error');
      } else {
        setProfile({ ...profile, avatar_url: null });
        toast('Avatar removed!', 'success');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error removing avatar';
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const getVerificationBadge = () => {
    if (profile?.verification_status === 'approved') {
      return <Badge variant="success">Verified ✓</Badge>;
    }
    if (profile?.verification_status === 'rejected') {
      return <Badge variant="danger">Rejected 🚫</Badge>;
    }
    return <Badge variant="warning">Pending Verification ⏳</Badge>;
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <h1 className="text-2xl font-extrabold text-surface-900 mb-2">Teacher Account 👤</h1>
      <p className="text-surface-500 mb-8">View and update your profile information</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Avatar, Affiliation & Claimed Subjects */}
        <div className="md:col-span-1 flex flex-col gap-6">
          {/* Avatar / Logo Card */}
          <Card className="text-center">
            <div className="flex flex-col items-center">
              <div className="relative mb-4">
                <Avatar
                  avatarUrl={profile?.avatar_url || null}
                  initials={profile?.full_name?.[0]?.toUpperCase() || '?'}
                  className="w-24 h-24 text-3xl font-bold shadow-inner"
                />
                <label className="absolute bottom-0 right-0 w-8 h-8 bg-secondary-500 rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-secondary-600 transition-colors">
                  <Camera size={14} className="text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="flex flex-col items-center w-full">
                <h3 className="font-extrabold text-surface-900 leading-snug">{profile?.full_name || 'Teacher'}</h3>
                <div className="mt-2 mb-3">
                  {getVerificationBadge()}
                </div>
                <p className="text-sm text-surface-500 font-semibold">@{profile?.username || 'username'}</p>
                {user?.email && (
                  <p className="text-xs text-surface-400 mt-1 truncate max-w-full">{user.email}</p>
                )}
                <p className="text-xs text-surface-400 mt-1">School ID: {profile?.school_id || 'Global'}</p>
                {profile?.avatar_url && (
                  <button
                    onClick={handleRemoveAvatar}
                    className="text-xs text-danger-600 hover:text-danger-700 hover:underline font-semibold mt-3.5 flex items-center gap-1.5 transition-colors mx-auto"
                  >
                    <Trash2 size={12} /> Remove picture
                  </button>
                )}
              </div>
            </div>
          </Card>

          {/* School Affiliation */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={18} className="text-secondary-600" />
              <h3 className="font-bold text-surface-900">School Affiliation</h3>
            </div>
            <div className="text-sm text-surface-700 space-y-1">
              <p><strong>School Name:</strong> {schoolName}</p>
            </div>
          </Card>


        </div>

        {/* Right Column - Profile Form & Save */}
        <div className="md:col-span-2 flex flex-col gap-6">
          {/* Profile Form */}
          <Card>
            <h3 className="font-bold text-surface-900 mb-4">Edit Profile</h3>
            <div className="flex flex-col gap-4">
              <Input
                label="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <Input
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <Select
                label="School"
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                options={[
                  { value: '', label: 'Select School' },
                  ...schools.map((school) => ({
                    value: school.id,
                    label: school.name,
                  })),
                ]}
              />
            </div>
          </Card>

          <Button
            size="lg"
            className="w-full bg-secondary-500 hover:bg-secondary-600 text-white"
            icon={<Save size={18} />}
            loading={loading}
            onClick={handleSave}
          >
            Save Changes
          </Button>

          {/* Student Requests Section */}
          <Card>
            <div className="flex items-center gap-2 mb-4 border-b border-surface-100 pb-3">
              <span className="text-xl">🎓</span>
              <h3 className="font-bold text-surface-900 font-headline-sm">Student Requests</h3>
            </div>

            {fetchingRelations ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 text-secondary-500 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {studentRelations.filter(r => r.status === 'pending').length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {studentRelations.filter(r => r.status === 'pending').map((relation) => {
                      const initials = relation.student?.full_name?.[0]?.toUpperCase() || '?';
                      return (
                        <div 
                          key={relation.id}
                          className="flex items-center justify-between p-3.5 bg-surface-50 border border-surface-200 rounded-2xl"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar
                              avatarUrl={relation.student?.avatar_url || null}
                              initials={initials}
                              className="w-10 h-10 border border-white text-sm font-bold bg-primary-50 text-primary-700"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-surface-900 truncate">
                                {relation.student?.full_name || 'Student'}
                              </p>
                              <p className="text-xs text-surface-450 truncate">
                                @{relation.student?.username || 'username'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleUpdateRelationStatus(relation.id, 'approved')}
                              className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                            >
                              <Check size={14} /> Accept
                            </button>
                            <button
                              onClick={() => handleUpdateRelationStatus(relation.id, 'rejected')}
                              className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-danger-200"
                              title="Decline"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-surface-450 text-center py-2 font-medium">
                    No pending connection requests from students.
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* My Students Section */}
          <Card>
            <div className="flex items-center gap-2 mb-4 border-b border-surface-100 pb-3">
              <span className="text-xl">👥</span>
              <h3 className="font-bold text-surface-900 font-headline-sm">My Connected Students</h3>
            </div>

            {fetchingRelations ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 text-secondary-500 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {studentRelations.filter(r => r.status === 'approved').length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {studentRelations.filter(r => r.status === 'approved').map((relation) => {
                      const initials = relation.student?.full_name?.[0]?.toUpperCase() || '?';
                      return (
                        <div 
                          key={relation.id}
                          className="flex items-center justify-between p-3.5 bg-surface-50 border border-surface-200 rounded-2xl"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar
                              avatarUrl={relation.student?.avatar_url || null}
                              initials={initials}
                              className="w-10 h-10 border border-white text-sm font-bold bg-primary-50 text-primary-700"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-surface-900 truncate">
                                {relation.student?.full_name || 'Student'}
                              </p>
                              <p className="text-xs text-surface-450 truncate">
                                @{relation.student?.username || 'username'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full whitespace-nowrap">
                              {relation.student?.points || 0} XP
                            </span>
                            <button
                              onClick={() => handleDisconnectStudent(relation.id)}
                              className="p-1 text-danger hover:bg-danger-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove Student"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-surface-450 text-center py-2 font-medium">
                    No connected students yet.
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
