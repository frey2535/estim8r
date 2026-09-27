import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { needsProductEntitlementGate } from "@/lib/platformIdentity";
import { authCallbackSearch, hasAuthCode, readAuthCallbackError } from "@/lib/authRedirect";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import ProductAccessRequired from "@/components/ProductAccessRequired";

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 dark:border-t-orange-500 rounded-full animate-spin"></div>
  </div>
);

export function LoginRedirect() {
  const location = useLocation();
  const { authError } = useAuth();
  const search = authCallbackSearch(location.search, location.hash);
  const authErrorMessage = authError && authError.status !== 401
    ? String(authError.message || authError)
    : "";
  return (
    <Navigate
      to={{ pathname: "/login", search }}
      state={authErrorMessage ? { authError: authErrorMessage } : location.state}
      replace
    />
  );
}

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement, requireProduct = true }) {
  const location = useLocation();
  const { isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth, entitlementChecked, hasProductAccess, user } = useAuth();
  const callbackError = readAuthCallbackError(location.search, location.hash);
  const awaitingGoogle = hasAuthCode(location.search, location.hash) && !isAuthenticated && !callbackError;

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) checkUserAuth();
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (awaitingGoogle || isLoadingAuth || !authChecked || (isAuthenticated && !entitlementChecked)) return fallback;

  if (authError) {
    if (authError.type === "user_not_registered") return <UserNotRegisteredError />;
    return unauthenticatedElement;
  }

  if (!isAuthenticated) return unauthenticatedElement;
  if (requireProduct && needsProductEntitlementGate(user, hasProductAccess)) return <ProductAccessRequired />;
  return <Outlet />;
}
