import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/api/supabaseClient';
import { supabaseAuth } from '@/api/supabaseAuth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!isSupabaseConfigured) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await supabaseAuth.me());
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange(() => refresh());
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    configured: isSupabaseConfigured,
    refresh,
    login: async (email, password) => {
      const next = await supabaseAuth.loginViaEmailPassword(email, password);
      setUser(next);
      return next;
    },
    register: supabaseAuth.register,
    logout: async () => {
      await supabaseAuth.logout();
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
