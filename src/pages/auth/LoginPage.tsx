import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';
import { ChevronRight, X } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [detectedGoogleName, setDetectedGoogleName] = useState<string | null>(null);
  const [detectedGoogleEmail, setDetectedGoogleEmail] = useState<string | null>(null);
  const [detectedGoogleAvatar, setDetectedGoogleAvatar] = useState<string | null>(null);

  // Load persisted Google account info
  useEffect(() => {
    const provider = localStorage.getItem('quizlee_last_auth_provider');
    if (provider === 'google') {
      setDetectedGoogleName(localStorage.getItem('quizlee_last_google_name'));
      setDetectedGoogleEmail(localStorage.getItem('quizlee_last_google_email'));
      setDetectedGoogleAvatar(localStorage.getItem('quizlee_last_google_avatar'));
    }
  }, []);

  // Show OAuth error if present
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const error = searchParams.get('error') || hashParams.get('error');
    const errorDescription = searchParams.get('error_description') || hashParams.get('error_description');
    if (error || errorDescription) {
      toast(errorDescription || error || 'Authentication failed', 'error');
      navigate(window.location.pathname, { replace: true });
    }
  }, [navigate]);

  // Redirect if already logged in
  useEffect(() => {
    if (profile?.role) {
      const redirectMap: Record<string, string> = {
        student: '/student',
        teacher: '/teacher',
        admin: '/1234/admin',
      };
      navigate(redirectMap[profile.role], { replace: true });
    }
  }, [profile, navigate]);

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
toast(error.message, 'error');
      setGoogleLoading(false);
    }
  }

  const googleIcon = (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.1-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );

  // Detected Google account view
  if (detectedGoogleName && detectedGoogleEmail) {
    return (
      <div className="relative h-screen bg-gradient-to-br from-indigo-200 via-purple-100 to-pink-200 p-4">

        
        <div className="flex h-full items-center justify-center">
          <div className="w-full max-w-md glass-card rounded-3xl p-8 backdrop-blur-lg bg-white/30 border border-white/20 shadow-xl">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg" style={{ background: 'linear-gradient(135deg, #1d6ee6 0%, #38bdf8 100%)' }}>
                <span className="text-3xl">✨</span>
              </div>
              <h1 className="text-3xl font-extrabold text-gray-800 mb-2">Welcome to <span className="bg-gradient-to-r from-[#1d6ee6] to-[#38bdf8] bg-clip-text text-transparent">Quizlee</span></h1>
              <p className="text-sm text-gray-600">Last signed in as</p>
            </div>
            <div className="flex items-center gap-4 p-4 bg-white/50 border border-white/30 rounded-xl mb-5">
              {detectedGoogleAvatar ? (
                <img src={detectedGoogleAvatar} alt={detectedGoogleName} className="w-12 h-12 rounded-full object-cover shadow-sm" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-800 font-bold text-xl">
                  {detectedGoogleName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{detectedGoogleName}</p>
                <p className="text-sm text-gray-600 truncate">{detectedGoogleEmail}</p>
              </div>
            </div>
            <Button size="lg" className="w-full whitespace-nowrap" loading={googleLoading} onClick={handleGoogleLogin} icon={<ChevronRight size={18} />}>
              Continue as {detectedGoogleName.split(' ')[0]}
            </Button>
            <button type="button" onClick={() => {
              localStorage.removeItem('quizlee_last_auth_provider');
              localStorage.removeItem('quizlee_last_google_name');
              localStorage.removeItem('quizlee_last_google_email');
              localStorage.removeItem('quizlee_last_google_avatar');
              setDetectedGoogleName(null);
              setDetectedGoogleEmail(null);
              setDetectedGoogleAvatar(null);
            }} className="mt-4 w-full text-sm text-gray-600 hover:text-red-600 font-semibold py-2.5 rounded-xl border border-gray-200 hover:border-red-200 hover:bg-red-50 flex items-center justify-center gap-1.5">
              <X size={14} />
              Not {detectedGoogleName.split(' ')[0]}? Use a different account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default Google login view
  return (
    <div className="relative h-screen bg-gradient-to-br from-indigo-200 via-purple-100 to-pink-200 p-4">
      <div className="flex h-full items-center justify-center">
        <div className="w-full max-w-md glass-card rounded-3xl p-8 backdrop-blur-lg bg-white/30 border border-white/20 shadow-xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg" style={{ background: 'linear-gradient(135deg, #1d6ee6 0%, #38bdf8 100%)' }}>
              <span className="text-3xl">✨</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-800 mb-2">Welcome to <span className="bg-gradient-to-r from-[#1d6ee6] to-[#38bdf8] bg-clip-text text-transparent">Quizlee</span></h1>
            <p className="text-sm text-gray-600">Learn, Play, and Grow! 🚀</p>
          </div>
          <Button variant="outline" size="lg" className="w-full whitespace-nowrap" onClick={handleGoogleLogin} loading={googleLoading} icon={googleIcon}>
            Continue with Google
          </Button>
        </div>
      </div>
    </div>
  );
}
