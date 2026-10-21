import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { BookOpen, Calculator, FolderOpen, LogIn, LogOut, MessageSquare, Moon, ScanSearch, Settings, Shield, Sun, TrendingUp, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { canManageEstim8rAccess } from "@/lib/ownerAccessRules";
import { useTheme } from "@/lib/ThemeContext";
import AppLogo from "@/components/branding/AppLogo";
import AppSwitcher from "@/components/platform/AppSwitcher";
import GoogleSignInButton from "@/components/platform/GoogleSignInButton";
import OwnerCursorChat from "@/components/platform/OwnerCursorChat";
import DrawingFileInput from "@/components/takeoff/DrawingFileInput";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import AppRefreshButton from "@/components/AppRefreshButton";
import { Button } from "@/components/ui/button";

const TABS = [
  { key: "estimates", path: "/", label: "Estimates", icon: FolderOpen },
  { key: "new", path: "/estimates/new", label: "Estimate", icon: Calculator },
  { key: "takeoff", path: "/takeoff", label: "Takeoff", icon: ScanSearch },
  { key: "labor", path: "/labor", label: "Labor", icon: BookOpen },
  { key: "production", path: "/production", label: "Production", icon: TrendingUp },
];

const DESKTOP_TABS = TABS.map((tab) => (
  tab.key === "new" ? { ...tab, label: "New Estimate" } : tab
));

export default function AppLayout() {
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuth();
  const showAccessAdmin = isAuthenticated && canManageEstim8rAccess(user);
  const { theme, toggleTheme } = useTheme();
  const active = (tab) => tab.path === "/" ? location.pathname === "/" : location.pathname.startsWith(tab.path);
  const takeoff = location.pathname.startsWith("/takeoff") || location.pathname.startsWith("/markup");
  const onLogin = location.pathname.startsWith("/login");

  return (
    <div className="flex h-dvh min-h-dvh w-full flex-col overflow-hidden bg-background">
      <header className="sticky top-0 z-50 shrink-0 border-b border-border bg-card/95 backdrop-blur-xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="w-full px-3 sm:px-5 lg:px-6">
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 py-1.5">
            <div className="flex min-w-0 items-center gap-4">
              <Link to="/" className="flex min-h-[44px] items-center gap-2.5 min-w-0">
                <AppLogo className="h-8 w-8 shrink-0 rounded-md" />
                <div className="min-w-0">
                  <h1 className="text-sm font-semibold tracking-tight leading-none text-foreground">Estim8r</h1>
                  <p className="mt-0.5 hidden text-[11px] text-muted-foreground sm:block">Electrical estimating</p>
                </div>
              </Link>
              <nav className="hidden lg:flex items-center gap-0.5" aria-label="Primary">
                {DESKTOP_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = active(tab);
                  return (
                    <Link key={tab.key} to={tab.path}>
                      <div className={cn(
                        "flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}>
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-1">
              <AppRefreshButton className="h-9 min-h-9 bg-transparent px-2.5 text-foreground shadow-none hover:bg-muted dark:bg-transparent dark:hover:bg-muted" />
              <AppSwitcher />
              <button type="button" onClick={toggleTheme} className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Toggle dark mode" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              {isAuthenticated ? (
                <>
                  {showAccessAdmin && (
                    <>
                      <Button
                        type="button"
                        size="touch"
                        variant="outline"
                        className="ml-1 hidden sm:inline-flex"
                        data-testid="owner-cursor-chat-header"
                        onClick={() => window.dispatchEvent(new Event("estim8r-open-owner-cursor-chat"))}
                      >
                        <MessageSquare className="h-4 w-4" />
                        Cursor
                      </Button>
                      <Button asChild size="touch" className={cn("ml-1 hidden sm:inline-flex", location.pathname.startsWith("/admin") && "ring-2 ring-foreground")}>
                        <Link to="/admin"><Shield className="h-4 w-4" />Access</Link>
                      </Button>
                    </>
                  )}
                  <Link to="/settings" className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Settings">
                    <Settings className="h-4 w-4" />
                  </Link>
                  <Link to="/profile" className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Profile">
                    <UserCircle className="h-4 w-4" />
                  </Link>
                  <Button type="button" variant="outline" size="touch" className="ml-1 hidden sm:inline-flex" onClick={() => void logout()}>
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </Button>
                </>
              ) : (
                <div className="ml-1 flex items-center gap-1.5">
                  <Button asChild size="touch" className={cn(onLogin && !location.pathname.startsWith("/login/owner") && "ring-2 ring-foreground")}>
                    <Link to="/login"><LogIn className="h-4 w-4" />Sign in</Link>
                  </Button>
                  <GoogleSignInButton compact className="h-11 min-h-[44px] px-3" />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <DrawingFileInput />

      <main className={cn(
        "flex min-h-0 w-full flex-1 flex-col",
        takeoff
          ? "overflow-hidden px-0 py-0 pb-[4.75rem] lg:pb-0"
          : "overflow-auto px-4 py-4 pb-28 sm:px-6 lg:px-8 lg:pb-8"
      )}>
        <AppErrorBoundary resetKey={location.pathname}>
          <Outlet />
        </AppErrorBoundary>
      </main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-xl" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-label="Primary">
        <div className="flex items-stretch justify-around px-1 py-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = active(tab);
            return (
              <Link key={tab.key} to={tab.path} className="min-w-0 flex-1">
                <div className={cn(
                  "mx-0.5 flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-md px-1",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}>
                  <Icon className={cn("h-5 w-5", isActive && "stroke-[2.4]")} />
                  <span className={cn("max-w-full truncate text-[12px] leading-tight", isActive ? "font-semibold" : "font-medium")}>{tab.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
      <OwnerCursorChat />
    </div>
  );
}
