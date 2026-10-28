/**
 * @param {any} error
 */
export function isMissingRpcError(error) {
  const message = String(error?.message || error?.details || error || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  return (
    code === "pgrst202"
    || code === "42883"
    || /could not find the function|function .* does not exist|schema cache|pgrst202/.test(message)
  );
}

/**
 * @param {any} error
 * @param {any} action
 */
export function describeAccessRpcError(error, action) {
  if (isMissingRpcError(error)) {
    return `Estim8r ${action} is not available on the database yet. Apply supabase/migrations/20261028180000_delete_reinstate_estim8r_access.sql to the shared Current Flow project, then retry.`;
  }
  return error?.message || `Could not ${action} access.`;
}
