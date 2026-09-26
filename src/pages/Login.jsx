import React, { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { isProductionAuthMisconfigured } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { PLATFORM_OWNER_EMAIL, isPlatformStaff } from "@/lib/platformIdentity";
import { describeAuthError, hasAuthCode, readAuthCallbackError, supabaseCallbackUrl } from "@/lib/authRedirect";
import AuthLayout from "@/components/AuthLayout";
import GoogleSignInButton from "@/components/platform/GoogleSignInButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login({ platformOwner = false }) {
  const { isAuthenticated, user, checkAppState } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState(platformOwner ? PLATFORM_OWNER_EMAIL : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(() => {
    if (typeof window === "undefined") return "";
    const callbackError = readAuthCallbackError(window.location.search, window.location.hash);
    if (callbackError) return describeAuthError(callbackError, { google: true });
    if (location.state?.authError) return describeAuthError(location.state.authError, { google: true });
    return "";
  });
  const [busy, setBusy] = useState(false);
  const finishingGoogle = typeof window !== "undefined"
    && hasAuthCode(window.location.search, window.location.hash)
    && !error
    && !isAuthenticated;
  if (isAuthenticated) return <Navigate to={isPlatformStaff(user) ? "/admin" : "/"} replace />;

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isProductionAuthMisconfigured) throw new Error("Production authentication is not configured on this build.");
      const signInEmail = platformOwner ? PLATFORM_OWNER_EMAIL : email;
      await base44.auth.loginViaEmailPassword(signInEmail, password);
      await checkAppState();
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      icon={LogIn}
      title={platformOwner ? "Platform owner" : "Sign in to Estim8r"}
      subtitle={platformOwner ? "Sign in as Current Flow platform owner" : "Use Google or your Current Flow email"}
      footer={platformOwner
        ? <>Not the platform owner? <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link></>
        : <>Don't have an account? <Link to="/register" className="text-primary font-medium hover:underline">Create one</Link></>}
    >
      {error && <div role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {finishingGoogle && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Finishing Google sign-in…
        </div>
      )}
      <GoogleSignInButton className="h-12 w-full" />
      <p className="mt-2 text-xs text-muted-foreground">
        If Google says this app does not comply with OAuth policy, the Authorized redirect URI must be the Supabase callback
        <span className="font-medium"> {supabaseCallbackUrl(import.meta.env.VITE_SUPABASE_URL)}</span>
        , not this Estim8r URL.
      </p>
      <div className="my-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or email
        <span className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={platformOwner ? PLATFORM_OWNER_EMAIL : email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 pl-10"
              required
              readOnly={platformOwner}
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 pl-10" required />
          </div>
        </div>
        <Button type="submit" className="h-12 w-full" disabled={busy || isProductionAuthMisconfigured}>
          {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</> : platformOwner ? "Sign in as platform owner" : "Sign in with email"}
        </Button>
      </form>
      {!platformOwner && (
        <Button asChild variant="secondary" className="mt-4 h-12 w-full">
          <Link to="/login/owner">Platform owner sign in</Link>
        </Button>
      )}
    </AuthLayout>
  );
}
