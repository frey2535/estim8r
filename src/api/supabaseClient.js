import { createClient } from '@supabase/supabase-js';
import { trimAuthUrl } from '@/lib/authRedirect';

const supabaseUrl = trimAuthUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function isLocalDevelopmentHost() {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || hostname.endsWith('.localhost');
}

export const isLocalAuthFallbackEnabled = !isSupabaseConfigured && isLocalDevelopmentHost();
export const isProductionAuthMisconfigured = !isSupabaseConfigured && !isLocalAuthFallbackEnabled;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}
