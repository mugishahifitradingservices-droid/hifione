import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, autoConfirmUserEmail } from '../lib/supabase';

export type Role = 'MARKETING_EXECUTIVE' | 'MARKETING_MANAGER' | 'CEO' | 'TENDER_OFFICER' | 'SALES_MANAGER' | 'SENIOR_MANAGER' | 'SYSTEM_ADMIN';

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  photo_url?: string | null;
  role: Role;
  status: UserStatus;
  created_at?: string;
  updated_at?: string;
  last_login_at?: string;
}

export const VALID_DEMO_UUID = '00000000-0000-0000-0000-000000000001';

export const getValidUserId = (user?: SupabaseUser | AppUser | null): string => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (user?.id && uuidRegex.test(user.id)) {
    return user.id;
  }
  return VALID_DEMO_UUID;
};

interface AuthContextType {
  user: SupabaseUser | null;
  appUser: AppUser | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, userEmail?: string, userName?: string) => {
    try {
      const cleanEmail = userEmail?.trim().toLowerCase();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) {
        // Query by email if ID not matched
        if (cleanEmail) {
          const { data: profileByEmail } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle();

          if (profileByEmail) {
            if (profileByEmail.status === 'INACTIVE') {
              await supabase.auth.signOut();
              localStorage.removeItem('hifi_one_app_user');
              setAppUser(null);
              setUser(null);
              setSession(null);
              return;
            }
            setAppUser(profileByEmail as AppUser);
            localStorage.setItem('hifi_one_app_user', JSON.stringify(profileByEmail));
            return;
          }
        }

        // Automatically create or upsert profile row if missing
        const fallbackName = userName || userEmail?.split('@')[0] || 'User';
        const isSuperAdminEmail = cleanEmail === 'educkit2025@gmail.com' || cleanEmail === 'mugishap432@gmail.com';
        const defaultRole: Role = isSuperAdminEmail ? 'SYSTEM_ADMIN' : 'MARKETING_EXECUTIVE';

        const newProfile: AppUser = {
          id: userId,
          name: fallbackName,
          email: userEmail || '',
          role: defaultRole,
          status: 'ACTIVE'
        };

        const { data: upserted } = await supabase
          .from('profiles')
          .upsert(newProfile)
          .select('*')
          .maybeSingle();

        const finalProfile = (upserted as AppUser) || newProfile;
        setAppUser(finalProfile);
        localStorage.setItem('hifi_one_app_user', JSON.stringify(finalProfile));
      } else {
        if (data.status === 'INACTIVE') {
          await supabase.auth.signOut();
          localStorage.removeItem('hifi_one_app_user');
          setAppUser(null);
          setUser(null);
          setSession(null);
          return;
        }

        // Respect role stored in profiles table unless primary admin email
        const isSuperAdminEmail = cleanEmail === 'educkit2025@gmail.com' || cleanEmail === 'mugishap432@gmail.com';
        const effectiveRole: Role = isSuperAdminEmail ? 'SYSTEM_ADMIN' : (data.role || 'MARKETING_EXECUTIVE');

        const activeUser: AppUser = {
          ...(data as AppUser),
          role: effectiveRole
        };

        setAppUser(activeUser);
        localStorage.setItem('hifi_one_app_user', JSON.stringify(activeUser));

        try {
          await supabase.rpc('log_user_login');
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.warn('Profile fetch warning:', err);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email, session.user.user_metadata?.full_name).finally(() => setLoading(false));
      } else {
        // Fallback to local stored appUser if offline or created directly in profiles table
        const cached = localStorage.getItem('hifi_one_app_user');
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as AppUser;
            // Validate stored user is active in profiles
            supabase.from('profiles').select('*').eq('id', parsed.id).maybeSingle().then(
              ({ data: fresh }) => {
                if (fresh) {
                  if (fresh.status === 'INACTIVE') {
                    localStorage.removeItem('hifi_one_app_user');
                    setAppUser(null);
                  } else {
                    setAppUser(fresh as AppUser);
                    localStorage.setItem('hifi_one_app_user', JSON.stringify(fresh));
                  }
                } else {
                  setAppUser(parsed);
                }
                setLoading(false);
              },
              () => {
                setAppUser(parsed);
                setLoading(false);
              }
            );
          } catch {
            setAppUser(null);
            setLoading(false);
          }
        } else {
          setAppUser(null);
          setLoading(false);
        }
      }
    }).catch(() => {
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id, session.user.email, session.user.user_metadata?.full_name);
      } else {
        const cached = localStorage.getItem('hifi_one_app_user');
        if (!cached) setAppUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Authenticate credentials against Supabase Auth
    let authUser: SupabaseUser | null = null;
    let authErrorMsg: string | null = null;

    let { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    // If login failed due to unconfirmed email, automatically confirm it via RPC and retry
    if (error && (
      error.message.toLowerCase().includes('email not confirmed') ||
      error.message.toLowerCase().includes('not confirmed') ||
      error.message.toLowerCase().includes('unconfirmed') ||
      error.message.toLowerCase().includes('invalid login credentials')
    )) {
      try {
        await autoConfirmUserEmail(cleanEmail);
        const retry = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (!retry.error && retry.data?.user) {
          data = retry.data;
          error = null;
        }
      } catch (confirmErr) {
        console.warn('Auto-confirm attempt notice:', confirmErr);
      }
    }

    if (!error && data?.user) {
      authUser = data.user;
    } else if (error) {
      authErrorMsg = error.message;
    }

    // 2. Query user profile from profiles table
    let query = supabase.from('profiles').select('*');
    if (authUser) {
      query = query.or(`id.eq.${authUser.id},email.eq.${cleanEmail}`);
    } else {
      query = query.eq('email', cleanEmail);
    }

    const { data: profile } = await query.maybeSingle();

    if (profile) {
      if (profile.status === 'INACTIVE') {
        if (authUser) await supabase.auth.signOut();
        localStorage.removeItem('hifi_one_app_user');
        throw new Error('Your account is currently inactive. Please contact a System Administrator.');
      }

      const isSuperAdmin = cleanEmail === 'educkit2025@gmail.com' || cleanEmail === 'mugishap432@gmail.com';
      const effectiveRole: Role = isSuperAdmin ? 'SYSTEM_ADMIN' : (profile.role || 'MARKETING_EXECUTIVE');

      const userProfile: AppUser = {
        id: profile.id,
        name: profile.name,
        email: profile.email || cleanEmail,
        role: effectiveRole,
        status: profile.status,
        photo_url: profile.photo_url,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        last_login_at: new Date().toISOString()
      };

      setAppUser(userProfile);
      localStorage.setItem('hifi_one_app_user', JSON.stringify(userProfile));

      // Update last_login_at in background
      await supabase
        .from('profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', profile.id);

      return;
    }

    // 3. If profile not found in profiles table, but Auth succeeded
    if (authUser) {
      const isSuperAdmin = cleanEmail === 'educkit2025@gmail.com' || cleanEmail === 'mugishap432@gmail.com';
      const defaultRole: Role = isSuperAdmin ? 'SYSTEM_ADMIN' : 'MARKETING_EXECUTIVE';
      const fallbackName = authUser.user_metadata?.full_name || cleanEmail.split('@')[0] || 'User';

      const newProfile: AppUser = {
        id: authUser.id,
        name: fallbackName,
        email: cleanEmail,
        role: defaultRole,
        status: 'ACTIVE'
      };

      setAppUser(newProfile);
      localStorage.setItem('hifi_one_app_user', JSON.stringify(newProfile));
      await supabase.from('profiles').upsert(newProfile);
      return;
    }

    // 4. If authentication failed completely
    throw new Error(authErrorMsg || 'Invalid email or password. Please check your credentials.');
  };

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: name.trim(),
        },
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to create account.');
    }

    // Auto-confirm user email immediately in background
    if (data.user?.id) {
      await autoConfirmUserEmail(cleanEmail, data.user.id);
    }

    if (data.user) {
      const isSuperAdmin = cleanEmail === 'educkit2025@gmail.com' || cleanEmail === 'mugishap432@gmail.com';
      const newProfile: AppUser = {
        id: data.user.id,
        name: name.trim(),
        email: cleanEmail,
        role: isSuperAdmin ? 'SYSTEM_ADMIN' : 'MARKETING_EXECUTIVE',
        status: 'ACTIVE'
      };

      await supabase.from('profiles').upsert(newProfile);
      setAppUser(newProfile);
      localStorage.setItem('hifi_one_app_user', JSON.stringify(newProfile));

      if (!data.session) {
        // Attempt immediate login after auto-confirmation
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (signInErr) {
          console.warn('Post-signup login notice:', signInErr.message);
        }
      }
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Signout error:', e);
    }
    localStorage.removeItem('hifi_one_app_user');
    setUser(null);
    setAppUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, appUser, session, loading, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

