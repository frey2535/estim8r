import React from "react";
import { LockKeyhole, LogOut, ShoppingBag, Zap } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";

export default function ProductAccessRequired() {
  const { user, logout } = useAuth();
  const purchaseUrl = import.meta.env.VITE_ESTIM8R_PURCHASE_URL || "https://currentflowconsulting.org";

  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-blue-600 text-white dark:bg-orange-500"><Zap className="h-7 w-7" /></div>
        <div className="mb-2 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground"><LockKeyhole className="h-4 w-4" /> Estim8r Access</div>
        <h1 className="text-3xl font-black text-foreground">Estim8r is not on this account yet</h1>
        <p className="mt-3 text-muted-foreground">You are signed in as <span className="font-semibold text-foreground">{user?.email}</span>. Your Current Flow account is valid, but Estim8r requires its own purchase, subscription, trial, or bundle entitlement.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Button asChild className="h-12"><a href={purchaseUrl}><ShoppingBag className="mr-2 h-4 w-4" />View Estim8r access</a></Button>
          <Button type="button" variant="outline" className="h-12" onClick={logout}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
        </div>
        <p className="mt-5 text-xs text-muted-foreground">Purchasing Estim8r does not automatically purchase other Current Flow apps. Each product is licensed independently unless included in a bundle.</p>
      </div>
    </div>
  );
}
