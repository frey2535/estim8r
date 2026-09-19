import React, { Suspense, lazy } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { queryClientInstance } from "@/lib/query-client";
import { AuthProvider } from "@/lib/AuthContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import UpdateAvailablePrompt from "@/components/UpdateAvailablePrompt";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const LaborLibrary = lazy(() => import("@/pages/LaborLibrary"));
const EstimateBuilder = lazy(() => import("@/pages/EstimateBuilder"));
const Production = lazy(() => import("@/pages/Production"));
const TakeoffWorkspace = lazy(() => import("@/pages/TakeoffWorkspace"));
const Settings = lazy(() => import("@/pages/Settings"));
const Register = lazy(() => import("@/pages/Register"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));

function PageLoader() {
  return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 dark:border-t-orange-500 rounded-full animate-spin" /></div>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/estimates/new" element={<EstimateBuilder />} />
            <Route path="/labor" element={<LaborLibrary />} />
            <Route path="/production" element={<Production />} />
            <Route path="/takeoff" element={<TakeoffWorkspace />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Settings />} />
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
              <AppRoutes />
            </Router>
            <UpdateAvailablePrompt />
            <Toaster />
          </QueryClientProvider>
        </ThemeProvider>
      </AuthProvider>
    </div>
  );
}
