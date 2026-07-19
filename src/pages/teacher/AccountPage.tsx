import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { toast } from '../../components/ui/Toast';

import { Camera, Save, BookOpen, ShieldCheck, Trash2 } from 'lucide-react';

export default function TeacherAccountPage() {
  const { profile, user, setProfile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [schoolName, setSchoolName] = useState('Loading...');

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
      })
      .eq('id', profile.id);

    if (error) {
      toast(error.message, 'error');
    } else {
      setProfile({ ...profile, full_name: fullName, username });
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
          <Card>
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-secondary-100 flex items-center justify-center text-3xl font-bold text-secondary-600 overflow-hidden">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    profile?.full_name?.[0]?.toUpperCase() || '?'
                  )}
                </div>
                <label className="absolute -bottom-1 -right-1 w-8 h-8 bg-secondary-500 rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-secondary-600 transition-colors">
                  <Camera size={14} className="text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-surface-900">{profile?.full_name || 'Teacher'}</h3>
                  {getVerificationBadge()}
                </div>
                <p className="text-sm text-surface-500">@{profile?.username || 'username'}</p>
                {user?.email && (
                  <p className="text-xs text-surface-400 mt-0.5">{user.email}</p>
                )}
                <p className="text-xs text-surface-400 mt-1">School ID: {profile?.school_id || 'Global'}</p>
                {profile?.avatar_url && (
                  <button
                    onClick={handleRemoveAvatar}
                    className="text-xs text-danger-600 hover:text-danger-700 hover:underline font-semibold mt-2 flex items-center gap-1 transition-colors"
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

          {/* Claimed Subjects */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <BookOpen size={18} className="text-secondary-600" />
              <h3 className="font-bold text-surface-900">Claimed Subjects</h3>
            </div>
            {profile?.subjects_claimed && profile.subjects_claimed.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.subjects_claimed.map((sub, i) => (
                  <Badge key={i} variant="info">{sub}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-400">No subjects registered yet.</p>
            )}
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
        </div>
      </div>
    </div>
  );
}
