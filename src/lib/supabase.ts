import { createBrowserClient } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Whether Supabase is configured (env vars present). */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Public Supabase client (browser singleton).
 * Uses @supabase/ssr createBrowserClient for cookie-based auth,
 * matching the auth provider and middleware.
 * Cast to SupabaseClient<Database> for type compatibility.
 */
export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createBrowserClient(supabaseUrl!, supabaseAnonKey!) as unknown as SupabaseClient<Database>
  : null;
