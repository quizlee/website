import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { toast } from '../../components/ui/Toast';
import { ShieldAlert, UserPlus } from 'lucide-react';

export default function SetupPage() {
  const navigate = useNavigate();
  const { setProfile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

  // Form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('admin');

  useEffect(() => {
    async function checkSetup() {
      const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'admin_setup_complete')
        .single();

      if (data && data.value === 'true') {
        setSetupComplete(true);
        navigate('/login', { replace: true });
      }
      setChecking(false);
      setLoading(false);
    }
    checkSetup();
  }, [navigate]);

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Create the user in Auth. The database trigger will automatically:
      //    a. Assign the 'admin' role to this first user
      //    b. Mark admin_setup_complete as 'true' in settings
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Failed to create admin auth user.');

      // Wait a moment for trigger execution
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (!authData.session) {
        // Email confirmation is enabled
        setIsEmailSent(true);
        toast('Setup initiated! Please check your email to verify.', 'success');
      } else {
        // Email confirmation is disabled, logged in automatically
        // Set username in profile
        await supabase
          .from('profiles')
          .update({ username })
          .eq('id', authData.user.id);

        const { data: newProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (newProfile) {
          setProfile(newProfile);
        }

        toast('Super Admin account created successfully! 🎉', 'success');
        navigate('/1234/admin', { replace: true });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Setup failed';
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isEmailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface-50">
        <div className="w-full max-w-md animate-slide-up text-center">
          <Card className="p-8">
            <div className="text-5xl mb-4">📧</div>
            <h1 className="text-2xl font-bold text-surface-900 mb-2">Verify Your Email</h1>
            <p className="text-surface-600 mb-6 text-sm">
              We have sent a verification link to <strong>{email}</strong>. 
              Please click the link in your email to confirm your account and access the Admin Dashboard.
            </p>
            <Button onClick={() => navigate('/login')} className="w-full">
              Go to Login Page
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (setupComplete) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-50">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-danger-500 rounded-2xl mb-4 shadow-lg">
            <ShieldAlert size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-surface-900">Initial Admin Setup</h1>
          <p className="text-surface-500 mt-2">Configure the super-admin account</p>
        </div>

        <Card className="border border-surface-200">
          <form onSubmit={handleSetup} className="flex flex-col gap-4">
            <Input
              label="Full Name"
              placeholder="System Administrator"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <Input
              label="Admin Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />

            <Input
              label="Admin Email"
              type="email"
              placeholder="admin@quizlee.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Admin Password"
              type="password"
              placeholder="Choose a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              helpText="Minimum 6 characters"
            />

            <Button
              type="submit"
              size="lg"
              loading={loading}
              icon={<UserPlus size={18} />}
              className="w-full bg-danger-600 hover:bg-danger-700 text-white mt-2"
            >
              Initialize Platform
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
