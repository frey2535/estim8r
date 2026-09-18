import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export default function ForgotPassword() {
  const [email,setEmail]=useState(""); const [sent,setSent]=useState(false); const [busy,setBusy]=useState(false);
  async function submit(e){e.preventDefault();setBusy(true);try{await base44.auth.resetPasswordRequest(email);}finally{setBusy(false);setSent(true);}}
  return <AuthLayout icon={Mail} title="Reset password" subtitle="Recover your Current Flow account" footer={<Link to="/login" className="text-primary font-medium hover:underline"><ArrowLeft className="mr-1 inline h-3 w-3"/>Back to sign in</Link>}>
    {sent?<p className="text-center text-sm text-foreground">If an account exists with that email, a reset link has been sent.</p>:<form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="h-12" required/></div><Button className="h-12 w-full" disabled={busy}>{busy?"Sending...":"Send reset link"}</Button></form>}
  </AuthLayout>;
}
