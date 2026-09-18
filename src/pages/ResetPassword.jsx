import React,{useState} from "react";
import { Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export default function ResetPassword(){
 const[password,setPassword]=useState("");const[confirm,setConfirm]=useState("");const[error,setError]=useState("");const[busy,setBusy]=useState(false);
 async function submit(e){e.preventDefault();setError("");if(password!==confirm)return setError("Passwords do not match.");setBusy(true);try{await base44.auth.resetPassword({newPassword:password});window.location.href="/login";}catch(err){setError(err.message||"Password reset failed.");}finally{setBusy(false);}}
 return <AuthLayout icon={Lock} title="New password" subtitle="Update your Current Flow account password">{error&&<div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}<form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label>New password</Label><Input type="password" autoComplete="new-password" value={password} onChange={(e)=>setPassword(e.target.value)} className="h-12" minLength={6} required/></div><div className="space-y-2"><Label>Confirm password</Label><Input type="password" autoComplete="new-password" value={confirm} onChange={(e)=>setConfirm(e.target.value)} className="h-12" minLength={6} required/></div><Button className="h-12 w-full" disabled={busy}>{busy?"Updating...":"Update password"}</Button></form></AuthLayout>;
}
