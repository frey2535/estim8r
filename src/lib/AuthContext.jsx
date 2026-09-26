import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { isLocalAuthFallbackEnabled, supabase } from "@/api/supabaseClient";
import { entitlementGrantsAccess, getProductEntitlement } from "@/api/entitlementRepository";
import { hasPlatformAccess } from "@/lib/platformIdentity";
import { describeAuthError, hasAuthCode, readAuthCallbackError, waitForAuthCallbackSession } from "@/lib/authRedirect";
import { isDrawingPickerOpen } from "@/domain/takeoff/drawingUpload";

const AuthContext = createContext();
const AUTH_STARTUP_TIMEOUT_MS = 10000;
function withTimeout(promise, ms, message) {
  let id;
  const timeout = new Promise((_, reject) => { id = window.setTimeout(() => reject(new Error(message)), ms); });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(id));
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [productEntitlement, setProductEntitlement] = useState(null);
  const [hasProductAccess, setHasProductAccess] = useState(false);
  const [entitlementChecked, setEntitlementChecked] = useState(false);

  const checkAppState = useCallback(async (options) => {
    const silent = Boolean(options?.silent);
    // A full refresh flips loading flags and ProtectedRoute unmounts /takeoff.
    // The native file picker blurs the window; a loading remount drops the selected File.
    if (isLocalAuthFallbackEnabled) {
      setUser({
        email: "local@localhost",
        full_name: "Local estimator",
        org_name: "Local",
        org_role: "owner",
        access_type: "trial",
        access_status: "trial",
      });
      setIsAuthenticated(true);
      setHasProductAccess(true);
      setProductEntitlement({ status: "trial" });
      setEntitlementChecked(true);
      setAuthChecked(true);
      setIsLoadingAuth(false);
      setIsLoadingPublicSettings(false);
      setAuthError(null);
      return;
    }
    if (!silent) {
      setAuthError(null);
      setIsLoadingAuth(true);
      setEntitlementChecked(false);
    }
    try {
      if (supabase && typeof window !== "undefined") {
        const callbackError = readAuthCallbackError(window.location.search, window.location.hash);
        if (callbackError) {
          const authCallbackError = new Error(describeAuthError(callbackError, { google: true }));
          authCallbackError.status = 401;
          throw authCallbackError;
        }
        if (hasAuthCode(window.location.search, window.location.hash)) {
          await withTimeout(
            waitForAuthCallbackSession(supabase),
            AUTH_STARTUP_TIMEOUT_MS,
            "Google sign-in did not finish establishing a session. Try Sign in with Google again.",
          );
        }
      }
      const current = await withTimeout(base44.auth.me(), AUTH_STARTUP_TIMEOUT_MS, "Authentication took too long. Refresh Estim8r.");
      setUser(current);
      setIsAuthenticated(true);
      try {
        const entitlement = await getProductEntitlement();
        setProductEntitlement(entitlement);
        setHasProductAccess(entitlementGrantsAccess(entitlement) || hasPlatformAccess(current));
      } catch (entitlementError) {
        // During rollout, missing entitlement RPC must fail closed for normal users.
        // Silent refresh keeps the current entitlement so a blip does not remount takeoff.
        if (!silent) {
          setProductEntitlement(null);
          setHasProductAccess(hasPlatformAccess(current));
        }
        console.error("Estim8r entitlement check failed", entitlementError);
      } finally {
        setEntitlementChecked(true);
      }
    } catch (error) {
      const signedOut = error?.status === 401;
      if (silent && !signedOut) {
        console.error("Estim8r silent auth refresh failed", error);
        return;
      }
      setUser(null);
      setIsAuthenticated(false);
      setProductEntitlement(null);
      setHasProductAccess(false);
      setEntitlementChecked(true);
      if (!signedOut) setAuthError(error);
    } finally {
      if (!silent) {
        setIsLoadingAuth(false);
        setIsLoadingPublicSettings(false);
      }
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkAppState();
    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      if (event === "SIGNED_OUT") {
        checkAppState();
        return;
      }
      // iOS/Android file pickers blur the PWA and can replay SIGNED_IN.
      // Keep the takeoff tree mounted so FileList is not destroyed.
      checkAppState({ silent: true });
    });
    return () => data.subscription.unsubscribe();
  }, [checkAppState]);

  useEffect(() => {
    const refresh = () => {
      if (isDrawingPickerOpen()) return;
      if (document.visibilityState && document.visibilityState !== "visible") return;
      checkAppState({ silent: true });
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [checkAppState]);

  const logout = async () => {
    setUser(null);
    setIsAuthenticated(false);
    setProductEntitlement(null);
    setHasProductAccess(false);
    await base44.auth.logout();
  };

  return <AuthContext.Provider value={{
    user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError, authChecked,
    productEntitlement, hasProductAccess, entitlementChecked,
    appPublicSettings: { id: "estim8r", public_settings: { auth_required: true } },
    logout, navigateToLogin: () => { window.location.href = "/login"; },
    checkUserAuth: checkAppState, checkAppState,
  }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth must be used within an AuthProvider");
  return c;
};
