import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getAuthCallbackUrl } from '@/lib/auth/authRedirect';
import { getAppOrigin } from '@/lib/auth/appUrl';
import { deriveAuthAccessState, isEmailConfirmed, type AuthAccessState } from '@/lib/auth/authAccess';
import { AuthFlowError, AUTH_FLOW_CODES } from '@/lib/auth/authErrors';
import { assertAuthRateLimitAllowed } from '@/lib/auth/authRateLimitClient';
import { emailDomainOnly, logAuthAuditEvent } from '@/lib/auth/authAudit';
import { Session, User } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';

/** Chave legada para limpar sessão de portal no logout (compatibilidade). */
const PORTAL_SESSION_STORAGE_KEY_LEGACY = 'escalax_portal_session';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  airline: string | null;
  registration: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  onboarding_step: number;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  providerToken: string | null;
  /** Indica se o email foi confirmado (auth.users.email_confirmed_at). */
  emailConfirmed: boolean;
  authAccessState: AuthAccessState;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resendConfirmationEmail: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const PROVIDER_TOKEN_STORAGE_KEY = 'google_provider_token';

const APP_STORAGE_KEYS = [
  PROVIDER_TOKEN_STORAGE_KEY,
  PORTAL_SESSION_STORAGE_KEY_LEGACY,
  'escalax_schedule',
  'escalax_user',
];

let _queryClient: QueryClient | null = null;

export function registerQueryClient(qc: QueryClient) {
  _queryClient = qc;
}

function captureAndPersistProviderToken(session: Session | null): string | null {
  const sessionToken = (session as { provider_token?: string | null } | null)?.provider_token ?? null;
  if (sessionToken) {
    localStorage.setItem(PROVIDER_TOKEN_STORAGE_KEY, sessionToken);
    return sessionToken;
  }

  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  const hashToken = hashParams.get('provider_token');
  if (hashToken) {
    localStorage.setItem(PROVIDER_TOKEN_STORAGE_KEY, hashToken);
    return hashToken;
  }

  const queryToken = new URLSearchParams(window.location.search).get('provider_token');
  if (queryToken) {
    localStorage.setItem(PROVIDER_TOKEN_STORAGE_KEY, queryToken);
    return queryToken;
  }

  const storedToken = localStorage.getItem(PROVIDER_TOKEN_STORAGE_KEY);
  if (storedToken) return storedToken;

  return null;
}

/**
 * Garante uma linha em `profiles` por `user_id` (constraint UNIQUE + upsert idempotente).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [providerToken, setProviderToken] = useState<string | null>(null);

  const emailConfirmed = useMemo(() => isEmailConfirmed(user), [user]);

  const authAccessState = useMemo(
    () => deriveAuthAccessState(loading, session, user),
    [loading, session, user],
  );

  const fetchProfile = async (userId: string) => {
    const { data: row, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (import.meta.env.DEV) {
        console.warn('[auth] profiles SELECT:', error.code, error.message);
      }
      setProfile(null);
      return;
    }

    if (row) {
      setProfile(row as Profile);
      return;
    }

    /** Sem linha: upsert idempotente (onConflict user_id) — não cria duplicados. */
    const { data: authData } = await supabase.auth.getUser();
    const u = authData.user;
    if (!u || u.id !== userId) {
      setProfile(null);
      return;
    }

    const meta = (u.user_metadata || {}) as Record<string, unknown>;
    const nameFromMeta = String(meta.full_name || meta.name || '').trim();
    const email = u.email ?? '';
    const displayName = nameFromMeta || email.split('@')[0] || 'Usuário';

    const { data: upserted, error: upsertErr } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: userId,
          email,
          name: displayName,
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single();

    if (upsertErr) {
      if (import.meta.env.DEV) {
        console.warn('[auth] profiles upsert (ensure) falhou:', upsertErr.message);
      }
      setProfile(null);
      return;
    }

    if (import.meta.env.DEV) {
      console.info('[auth] perfil criado/atualizado automaticamente para user_id', userId);
    }
    setProfile(upserted as Profile);
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      const token = captureAndPersistProviderToken(nextSession);
      setProviderToken(token);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setProviderToken(null);
        _queryClient?.clear();
      } else if (nextSession?.user && isEmailConfirmed(nextSession.user)) {
        setTimeout(() => fetchProfile(nextSession.user.id), 200);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    const deferInitialSession =
      typeof window !== 'undefined' &&
      window.location.pathname === '/auth/callback' &&
      (window.location.hash.length > 1 || window.location.search.includes('code='));

    const runInitialSession = () => {
      void supabase.auth.getSession().then(async ({ data: { session: initial } }) => {
        const token = captureAndPersistProviderToken(initial);
        setProviderToken(token);

        let next = initial;
        if (next?.access_token) {
          const { error: userErr } = await supabase.auth.getUser();
          if (userErr) {
            const { data: ref } = await supabase.auth.refreshSession();
            next = ref.session ?? next;
            await supabase.auth.getUser();
            const { data: again } = await supabase.auth.getSession();
            next = again.session ?? next;
          } else {
            const { data: again } = await supabase.auth.getSession();
            next = again.session ?? next;
          }
        }

        setSession(next);
        setUser(next?.user ?? null);
        if (next?.user && isEmailConfirmed(next.user)) {
          void fetchProfile(next.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      });
    };

    if (deferInitialSession) {
      const id = window.setTimeout(runInitialSession, 220);
      return () => {
        window.clearTimeout(id);
        subscription.unsubscribe();
      };
    }

    runInitialSession();
    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    const normalizedEmail = normalizeEmail(email);
    await assertAuthRateLimitAllowed('signup', normalizedEmail);
    logAuthAuditEvent('signup_requested', { domain: emailDomainOnly(normalizedEmail) });
    const emailRedirectTo = getAuthCallbackUrl();
    if (import.meta.env.DEV) {
      console.info('[auth/signUp] emailRedirectTo', emailRedirectTo, 'appOrigin', getAppOrigin());
    }
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { name },
        emailRedirectTo,
      },
    });
    if (error) throw error;
    logAuthAuditEvent('signup_completed', { ok: true });
    if (data?.user && !isEmailConfirmed(data.user)) {
      logAuthAuditEvent('email_confirmation_sent', { domain: emailDomainOnly(normalizedEmail) });
    }
  };

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = normalizeEmail(email);
    await assertAuthRateLimitAllowed('login', normalizedEmail);
    sessionStorage.removeItem('escalax_onboarding_dismissed');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error) {
      logAuthAuditEvent('login_failed', { code: error.code ?? 'unknown' });
      throw error;
    }
    const u = data.user;
    if (u && !isEmailConfirmed(u)) {
      await supabase.auth.signOut();
      logAuthAuditEvent('blocked_unconfirmed_user', { domain: emailDomainOnly(u.email ?? undefined) });
      throw new AuthFlowError(AUTH_FLOW_CODES.EMAIL_NOT_CONFIRMED);
    }
    logAuthAuditEvent('login_succeeded', { domain: emailDomainOnly(u?.email ?? undefined) });
  };

  const resendConfirmationEmail = async (email: string) => {
    const normalizedEmail = normalizeEmail(email);
    await assertAuthRateLimitAllowed('resend_confirmation', normalizedEmail);
    logAuthAuditEvent('resend_confirmation_requested', { domain: emailDomainOnly(normalizedEmail) });
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
      },
    });
    if (error) {
      logAuthAuditEvent('resend_confirmation_failed', { code: error.code ?? 'unknown' });
      throw error;
    }
    logAuthAuditEvent('resend_confirmation_succeeded', { domain: emailDomainOnly(normalizedEmail) });
  };

  const signOut = async () => {
    logAuthAuditEvent('logout');
    const uid = user?.id;
    if (uid) {
      sessionStorage.removeItem(`escalax_latam_app_last_sync_ms_${uid}`);
      sessionStorage.removeItem(`escalax_latam_app_initial_connect_${uid}`);
    }
    APP_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    sessionStorage.removeItem('escalax_onboarding_dismissed');

    _queryClient?.clear();

    setProfile(null);
    setProviderToken(null);
    setSession(null);
    setUser(null);

    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[EscalaX boot] auth init ok');
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        providerToken,
        emailConfirmed,
        authAccessState,
        signUp,
        signIn,
        signOut,
        resendConfirmationEmail,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
