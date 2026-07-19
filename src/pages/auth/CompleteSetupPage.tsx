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
import { School as SchoolIcon, GraduationCap, BookOpen, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';

export default function CompleteSetupPage() {
  const navigate = useNavigate();
  const { user, profile, setProfile, initialized, loading: authLoading } = useAuthStore();
  const [loading, setLoading] = useState(false);

  // Form states
  const [role, setRole] = useState<'student' | 'teacher'>(() => {
    const saved = localStorage.getItem('oauth_signup_role');
    return saved === 'teacher' ? 'teacher' : 'student';
  });
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [isUsernameEdited, setIsUsernameEdited] = useState(false);

  // Live username check state
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);

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

      // Pre-fill fields
      const meta = user.user_metadata;
      setFullName(profile?.full_name || meta?.full_name || meta?.name || localStorage.getItem('quizlee_last_google_name') || '');
      setUsername(profile?.username || '');
      setGender(profile?.gender || meta?.gender || '');
      setDateOfBirth(profile?.date_of_birth || meta?.date_of_birth || meta?.birthdate || '');
      setSchoolId(profile?.school_id || '');
      setClassId(profile?.class_id || '');
      if (profile?.role) {
        setRole(profile.role as 'student' | 'teacher');
      }
    }
  }, [user, profile, initialized, authLoading, navigate]);

  // Sync username from full name if not already set and not manually edited
  useEffect(() => {
    if (!isUsernameEdited && !username && fullName) {
      const firstName = fullName.trim().split(/\s+/)[0] || '';
      setUsername(firstName.toLowerCase().replace(/[^a-z0-9]/g, ''));
    }
  }, [fullName, username, isUsernameEdited]);

  // Live username availability check
  useEffect(() => {
    if (!username) {
      setIsUsernameAvailable(null);
      return;
    }

    if (username.length < 3) {
      setIsUsernameAvailable(false);
      return;
    }

    if (profile?.username === username) {
      setIsUsernameAvailable(true);
      return;
    }

    setCheckingUsername(true);
    const timer = setTimeout(async () => {
      try {
        const { data: exists, error } = await supabase.rpc('check_username_exists', {
          username_to_check: username,
        });

        if (error) {
          console.error('Error checking username:', error);
          setIsUsernameAvailable(null);
        } else {
          setIsUsernameAvailable(!exists);
        }
      } catch (err) {
        console.error('Failed to verify username availability:', err);
        setIsUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username, profile?.username]);

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
    if (isUsernameAvailable === false) {
      toast('Please choose a different username', 'error');
      return;
    }
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
        username,
        gender: gender || null,
        date_of_birth: dateOfBirth || null,
        school_id: role === 'student' ? schoolId : null,
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
            {/* Role picker */}
            <div>
              <p className="text-sm font-semibold text-surface-700 mb-2">I am a...</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`p-4 rounded-2xl border-2 text-center transition-all duration-200 cursor-pointer
                    ${role === 'student'
                      ? 'border-primary-500 bg-primary-50 shadow-md'
                      : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50'
                    }`}
                >
                  <GraduationCap size={28} className={`mx-auto mb-1 ${role === 'student' ? 'text-primary-600' : 'text-surface-400'}`} />
                  <p className={`font-bold text-sm ${role === 'student' ? 'text-primary-700' : 'text-surface-600'}`}>Student</p>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('teacher')}
                  className={`p-4 rounded-2xl border-2 text-center transition-all duration-200 cursor-pointer
                    ${role === 'teacher'
                      ? 'border-secondary-500 bg-secondary-50 shadow-md'
                      : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50'
                    }`}
                >
                  <BookOpen size={28} className={`mx-auto mb-1 ${role === 'teacher' ? 'text-secondary-600' : 'text-surface-400'}`} />
                  <p className={`font-bold text-sm ${role === 'teacher' ? 'text-secondary-700' : 'text-surface-600'}`}>Teacher</p>
                </button>
              </div>
            </div>

            <Input
              label="Full Name"
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <div className="relative">
              <span className="absolute left-4 top-[38px] text-surface-400 font-semibold select-none">
                @
              </span>
              <Input
                label="Username"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                  setIsUsernameEdited(true);
                }}
                required
                className="pl-8 pr-10"
                error={!username ? 'Username is required' : (isUsernameAvailable === false ? (username.length < 3 ? 'Username must be at least 3 characters' : 'Username is already taken') : undefined)}
                helpText={isUsernameAvailable === true && username ? 'Username is available' : undefined}
              />
              <div className="absolute right-3 top-[38px] flex items-center justify-center pointer-events-none">
                {checkingUsername && (
                  <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                )}
                {!checkingUsername && isUsernameAvailable === true && (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
                {!checkingUsername && isUsernameAvailable === false && (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>

            <Select
              label="Gender"
              placeholder="Select gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
              ]}
            />

            <Input
              label="Date of Birth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />

            {role === 'student' && (
              <>
                <Select
                  label="School"
                  placeholder="Select your school"
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                  options={schools.map((s) => ({ value: s.id, label: s.name }))}
                  required
                />

                <Select
                  label="Class"
                  placeholder={schoolId ? "Select your class" : "Select school first"}
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  options={classes.map((c) => ({ value: c.id, label: c.name }))}
                  disabled={!schoolId}
                  required
                />
              </>
            )}

            <Button
              type="submit"
              size="lg"
              loading={loading || checkingUsername}
              disabled={isUsernameAvailable === false}
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
