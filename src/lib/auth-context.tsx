import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [providerToken, setProviderToken] = useState<string | null>(null);

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

    /** Sem linha: criar via RLS (INSERT permitido para auth.uid() = user_id). Cobre usuários antigos / trigger ausente. */
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const token = captureAndPersistProviderToken(session);
      setProviderToken(token);
      setSession(session);
      setUser(session?.user ?? null);

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setProviderToken(null);
        _queryClient?.clear();
      } else if (session?.user) {
        setTimeout(() => fetchProfile(session.user.id), 200);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(async ({ data: { session: initial } }) => {
      const token = captureAndPersistProviderToken(initial);
      setProviderToken(token);

      /**
       * `getSession()` lê o storage — o access_token pode estar expirado enquanto `user` ainda parece válido.
       * `getUser()` valida com o Auth e atualiza a sessão (refresh automático quando aplicável).
       * Depois reler `getSession()` para alinhar React com o cliente Supabase.
       */
      let session = initial;
      if (session?.access_token) {
        const { error: userErr } = await supabase.auth.getUser();
        if (userErr) {
          const { data: ref } = await supabase.auth.refreshSession();
          session = ref.session ?? session;
          await supabase.auth.getUser();
          const { data: again } = await supabase.auth.getSession();
          session = again.session ?? session;
        } else {
          const { data: again } = await supabase.auth.getSession();
          session = again.session ?? session;
        }
      }

      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    const normalizedEmail = normalizeEmail(email);
    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { name },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = normalizeEmail(email);
    sessionStorage.removeItem('escalax_onboarding_dismissed');
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) throw error;
  };

  const signOut = async () => {
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

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, providerToken, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
