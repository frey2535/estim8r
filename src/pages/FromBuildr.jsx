import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { writeBuildrSessionToken } from "@/api/buildrBridge";
import { autoSignInFromBuildrSidebar } from "@/api/buildrSsoSignIn";
import { persistBuildrCompanyId } from "@/lib/buildrCompany";
import {
  buildrFamilyAccessCopy,
  canEnterCompanyEstim8r,
  readBuildrHandoffParams,
  writeBuildrFamilyAccess,
} from "@/lib/buildrFamilyAccess";
import { hasPlatformAccess, normalizeEmail } from "@/lib/platformIdentity";
import { useAuth } from "@/lib/AuthContext";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";

export default function FromBuildr() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth, user, checkAppState, hasProductAccess } = useAuth();
  const [status, setStatus] = useState("checking");
  const [copy, setCopy] = useState(buildrFamilyAccessCopy(""));

  useEffect(() => {
    let cancelled = false;

    async function enterCompanyApp() {
      const search = typeof window !== "undefined" ? window.location.search : params.toString();
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const handoff = readBuildrHandoffParams(search, hash);
      const token = handoff.token;
      const companyId = handoff.companyId;
      const alreadyInCompany = canEnterCompanyEstim8r({
        isAuthenticated,
        hasProductAccess,
        hasPlatformAccess: hasPlatformAccess(user),
        user,
      });

      if (!token) {
        if (isLoadingAuth) return;
        if (alreadyInCompany) {
          if (companyId) {
            writeBuildrFamilyAccess({ email: user.email, companyId });
            await persistBuildrCompanyId(companyId, user);
          }
          navigate("/", { replace: true });
          return;
        }
        if (!cancelled) {
          setCopy(buildrFamilyAccessCopy(""));
          setStatus("error");
        }
        return;
      }

      // Already signed into Estim8r as this company user — keep the grant and enter.
      if (!isLoadingAuth && isAuthenticated && user?.email && alreadyInCompany) {
        const email = normalizeEmail(user.email);
        const resolvedCompanyId = String(companyId || "").trim();
        if (resolvedCompanyId) {
          writeBuildrFamilyAccess({ email, companyId: resolvedCompanyId });
          await persistBuildrCompanyId(resolvedCompanyId, user);
        }
        navigate("/", { replace: true });
        return;
      }

      try {
        const signed = await autoSignInFromBuildrSidebar(token, { audience: "estim8r" });
        if (cancelled) return;
        writeBuildrFamilyAccess({ email: signed.email, companyId: signed.companyId });
        if (signed.buildrToken) writeBuildrSessionToken(signed.email, signed.buildrToken);
        await persistBuildrCompanyId(signed.companyId, { email: signed.email });
        await checkAppState({ silent: true });
        navigate("/", { replace: true });
      } catch (error) {
        if (cancelled) return;
        if (isLoadingAuth) return;
        if (alreadyInCompany) {
          if (companyId) {
            writeBuildrFamilyAccess({ email: user.email, companyId });
            await persistBuildrCompanyId(companyId, user);
          }
          navigate("/", { replace: true });
          return;
        }
        const code = String(error?.code || error?.message || "").trim();
        setCopy(buildrFamilyAccessCopy(code));
        setStatus("error");
      }
    }

    enterCompanyApp();
    return () => {
      cancelled = true;
    };
  }, [params, isAuthenticated, isLoadingAuth, user, hasProductAccess, checkAppState, navigate]);

  if (status === "error") {
    return (
      <AuthLayout title={copy.title} subtitle="Company Estim8r">
        <p className="text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
        <Button asChild className="mt-6 h-12 w-full">
          <Link to="/login">Stay in Estim8r sign-in</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Opening company Estim8r" subtitle="Signing in with your Buildr login">
      <p className="text-sm text-muted-foreground">
        Using your Buildr credentials from the sidebar — no separate Estim8r sign-in.
      </p>
    </AuthLayout>
  );
}
