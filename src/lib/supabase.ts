import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Whether Supabase is configured (env vars present). */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Public Supabase client (browser singleton).
 * Returns `null` when env vars are missing — callers should fall back to mock data.
 *
 * NOTE: For new code, prefer `createBrowserSupabaseClient()` from `@/lib/supabase-auth`
 * (SSR-compatible via @supabase/ssr) or `createServerSupabaseClient()` from
 * `@/lib/supabase-server` for server components.
 *
 * For API routes, use `getServiceClient()` from `@/lib/auth`.
 */
export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl!, supabaseAnonKey!)
  : null;
