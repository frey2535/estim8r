/**
 * Load the authenticated user's Current Flow profile, provisioning a missing
 * row when auth.users exists without public.profiles (common for Buildr
 * sidebar company users on the shared identity project).
 *
 * @param {any} client
 * @param {any} user
 */
export async function loadProfileForAuthUser(client, user) {
  if (!client || !user?.id) {
    const authError = new Error("Authentication required");
    /** @type {any} */ (authError).status = 401;
    throw authError;
  }

  const first = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (first.error) throw first.error;
  if (first.data) return first.data;

  const ensured = await client.rpc("ensure_current_flow_profile");
  if (ensured.error) {
    const message = String(ensured.error.message || ensured.error);
    const err = new Error(
      /authentication required/i.test(message)
        ? message
        : "Your Current Flow profile could not be provisioned. Open Estim8r again from the Buildr sidebar, or contact your company admin.",
    );
    /** @type {any} */ (err).cause = ensured.error;
    /** @type {any} */ (err).type = "user_not_registered";
    throw err;
  }

  if (ensured.data && typeof ensured.data === "object" && ensured.data.id) {
    return ensured.data;
  }

  const second = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (second.error) throw second.error;
  if (second.data) return second.data;

  const missing = new Error("Your Current Flow profile has not been provisioned yet.");
  /** @type {any} */ (missing).type = "user_not_registered";
  throw missing;
}
