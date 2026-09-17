import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';

const AuthContext=createContext();
const AUTH_STARTUP_TIMEOUT_MS=10000;
function withTimeout(promise,ms,message){let id;const timeout=new Promise((_,reject)=>{id=window.setTimeout(()=>reject(new Error(message)),ms)});return Promise.race([promise,timeout]).finally(()=>window.clearTimeout(id))}
export const AuthProvider=({children})=>{const[user,setUser]=useState(null);const[isAuthenticated,setIsAuthenticated]=useState(false);const[isLoadingAuth,setIsLoadingAuth]=useState(true);const[isLoadingPublicSettings,setIsLoadingPublicSettings]=useState(false);const[authError,setAuthError]=useState(null);const[authChecked,setAuthChecked]=useState(false);
 const checkAppState=useCallback(async()=>{setAuthError(null);setIsLoadingAuth(true);try{const current=await withTimeout(base44.auth.me(),AUTH_STARTUP_TIMEOUT_MS,'Authentication took too long. Refresh Estim8r.');setUser(current);setIsAuthenticated(true)}catch(error){setUser(null);setIsAuthenticated(false);if(error?.status!==401)setAuthError(error)}finally{setIsLoadingAuth(false);setIsLoadingPublicSettings(false);setAuthChecked(true)}},[]);
 useEffect(()=>{checkAppState();if(!supabase)return undefined;const{data}=supabase.auth.onAuthStateChange(()=>checkAppState());return()=>data.subscription.unsubscribe()},[checkAppState]);
 useEffect(()=>{const refresh=()=>{if(document.visibilityState&&document.visibilityState!=='visible')return;checkAppState()};window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)}},[checkAppState]);
 const logout=async()=>{setUser(null);setIsAuthenticated(false);await base44.auth.logout()};
 return <AuthContext.Provider value={{user,isAuthenticated,isLoadingAuth,isLoadingPublicSettings,authError,authChecked,appPublicSettings:{id:'estim8r',public_settings:{auth_required:true}},logout,navigateToLogin:()=>{window.location.href='/login'},checkUserAuth:checkAppState,checkAppState}}>{children}</AuthContext.Provider>};
export const useAuth=()=>{const c=useContext(AuthContext);if(!c)throw new Error('useAuth must be used within an AuthProvider');return c};
