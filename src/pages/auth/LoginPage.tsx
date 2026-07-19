import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { toast } from '../../components/ui/Toast';
import { LogIn, Eye, EyeOff, ChevronRight, X } from 'lucide-react';

// Keys used to persist last-used Google account info
const LAST_GOOGLE_NAME_KEY = 'quizlee_last_google_name';
const LAST_GOOGLE_EMAIL_KEY = 'quizlee_last_google_email';
const LAST_GOOGLE_AVATAR_KEY = 'quizlee_last_google_avatar';
const LAST_AUTH_PROVIDER_KEY = 'quizlee_last_auth_provider';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Detected Google account state
  const [detectedGoogleName, setDetectedGoogleName] = useState<string | null>(null);
  const [detectedGoogleEmail, setDetectedGoogleEmail] = useState<string | null>(null);
  const [detectedGoogleAvatar, setDetectedGoogleAvatar] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);

  // On mount, read persisted Google account from localStorage
  useEffect(() => {
    const provider = localStorage.getItem(LAST_AUTH_PROVIDER_KEY);
    if (provider === 'google') {
      setDetectedGoogleName(localStorage.getItem(LAST_GOOGLE_NAME_KEY));
      setDetectedGoogleEmail(localStorage.getItem(LAST_GOOGLE_EMAIL_KEY));
      setDetectedGoogleAvatar(localStorage.getItem(LAST_GOOGLE_AVATAR_KEY));
    }
  }, []);

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

  // Redirect if logged in but no profile role yet (e.g. Google Auth setup)
  useEffect(() => {
    if (user && !profile?.role) {
      const signupRole = localStorage.getItem('oauth_signup_role');
      if (signupRole === 'student') {
        navigate('/complete-setup', { replace: true });
      } else {
        navigate('/register', { replace: true });
      }
    }
  }, [user, profile, navigate]);

  // Redirect if already logged in
  if (profile?.role) {
    const redirectMap = {
      student: '/student',
      teacher: '/teacher',
      admin: '/1234/admin',
    };
    navigate(redirectMap[profile.role], { replace: true });
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast(error.message, 'error');
    } else {
      toast('Welcome back! 🎉', 'success');
    }
    setLoading(false);
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      toast(error.message, 'error');
      setGoogleLoading(false);
    }
    // Don't reset loading — page will redirect
  }

  function handleForgetAccount() {
    localStorage.removeItem(LAST_AUTH_PROVIDER_KEY);
    localStorage.removeItem(LAST_GOOGLE_NAME_KEY);
    localStorage.removeItem(LAST_GOOGLE_EMAIL_KEY);
    localStorage.removeItem(LAST_GOOGLE_AVATAR_KEY);
    setDetectedGoogleName(null);
    setDetectedGoogleEmail(null);
    setDetectedGoogleAvatar(null);
  }

  // Google SVG icon
  const googleIcon = (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );

  // ── Detected Google account view ─────────────────────────────────────────
  if (detectedGoogleName && detectedGoogleEmail && !showEmailForm) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary-50 via-white to-secondary-50">
        <div className="w-full max-w-md animate-slide-up">
          {/* Brand */}
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #1d6ee6 0%, #38bdf8 100%)' }}
            >
              <span className="text-3xl">✨</span>
            </div>
            <h1 className="text-3xl font-extrabold text-surface-900">
              Welcome to <span className="text-primary-600">Quizlee</span>
            </h1>
            <p className="text-surface-500 mt-2">Last signed in as</p>
          </div>

          <Card className="mb-4">
            {/* Detected account pill */}
            <div className="flex items-center gap-4 p-4 bg-surface-50 border border-surface-200 rounded-2xl mb-5">
              {detectedGoogleAvatar ? (
                <img
                  src={detectedGoogleAvatar}
                  alt={detectedGoogleName}
                  className="w-12 h-12 rounded-full object-cover shadow-sm ring-2 ring-primary-100"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xl shadow-sm">
                  {detectedGoogleName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-surface-900 truncate">{detectedGoogleName}</p>
                <p className="text-sm text-surface-500 truncate">{detectedGoogleEmail}</p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                {googleIcon}
                Google
              </span>
            </div>

            {/* Continue button */}
            <Button
              size="lg"
              className="w-full mb-3"
              loading={googleLoading}
              onClick={handleGoogleLogin}
              icon={<ChevronRight size={18} />}
            >
              Continue as {detectedGoogleName.split(' ')[0]}
            </Button>

            {/* Not you? — clear and prominent */}
            <button
              type="button"
              onClick={handleForgetAccount}
              className="w-full text-sm text-surface-600 hover:text-danger-600 font-semibold py-2.5 rounded-xl border border-surface-200 hover:border-danger-200 hover:bg-danger-50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <X size={14} />
              Not {detectedGoogleName.split(' ')[0]}? Use a different account
            </button>
          </Card>

          <p className="text-center text-surface-500 text-sm">
            <button
              type="button"
              onClick={() => setShowEmailForm(true)}
              className="text-primary-600 font-semibold hover:text-primary-700 cursor-pointer"
            >
              Sign in with email instead
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── Default login view (email/password + Google) ──────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary-50 via-white to-secondary-50">
      <div className="w-full max-w-md animate-slide-up">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #1d6ee6 0%, #38bdf8 100%)' }}
          >
            <span className="text-3xl">✨</span>
          </div>
          <h1 className="text-3xl font-extrabold text-surface-900">
            Welcome to <span className="text-primary-600">Quizlee</span>
          </h1>
          <p className="text-surface-500 mt-2">Learn, Play, and Grow! 🚀</p>
        </div>

        <Card className="mb-6">
          {showEmailForm && (
            <button
              type="button"
              onClick={() => setShowEmailForm(false)}
              className="text-sm text-primary-600 font-medium hover:text-primary-700 mb-4 cursor-pointer flex items-center gap-1"
            >
              ← Back
            </button>
          )}

          {/* Google Login */}
          <Button
            variant="outline"
            size="lg"
            className="w-full mb-6"
            onClick={handleGoogleLogin}
            loading={googleLoading}
            icon={googleIcon}
          >
            Continue with Google
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-surface-200" />
            <span className="text-sm text-surface-400 font-medium">or</span>
            <div className="flex-1 h-px bg-surface-200" />
          </div>

          {/* Email Login Form */}
          <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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

            <div className="text-right">
              <Link to="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              size="lg"
              loading={loading}
              icon={<LogIn size={18} />}
              className="w-full"
            >
              Log In
            </Button>
          </form>
        </Card>

        {/* Register Link */}
        <p className="text-center text-surface-500">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary-600 font-semibold hover:text-primary-700">
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  );
}
