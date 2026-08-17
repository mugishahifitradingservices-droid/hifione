import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://oexbzqugbwjcqmmtdxme.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_dzf6WXSs8DmrCOn9r2jxJA_a8YOVYZi';
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/**
 * Creates an isolated, unpersisted Supabase client for signing up new users
 * without interfering with or overriding the current active admin session.
 */
export const createIsolatedAuthClient = (): SupabaseClient => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `sb-admin-signup-${Date.now()}`,
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    },
  });
};

/**
 * Service Role client if configured, allowing direct admin user creation
 * with pre-confirmed email.
 */
export const getAdminClient = (): SupabaseClient | null => {
  if (!supabaseServiceKey) return null;
  try {
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch (e) {
    console.warn('Failed to initialize Supabase Admin client:', e);
    return null;
  }
};

/**
 * Helper to auto-confirm a user's email in Supabase Auth via database RPC.
 */
export const autoConfirmUserEmail = async (email: string, userId?: string): Promise<boolean> => {
  const cleanEmail = email.trim().toLowerCase();
  
  // 1. If service role client is available, use auth.admin API
  const adminClient = getAdminClient();
  if (adminClient) {
    try {
      if (userId) {
        await adminClient.auth.admin.updateUserById(userId, {
          email_confirm: true,
        });
        return true;
      }
    } catch (e) {
      console.warn('Admin client updateUserById notice:', e);
    }
  }

  // 2. Call the auto_confirm_user RPC in Supabase Postgres
  try {
    const { data, error } = await supabase.rpc('auto_confirm_user', { target_email: cleanEmail });
    if (!error && (data as any)?.success) {
      return true;
    }
  } catch (rpcErr) {
    console.warn('RPC auto_confirm_user notice:', rpcErr);
  }

  // 3. Fallback: try by user ID if provided
  if (userId) {
    try {
      const { data, error } = await supabase.rpc('auto_confirm_user_by_id', { target_user_id: userId });
      if (!error && (data as any)?.success) {
        return true;
      }
    } catch {
      // ignore
    }
  }

  return false;
};


