import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { isProductionAuthMisconfigured } from "@/api/supabaseClient";
import { describeAuthError } from "@/lib/authRedirect";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function GoogleSignInButton({ className, compact = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const text = "Sign in with Google";

  async function start() {
    setError("");
    setBusy(true);
    try {
      if (isProductionAuthMisconfigured) throw new Error("Production authentication is not configured on this build.");
      await base44.auth.loginWithGoogle();
    } catch (err) {
      const message = describeAuthError(err, { google: true });
      setError(message);
      toast({
        variant: "destructive",
        title: "Google sign-in failed",
        description: message,
      });
      setBusy(false);
    }
  }

  return (
    <div className={cn("relative space-y-2", compact && "space-y-0")}>
      <Button
        type="button"
        variant="outline"
        className={className}
        onClick={() => void start()}
        disabled={busy || isProductionAuthMisconfigured}
        aria-label="Sign in with Google"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleMark />}
        <span className={compact ? "hidden sm:inline" : undefined}>{busy ? "Opening Google…" : text}</span>
        {compact && <span className="sm:hidden">{busy ? "Google…" : "Google"}</span>}
      </Button>
      {error && (
        <p
          role="alert"
          aria-live="assertive"
          className={cn(
            "text-sm text-destructive",
            compact && "absolute right-0 top-full z-50 mt-1 w-72 max-w-[min(18rem,calc(100vw-2rem))] rounded-md border border-destructive/30 bg-background p-2 text-left shadow-md",
          )}
        >
          {error}
        </p>
      )}
    </div>
  );
}
