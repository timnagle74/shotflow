import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Whether Supabase is configured (env vars present). */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Public Supabase client (browser singleton).
 * Configured with cookie-based storage to match the SSR auth provider.
 */
export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        flowType: 'pkce',
        storage: typeof window !== 'undefined' ? {
          getItem: (key: string) => {
            const match = document.cookie.match(new RegExp('(^| )' + key + '=([^;]+)'));
            return match ? decodeURIComponent(match[2]) : null;
          },
          setItem: (key: string, value: string) => {
            document.cookie = `${key}=${encodeURIComponent(value)};path=/;max-age=31536000;SameSite=Lax`;
          },
          removeItem: (key: string) => {
            document.cookie = `${key}=;path=/;max-age=0`;
          },
        } : undefined,
      },
    })
  : null;
