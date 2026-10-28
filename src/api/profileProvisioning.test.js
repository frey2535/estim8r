import { loadProfileForAuthUser } from "./profileProvisioning.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

function mockClient({ profile = null, ensureData = null, ensureError = null, afterEnsureProfile = null } = {}) {
  let ensured = false;
  return {
    from(table) {
      assert(table === "profiles", "only profiles is queried");
      return {
        select() {
          return {
            eq(_column, id) {
              return {
                async maybeSingle() {
                  if (!ensured) {
                    return { data: profile && profile.id === id ? profile : null, error: null };
                  }
                  const row = afterEnsureProfile || ensureData || profile;
                  return { data: row && row.id === id ? row : null, error: null };
                },
              };
            },
          };
        },
      };
    },
    async rpc(name) {
      assert(name === "ensure_current_flow_profile", "ensure RPC name");
      ensured = true;
      if (ensureError) return { data: null, error: ensureError };
      return { data: ensureData, error: null };
    },
  };
}

const authUser = { id: "user-1", email: "estimator@acme.com" };

{
  const existing = { id: "user-1", email: "estimator@acme.com", org_role: "member" };
  const profile = await loadProfileForAuthUser(mockClient({ profile: existing }), authUser);
  assert(profile.id === "user-1", "existing profile is returned without provisioning");
}

{
  const provisioned = { id: "user-1", email: "estimator@acme.com", org_role: "individual" };
  const profile = await loadProfileForAuthUser(
    mockClient({ profile: null, ensureData: provisioned }),
    authUser,
  );
  assert(profile.email === "estimator@acme.com", "missing profile is provisioned for Buildr company users");
  assert(profile.org_role === "individual", "provisioned profile stays individual until company link");
}

{
  const provisioned = { id: "user-1", email: "estimator@acme.com", org_role: "individual" };
  const profile = await loadProfileForAuthUser(
    mockClient({ profile: null, ensureData: true, afterEnsureProfile: provisioned }),
    authUser,
  );
  assert(profile.id === "user-1", "boolean RPC success still reloads the profile row");
}

{
  let threw = null;
  try {
    await loadProfileForAuthUser(
      mockClient({ profile: null, ensureError: { message: "Unable to provision Current Flow profile" } }),
      authUser,
    );
  } catch (error) {
    threw = error;
  }
  assert(threw?.type === "user_not_registered", "failed provisioning is typed for the access UI");
  assert(/Buildr sidebar|company admin/i.test(threw.message), "error tells company users how to recover");
}

{
  let threw = null;
  try {
    await loadProfileForAuthUser(mockClient({ profile: null, ensureData: null, afterEnsureProfile: null }), authUser);
  } catch (error) {
    threw = error;
  }
  assert(/not been provisioned yet/i.test(threw?.message || ""), "still fails closed when ensure returns nothing");
}

if (!process.exitCode) console.log("profile provisioning checks passed");
