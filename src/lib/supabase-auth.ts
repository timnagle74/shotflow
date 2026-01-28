import { createBrowserClient as createBrowserClientSSR } from '@supabase/ssr';
import type { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Create a Supabase client for use in the browser (Client Components).
 */
export function createBrowserSupabaseClient() {
  return createBrowserClientSSR<Database>(supabaseUrl, supabaseAnonKey);
}
