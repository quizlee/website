import { useEffect, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { Profile } from '../lib/types';

const LAST_GOOGLE_NAME_KEY = 'quizlee_last_google_name';
const LAST_GOOGLE_EMAIL_KEY = 'quizlee_last_google_email';
const LAST_GOOGLE_AVATAR_KEY = 'quizlee_last_google_avatar';
const LAST_AUTH_PROVIDER_KEY = 'quizlee_last_auth_provider';

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return data as Profile;
}

function persistGoogleAccountInfo(session: { user: { user_metadata: Record<string, string>; email?: string; app_metadata?: Record<string, unknown> } } | null) {
  if (!session) return;
  const { user } = session;
  const provider = (user.app_metadata as Record<string, string> | undefined)?.provider;
  if (provider === 'google') {
    const meta = user.user_metadata as Record<string, string>;
    const name = meta?.full_name || meta?.name || '';
    const email = user.email || '';
    const avatar = meta?.avatar_url || meta?.picture || '';
    if (name) localStorage.setItem(LAST_GOOGLE_NAME_KEY, name);
    if (email) localStorage.setItem(LAST_GOOGLE_EMAIL_KEY, email);
    if (avatar) localStorage.setItem(LAST_GOOGLE_AVATAR_KEY, avatar);
    localStorage.setItem(LAST_AUTH_PROVIDER_KEY, 'google');
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setSession, setProfile, setLoading, setInitialized } = useAuthStore();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      persistGoogleAccountInfo(session as Parameters<typeof persistGoogleAccountInfo>[0]);

      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setProfile(profile);
      }

      setLoading(false);
      setInitialized(true);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      persistGoogleAccountInfo(session as Parameters<typeof persistGoogleAccountInfo>[0]);

      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setProfile(profile);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [setSession, setProfile, setLoading, setInitialized]);

  return <>{children}</>;
}
