import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { verifyBuildrFamilyAppSso } from "@/api/buildrBridge";
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
      const emailHint = handoff.email;
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

      const verified = await verifyBuildrFamilyAppSso(token, "estim8r");
      if (cancelled) return;

      if (!verified?.valid) {
        if (isLoadingAuth) return;
        if (alreadyInCompany) {
          if (companyId) {
            writeBuildrFamilyAccess({ email: user.email, companyId });
            await persistBuildrCompanyId(companyId, user);
          }
          navigate("/", { replace: true });
          return;
        }
        setCopy(buildrFamilyAccessCopy(verified?.error));
        setStatus("error");
        return;
      }

      const email = normalizeEmail(verified.email || emailHint);
      const resolvedCompanyId = String(verified.company_id || companyId || "").trim();
      if (!email || !resolvedCompanyId) {
        if (alreadyInCompany && (email || user?.email) && (resolvedCompanyId || companyId)) {
          const fallbackEmail = email || normalizeEmail(user.email);
          const fallbackCompanyId = resolvedCompanyId || companyId;
          writeBuildrFamilyAccess({ email: fallbackEmail, companyId: fallbackCompanyId });
          await persistBuildrCompanyId(fallbackCompanyId, user);
          navigate("/", { replace: true });
          return;
        }
        setCopy(buildrFamilyAccessCopy(""));
        setStatus("error");
        return;
      }

      writeBuildrFamilyAccess({ email, companyId: resolvedCompanyId });

      if (isLoadingAuth) return;

      if (isAuthenticated && user?.email) {
        if (normalizeEmail(user.email) !== email && !hasPlatformAccess(user) && !alreadyInCompany) {
          setCopy(buildrFamilyAccessCopy("email_mismatch"));
          setStatus("error");
          return;
        }
        await persistBuildrCompanyId(resolvedCompanyId, user);
        await checkAppState({ silent: true });
        navigate("/", { replace: true });
        return;
      }

      navigate(`/login?from=buildr&email=${encodeURIComponent(email)}`, { replace: true });
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
    <AuthLayout title="Opening company Estim8r" subtitle="Using your Buildr company access">
      <p className="text-sm text-muted-foreground">Checking your company purchase and Access Control grant…</p>
    </AuthLayout>
  );
}
