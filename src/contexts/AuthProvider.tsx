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

const hasOAuthParams = () => {
  const hash = window.location.hash;
  const search = window.location.search;
  return (
    hash.includes('access_token=') ||
    hash.includes('id_token=') ||
    hash.includes('error=') ||
    search.includes('code=') ||
    search.includes('error=')
  );
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setSession, setProfile, setLoading, setInitialized } = useAuthStore();

  useEffect(() => {
    let isMounted = true;
    const isCallback = hasOAuthParams();

    // Fallback timeout to ensure the app doesn't hang if OAuth fails silently
    let timeoutId: number | undefined;
    if (isCallback) {
      timeoutId = window.setTimeout(() => {
        if (isMounted) {
          console.warn('OAuth callback timed out. Initializing app anyway.');
          setLoading(false);
          setInitialized(true);
        }
      }, 3000); // 3 seconds timeout fallback
    }

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;

      // If we are not in an OAuth callback, we can initialize immediately.
      // If we are in an OAuth callback, we only initialize if we already have a session.
      if (!isCallback || session) {
        setSession(session);
        persistGoogleAccountInfo(session as Parameters<typeof persistGoogleAccountInfo>[0]);

        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          setProfile(profile);
        }

        if (timeoutId) clearTimeout(timeoutId);
        setLoading(false);
        setInitialized(true);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      setSession(session);
      persistGoogleAccountInfo(session as Parameters<typeof persistGoogleAccountInfo>[0]);

      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setProfile(profile);
      } else {
        setProfile(null);
      }

      // If we are in an OAuth callback and we receive the SIGNED_IN event (or a session exists),
      // we can finally mark the app as initialized.
      if (isCallback && (event === 'SIGNED_IN' || session)) {
        if (timeoutId) clearTimeout(timeoutId);
        setLoading(false);
        setInitialized(true);
      } else if (!isCallback) {
        // Normal flow
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [setSession, setProfile, setLoading, setInitialized]);

  return <>{children}</>;
}
