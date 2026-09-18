import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/api/supabaseClient";
import { entitlementGrantsAccess, getProductEntitlement } from "@/api/entitlementRepository";

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
    if (!silent) {
      setAuthError(null);
      setIsLoadingAuth(true);
      setEntitlementChecked(false);
    }
    try {
      const current = await withTimeout(base44.auth.me(), AUTH_STARTUP_TIMEOUT_MS, "Authentication took too long. Refresh Estim8r.");
      setUser(current);
      setIsAuthenticated(true);
      try {
        const entitlement = await getProductEntitlement();
        setProductEntitlement(entitlement);
        setHasProductAccess(entitlementGrantsAccess(entitlement) || Boolean(current?.is_platform_admin));
      } catch (entitlementError) {
        // During rollout, missing entitlement RPC must fail closed for normal users.
        // Silent refresh keeps the current entitlement so a blip does not remount takeoff.
        if (!silent) {
          setProductEntitlement(null);
          setHasProductAccess(Boolean(current?.is_platform_admin));
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
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        checkAppState({ silent: true });
        return;
      }
      checkAppState();
    });
    return () => data.subscription.unsubscribe();
  }, [checkAppState]);

  useEffect(() => {
    const refresh = () => {
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
