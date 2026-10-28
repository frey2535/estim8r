import {
  autoSignInFromBuildrSidebar,
  isAlreadyRegisteredError,
  isInvalidLoginError,
  signInWithBuildrPassword,
} from "./buildrSsoSignIn.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(isInvalidLoginError({ message: "Invalid login credentials" }), "invalid login detected");
assert(isInvalidLoginError({ message: "Invalid email or password" }), "invalid email/password detected");
assert(!isInvalidLoginError({ message: "network error" }), "other errors are not invalid-login");
assert(isAlreadyRegisteredError({ message: "User already registered" }), "already registered detected");
assert(!isAlreadyRegisteredError({ message: "rate limited" }), "other errors are not already-registered");

async function passwordCreatesThenSignsIn() {
  const calls = [];
  const client = {
    auth: {
      signInWithPassword: async ({ email, password }) => {
        calls.push(["signIn", email, password]);
        if (calls.filter((c) => c[0] === "signIn").length === 1) {
          return { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
        }
        return {
          data: {
            user: { id: "u1", email },
            session: { access_token: "sess" },
          },
          error: null,
        };
      },
      signUp: async ({ email, password }) => {
        calls.push(["signUp", email, password]);
        return {
          data: { user: { id: "u1", email }, session: null },
          error: null,
        };
      },
    },
  };
  const result = await signInWithBuildrPassword(client, {
    email: "Estimator@DayOne.test",
    password: "BuildrSecret1!",
    name: "Estimator",
  });
  assert(result.user?.id === "u1", "password path returns the user");
  assert(result.session?.access_token === "sess", "password path returns the session");
  assert(result.created === true, "first-open signup is marked created");
  assert(calls[0][0] === "signIn" && calls[1][0] === "signUp" && calls[2][0] === "signIn", "sign-in → sign-up → retry");
}

async function passwordSignsInWhenAccountExists() {
  const client = {
    auth: {
      signInWithPassword: async ({ email }) => ({
        data: { user: { id: "u2", email }, session: { access_token: "ok" } },
        error: null,
      }),
      signUp: async () => {
        throw new Error("signUp should not run when password works");
      },
    },
  };
  const result = await signInWithBuildrPassword(client, {
    email: "existing@dayone.test",
    password: "BuildrSecret1!",
  });
  assert(result.created === false, "existing account is not marked created");
  assert(result.user?.id === "u2", "existing account signs in");
}

async function passwordRejectsMissingCredentials() {
  try {
    await signInWithBuildrPassword({ auth: {} }, { email: "a@b.com", password: "" });
    assert(false, "missing password must throw");
  } catch (error) {
    assert(error.code === "password_handoff_unavailable", "missing password code");
  }
}

async function autoSignInUsesBuildrPassword() {
  const client = {
    auth: {
      signInWithPassword: async ({ email, password }) => {
        assert(email === "estimator@dayone.test", "auto sign-in uses Buildr email");
        assert(password === "SameAsBuildr1!", "auto sign-in uses Buildr password");
        return {
          data: {
            user: { id: "u3", email },
            session: { access_token: "sess3" },
          },
          error: null,
        };
      },
      signUp: async () => {
        throw new Error("signUp should not run");
      },
    },
    functions: {
      invoke: async () => {
        throw new Error("edge fallback should not run when password works");
      },
    },
  };

  const signed = await autoSignInFromBuildrSidebar("sso_tok", {
    audience: "estim8r",
    client,
    allowEdgeFallback: true,
    verify: async (token, audience) => {
      assert(token === "sso_tok" && audience === "estim8r", "verify receives sidebar token");
      return {
        valid: true,
        email: "estimator@dayone.test",
        company_id: "co_1",
        name: "Estimator",
        role: "employee",
        buildr_token: "buildr_sess",
      };
    },
    bootstrap: async (token, audience) => {
      assert(token === "sso_tok" && audience === "estim8r", "bootstrap receives sidebar token");
      return {
        valid: true,
        email: "estimator@dayone.test",
        company_id: "co_1",
        name: "Estimator",
        role: "employee",
        password: "SameAsBuildr1!",
      };
    },
  });
  assert(signed.via === "password", "sidebar path uses password handoff");
  assert(signed.companyId === "co_1", "company id is preserved");
  assert(signed.email === "estimator@dayone.test", "email is normalized");
  assert(signed.user?.id === "u3", "session user is returned");
  assert(signed.buildrToken === "buildr_sess", "Buildr session token is kept");
}

async function autoSignInFallsBackToEdge() {
  const client = {
    auth: {
      verifyOtp: async ({ token_hash }) => {
        assert(token_hash === "hash_1", "edge OTP hash is verified");
        return {
          data: {
            user: { id: "u4", email: "oauth@dayone.test" },
            session: { access_token: "otp" },
          },
          error: null,
        };
      },
    },
    functions: {
      invoke: async (name, { body }) => {
        assert(name === "buildr-family-sso", "edge function name");
        assert(body.token === "sso_edge", "edge receives SSO token");
        return {
          data: {
            valid: true,
            email: "oauth@dayone.test",
            company_id: "co_2",
            name: "OAuth User",
            role: "employee",
            token_hash: "hash_1",
          },
          error: null,
        };
      },
    },
  };

  const signed = await autoSignInFromBuildrSidebar("sso_edge", {
    audience: "estim8r",
    client,
    verify: async () => ({
      valid: true,
      email: "oauth@dayone.test",
      company_id: "co_2",
      name: "OAuth User",
      role: "employee",
    }),
    bootstrap: async () => ({ valid: false, error: "password_handoff_unavailable" }),
  });
  assert(signed.via === "edge", "OAuth/no-vault accounts use edge mint");
  assert(signed.companyId === "co_2", "edge company id");
  assert(signed.user?.id === "u4", "edge session user");
}

async function autoSignInRejectsInvalidGrant() {
  try {
    await autoSignInFromBuildrSidebar("bad", {
      client: { auth: {} },
      verify: async () => ({ valid: false, error: "access_denied" }),
      bootstrap: async () => ({ valid: false }),
    });
    assert(false, "denied grant must throw");
  } catch (error) {
    assert(error.code === "access_denied", "access_denied surfaces to FromBuildr");
  }
}

await passwordCreatesThenSignsIn();
await passwordSignsInWhenAccountExists();
await passwordRejectsMissingCredentials();
await autoSignInUsesBuildrPassword();
await autoSignInFallsBackToEdge();
await autoSignInRejectsInvalidGrant();

if (!process.exitCode) console.log("buildr SSO sign-in checks passed");
