import { requireSupabase } from './supabaseClient';

async function profileForUser(user) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('id,email,full_name,role,is_platform_admin,org_id,org_role')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return { ...data, authUser: user };
}

export const supabaseAuth = {
  async me() {
    const client = requireSupabase();
    const { data: { user }, error } = await client.auth.getUser();
    if (error) throw error;
    if (!user) {
      const authError = new Error('Authentication required');
      authError.status = 401;
      throw authError;
    }
    return profileForUser(user);
  },

  async loginViaEmailPassword(email, password) {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return profileForUser(data.user);
  },

  async register({ email, password, fullName, companyName }) {
    const client = requireSupabase();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, company_name: companyName } },
    });
    if (error) throw error;
    return data;
  },

  async logout() {
    const client = requireSupabase();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  },

  async resetPasswordRequest(email) {
    const client = requireSupabase();
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  },
};
