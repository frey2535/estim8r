import React, { Suspense, lazy, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { queryClientInstance } from "@/lib/query-client";
import { AuthProvider } from "@/lib/AuthContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import ProtectedRoute, { LoginRedirect } from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import Login from "@/pages/Login";
import UpdateAvailablePrompt from "@/components/UpdateAvailablePrompt";
import { RESET_ERRORS_EVENT } from "@/lib/appRefresh";
import { installOwnerChatEvidence } from "@/lib/ownerChatEvidence";

installOwnerChatEvidence();

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const LaborLibrary = lazy(() => import("@/pages/LaborLibrary"));
const EstimateBuilder = lazy(() => import("@/pages/EstimateBuilder"));
const Production = lazy(() => import("@/pages/Production"));
const TakeoffWorkspace = lazy(() => import("@/pages/TakeoffWorkspace"));
const MarkupPages = lazy(() => import("@/pages/MarkupPages"));
const Settings = lazy(() => import("@/pages/Settings"));
const OwnerAdmin = lazy(() => import("@/pages/OwnerAdmin"));
const Register = lazy(() => import("@/pages/Register"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const FromBuildr = lazy(() => import("@/pages/FromBuildr"));

function PageLoader() {
  return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 dark:border-t-orange-500 rounded-full animate-spin" /></div>;
}

function FailedRequestReset() {
  useEffect(() => {
    const onReset = () => {
      queryClientInstance.clear();
    };
    window.addEventListener(RESET_ERRORS_EVENT, onReset);
    return () => window.removeEventListener(RESET_ERRORS_EVENT, onReset);
  }, []);
  return null;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/login/owner" element={<Login platformOwner />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/from-buildr" element={<FromBuildr />} />
          <Route element={<ProtectedRoute unauthenticatedElement={<LoginRedirect />} />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/estimates/new" element={<EstimateBuilder />} />
            <Route path="/labor" element={<LaborLibrary />} />
            <Route path="/production" element={<Production />} />
            <Route path="/takeoff" element={<TakeoffWorkspace />} />
            <Route path="/markup" element={<MarkupPages />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Settings />} />
          </Route>
          <Route element={<ProtectedRoute requireProduct={false} unauthenticatedElement={<LoginRedirect />} />}>
            <Route path="/admin" element={<OwnerAdmin />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <div className="h-full min-h-dvh">
      <AuthProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClientInstance}>
            <Router>
              <AppErrorBoundary>
                <AppRoutes />
              </AppErrorBoundary>
            </Router>
            <FailedRequestReset />
            <UpdateAvailablePrompt />
            <Toaster />
          </QueryClientProvider>
        </ThemeProvider>
      </AuthProvider>
    </div>
  );
}
