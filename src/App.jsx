import React, { Component, Suspense, lazy } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { queryClientInstance } from "@/lib/query-client";
import { AuthProvider } from "@/lib/AuthContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import ProtectedRoute, { LoginRedirect } from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import UpdateAvailablePrompt from "@/components/UpdateAvailablePrompt";
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

class RouteCrashBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error) {
    console.error("Estim8r screen crashed", error);
  }

  render() {
    if (this.state.crashed) {
      return (
        <div className="mx-auto max-w-lg p-6 text-center">
          <h1 className="text-lg font-bold text-foreground">This screen hit a problem</h1>
          <p className="mt-2 text-sm text-muted-foreground">Reload Estim8r to keep working. Your saved takeoff and estimates stay in this browser.</p>
          <button
            type="button"
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
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
              <RouteCrashBoundary>
                <AppRoutes />
              </RouteCrashBoundary>
            </Router>
            <UpdateAvailablePrompt />
            <Toaster />
          </QueryClientProvider>
        </ThemeProvider>
      </AuthProvider>
    </div>
  );
}
