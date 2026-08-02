import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Card } from '../../components/ui/Card';
import { toast } from '../../components/ui/Toast';
import type { School, Class } from '../../lib/types';
import { School as SchoolIcon, GraduationCap, BookOpen } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';

export default function CompleteSetupPage() {
  const navigate = useNavigate();
  const { user, profile, setProfile, initialized, loading: authLoading } = useAuthStore();
  const [loading, setLoading] = useState(false);

  // Form states
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState('');
  // const [dateOfBirth, setDateOfBirth] = useState(''); // removed per requirements
  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');

  // Data lists
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  // Guard routing & pre-fill from user metadata / existing profile
  useEffect(() => {
    if (initialized && !authLoading) {
      if (!user) {
        navigate('/login', { replace: true });
        return;
      }
      
      // If student profile is already fully set up, redirect directly to student homepage
      if (profile?.role === 'student' && profile.school_id && profile.class_id) {
        navigate('/student', { replace: true });
        return;
      }

      // If teacher profile already exists, redirect to teacher panel / approval page
      if (profile?.role === 'teacher') {
        const path = profile.verification_status === 'approved' ? '/teacher' : '/teacher/pending';
        navigate(path, { replace: true });
        return;
      }

      // Pre-fill fields (username & DOB removed per requirements)
      const meta = user.user_metadata;
      setFullName(profile?.full_name || meta?.full_name || meta?.name || localStorage.getItem('quizlee_last_google_name') || '');
      setGender(profile?.gender || meta?.gender || '');
      setSchoolId(profile?.school_id || '');
      setClassId(profile?.class_id || '');
      if (profile?.role) {
        setRole(profile.role as 'student' | 'teacher');
      }
    }
  }, [user, profile, initialized, authLoading, navigate]);

  // (Username sync removed; username is generated on submit)

  // (Live username availability check removed per requirements)

  // Fetch active schools
  useEffect(() => {
    supabase
      .from('schools')
      .select('*')
      .eq('status', 'active')
      .order('name')
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching schools:', error);
        } else if (data) {
          setSchools(data);
        }
      });
  }, []);

  // Fetch classes when school selection changes
  useEffect(() => {
    if (!schoolId) {
      setClasses([]);
      setClassId('');
      return;
    }
    supabase
      .from('classes')
      .select('*')
      .or(`school_id.eq.${schoolId},school_id.is.null`)
      .order('sort_order')
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching classes:', error);
        } else if (data) {
          setClasses(data);
        }
      });
  }, [schoolId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      const profileData = {
        role,
        full_name: fullName,
        // Generate a simple username from the first part of full name
        username: fullName.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, ''),
        gender: gender || null,
        date_of_birth: null,
        school_id: (role === 'student' || role === 'teacher') ? schoolId : null,
        class_id: role === 'student' ? classId : null,
        verification_status: role === 'teacher' ? 'pending' : null,
        avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      };

      let updateError;
      if (existingProfile) {
        const { error } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', user.id);
        updateError = error;
      } else {
        const { error } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            ...profileData,
            status: 'active',
          });
        updateError = error;
      }

      if (updateError) throw updateError;

      // Fetch the updated profile
      const { data: newProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (fetchError) throw fetchError;

      if (newProfile) {
        setProfile(newProfile);
      }

      toast('Setup completed successfully! 🎉', 'success');
      const redirectPath = role === 'teacher' ? '/teacher/pending' : '/student';
      navigate(redirectPath, { replace: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to complete setup';
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!initialized || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-accent-50 via-white to-primary-50">
        <p className="text-surface-500 font-semibold">Loading setup details...</p>
      </div>
    );
  }

  const googleAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || localStorage.getItem('quizlee_last_google_avatar') || null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-accent-50 via-white to-primary-50">
      <div className="w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #1d6ee6 0%, #38bdf8 100%)' }}
          >
            <GraduationCap size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-surface-900">
            Complete Setup 🎓
          </h1>
          <p className="text-surface-500 mt-2">Just a few quick details to start learning on Quizlee!</p>
        </div>

        <Card>
          {/* User info info pill */}
          <div className="flex items-center gap-3 bg-surface-50 border border-surface-200 rounded-2xl px-4 py-3 mb-6">
            <Avatar
              avatarUrl={profile?.avatar_url || googleAvatar}
              initials={fullName.charAt(0).toUpperCase() || '?'}
              className="w-10 h-10 text-sm font-bold border border-surface-200"
            />
            <div className="min-w-0">
              <p className="font-semibold text-surface-900 text-sm truncate">{fullName || 'User'}</p>
              <p className="text-xs text-surface-500 truncate">{user?.email}</p>
            </div>
            <span className="ml-auto shrink-0 text-xs font-semibold text-primary-600 bg-primary-50 border border-primary-200 px-2.5 py-0.5 rounded-full capitalize">
              {role}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Role picker hidden */}

            <Input
              label="Full Name"
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            {(role === 'student' || role === 'teacher') && (
              <Select
                label="School"
                placeholder="Select your school"
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                options={schools.map((s) => ({ value: s.id, label: s.name }))}
                required
              />
            )}

            {role === 'student' && (
              <Select
                label="Class"
                placeholder={schoolId ? "Select your class" : "Select school first"}
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                options={classes.map((c) => ({ value: c.id, label: c.name }))}
                disabled={!schoolId}
                required
              />
            )}

            <Button
              type="submit"
              size="lg"
              loading={loading}
              icon={<SchoolIcon size={18} />}
              className="w-full mt-2"
            >
              Complete Setup
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
