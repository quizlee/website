import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Card } from '../../components/ui/Card';
import { toast } from '../../components/ui/Toast';
import type { School, Class } from '../../lib/types';
import { UserPlus, GraduationCap, BookOpen, Eye, EyeOff, School as SchoolIcon } from 'lucide-react';

type RegistrationStep = 'role' | 'details' | 'google-setup';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { user, profile, setProfile } = useAuthStore();
  const [step, setStep] = useState<RegistrationStep>('role');
  const [loading, setLoading] = useState(false);

  // Form state
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [isUsernameEdited, setIsUsernameEdited] = useState(false);

  // Data
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  // If user already has a profile with role, redirect
  useEffect(() => {
    if (profile?.role) {
      if (profile.role === 'student' && (!profile.school_id || !profile.class_id)) {
        navigate('/complete-setup', { replace: true });
        return;
      }
      const redirectMap = {
        student: '/student',
        teacher: '/teacher',
        admin: '/1234/admin',
      };
      navigate(redirectMap[profile.role], { replace: true });
    }
  }, [profile, navigate]);

  // Show error from OAuth redirect if present in URL query params or hash
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const error = searchParams.get('error') || hashParams.get('error');
    const errorDescription = searchParams.get('error_description') || hashParams.get('error_description');

    if (error || errorDescription) {
      toast(errorDescription || error || 'Authentication failed', 'error');
      // Clean URL params from address bar
      navigate(window.location.pathname, { replace: true });
    }
  }, [navigate]);

  // If signed in via Google but no role yet → check role from signup and redirect or show setup step
  useEffect(() => {
    if (user && !profile?.role) {
      const signupRole = localStorage.getItem('oauth_signup_role');
      if (signupRole === 'student') {
        navigate('/complete-setup', { replace: true });
        return;
      }
      
      // Auto-fill from Google metadata
      const meta = user.user_metadata;
      setFullName(meta?.full_name || meta?.name || '');
      setEmail(user.email || '');
      // Gender: Google doesn't provide it — leave blank
      // DOB: Google doesn't reliably provide it — leave blank
      setStep('google-setup');
    }
  }, [user, profile, navigate]);

  // Fetch schools
  useEffect(() => {
    supabase
      .from('schools')
      .select('*')
      .eq('status', 'active')
      .order('name')
      .then(({ data }) => {
        if (data) setSchools(data);
      });
  }, []);

  // Fetch classes when school changes
  useEffect(() => {
    if (!schoolId) {
      setClasses([]);
      setClassId('');
      return;
    }
    setClassId('');
    supabase
      .from('classes')
      .select('*')
      .or(`school_id.eq.${schoolId},school_id.is.null`)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setClasses(data);
      });
  }, [schoolId]);

  // Sync username from full name if not already set and not manually edited
  useEffect(() => {
    if (!isUsernameEdited && !username && fullName) {
      const firstName = fullName.trim().split(/\s+/)[0] || '';
      setUsername(firstName.toLowerCase().replace(/[^a-z0-9]/g, ''));
    }
  }, [fullName, username, isUsernameEdited]);

  // ─── Email/password submit ───────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (password !== confirmPassword) {
      toast('Passwords do not match!', 'error');
      setLoading(false);
      return;
    }

    try {
      const { data: emailExists, error: rpcError } = await supabase.rpc('check_email_exists', {
        email_to_check: email,
      });

      if (rpcError) {
        console.error('Error checking email uniqueness:', rpcError);
      } else if (emailExists) {
        toast('This email is already registered!', 'error');
        setLoading(false);
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
            username,
            gender: gender || null,
            date_of_birth: dateOfBirth || null,
            school_id: schoolId || null,
            class_id: role === 'student' ? classId || null : null,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('Registration failed');

      if (!signUpData.session) {
        setIsEmailSent(true);
        toast('Account created! Please check your email to verify.', 'success');
      } else {
        const { data: newProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', signUpData.user.id)
          .single();

        if (newProfile) setProfile(newProfile);

        toast('Account created successfully! 🎉', 'success');
        navigate(role === 'teacher' ? '/teacher/pending' : '/student');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // ─── Google setup submit (school + class only) ────────────────────────────
  async function handleGoogleSetupSubmit(e: React.FormEvent) {
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
        username,
        full_name: fullName,
        gender: user.user_metadata?.gender || null,
        date_of_birth: user.user_metadata?.birthdate || null,
        school_id: schoolId || null,
        class_id: role === 'student' ? classId || null : null,
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

      const { data: newProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (newProfile) setProfile(newProfile);

      toast('Account set up successfully! 🎉', 'success');
      navigate(role === 'teacher' ? '/teacher/pending' : '/student');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Setup failed';
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignUp() {
    localStorage.setItem('oauth_signup_role', role);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      toast(error.message, 'error');
    }
  }

  // ─── Email sent screen ────────────────────────────────────────────────────
  if (isEmailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-accent-50 via-white to-primary-50">
        <div className="w-full max-w-md animate-slide-up text-center">
          <Card className="p-8">
            <div className="text-5xl mb-4">📧</div>
            <h1 className="text-2xl font-bold text-surface-900 mb-2">Verify Your Email</h1>
            <p className="text-surface-600 mb-6 text-sm">
              We have sent a verification link to <strong>{email}</strong>.{' '}
              Please click the link in your email to verify your email address and activate your account.
            </p>
            <Button onClick={() => navigate('/login')} className="w-full">
              Go to Login Page
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // ─── Google setup screen ──────────────────────────────────────────────────
  if (step === 'google-setup') {
    const googleName = user?.user_metadata?.full_name || user?.user_metadata?.name || 'there';
    const googleAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-accent-50 via-white to-primary-50">
        <div className="w-full max-w-md animate-slide-up">
          {/* Header */}
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #1d6ee6 0%, #38bdf8 100%)' }}
            >
              <span className="text-3xl">✨</span>
            </div>
            <h1 className="text-3xl font-extrabold text-surface-900">
              Join <span className="text-primary-600">Quizlee</span>
            </h1>
            <p className="text-surface-500 mt-2">Almost there! Just a few more details.</p>
          </div>

          <Card>
            {/* Google account info pill */}
            <div className="flex items-center gap-3 bg-surface-50 border border-surface-200 rounded-2xl px-4 py-3 mb-6">
              {googleAvatar ? (
                <img src={googleAvatar} alt={googleName} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-lg">
                  {googleName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-surface-900 text-sm truncate">{googleName}</p>
                <p className="text-xs text-surface-500 truncate">{user?.email}</p>
              </div>
              <span className="ml-auto shrink-0 text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                Google ✓
              </span>
            </div>

            <form onSubmit={handleGoogleSetupSubmit} className="flex flex-col gap-4">
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
                autoComplete="name"
              />

              <Input
                label="Username"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                  setIsUsernameEdited(true);
                }}
                required
                autoComplete="username"
              />

              {/* School */}
              <Select
                label="School"
                placeholder="Select your school"
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                options={schools.map((s) => ({ value: s.id, label: s.name }))}
                required
              />

              {/* Class — only for students after choosing a school */}
              {role === 'student' && schoolId && (
                <Select
                  label="Class"
                  placeholder="Select your class"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  options={classes.map((c) => ({ value: c.id, label: c.name }))}
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

          <p className="text-center text-surface-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-semibold hover:text-primary-700">
              Log in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // ─── Main register screen ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-accent-50 via-white to-primary-50">
      <div className="w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #1d6ee6 0%, #38bdf8 100%)' }}
          >
            <span className="text-3xl">✨</span>
          </div>
          <h1 className="text-3xl font-extrabold text-surface-900">
            Join <span className="text-primary-600">Quizlee</span>
          </h1>
          <p className="text-surface-500 mt-2">Start your learning adventure!</p>
        </div>

        <Card>
          {step === 'role' ? (
            <>
              <h2 className="text-lg font-bold text-surface-900 mb-4">I am a...</h2>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`
                    p-6 rounded-2xl border-2 text-center transition-all duration-200 cursor-pointer
                    ${role === 'student'
                      ? 'border-primary-500 bg-primary-50 shadow-md'
                      : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50'
                    }
                  `}
                >
                  <GraduationCap size={32} className={`mx-auto mb-2 ${role === 'student' ? 'text-primary-600' : 'text-surface-400'}`} />
                  <p className={`font-bold ${role === 'student' ? 'text-primary-700' : 'text-surface-600'}`}>Student</p>
                  <p className="text-xs text-surface-400 mt-1">Learn &amp; Play</p>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('teacher')}
                  className={`
                    p-6 rounded-2xl border-2 text-center transition-all duration-200 cursor-pointer
                    ${role === 'teacher'
                      ? 'border-secondary-500 bg-secondary-50 shadow-md'
                      : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50'
                    }
                  `}
                >
                  <BookOpen size={32} className={`mx-auto mb-2 ${role === 'teacher' ? 'text-secondary-600' : 'text-surface-400'}`} />
                  <p className={`font-bold ${role === 'teacher' ? 'text-secondary-700' : 'text-surface-600'}`}>Teacher</p>
                  <p className="text-xs text-surface-400 mt-1">Create &amp; Manage</p>
                </button>
              </div>

              {/* Google sign-up — always visible on the role step */}
              <Button
                variant="outline"
                size="lg"
                className="w-full mb-4"
                onClick={handleGoogleSignUp}
                icon={
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                }
              >
                Sign up with Google
              </Button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-surface-200" />
                <span className="text-sm text-surface-400 font-medium">or</span>
                <div className="flex-1 h-px bg-surface-200" />
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={() => setStep('details')}
              >
                Continue with Email
              </Button>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => setStep('role')}
                className="text-sm text-primary-600 font-medium self-start hover:text-primary-700 mb-2 cursor-pointer"
              >
                ← Back to role selection
              </button>

              <Input
                label="Full Name"
                placeholder="Your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />

              <Input
                label="Email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />

              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Choose a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                helpText="Minimum 6 characters"
                autoComplete="new-password"
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-surface-400 hover:text-surface-600 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />

              <Input
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-surface-400 hover:text-surface-600 transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />

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

              <Select
                label="School"
                placeholder="Select your school"
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                options={schools.map((s) => ({ value: s.id, label: s.name }))}
                required
              />

              {role === 'student' && schoolId && (
                <Select
                  label="Class"
                  placeholder="Select your class"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  options={classes.map((c) => ({ value: c.id, label: c.name }))}
                  required
                />
              )}

              <Button
                type="submit"
                size="lg"
                loading={loading}
                icon={<UserPlus size={18} />}
                className="w-full mt-2"
              >
                Create Account
              </Button>
            </form>
          )}
        </Card>

        <p className="text-center text-surface-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 font-semibold hover:text-primary-700">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
