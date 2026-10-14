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
      <header className="sticky top-0 z-50 shrink-0 border-b border-border bg-background/95 backdrop-blur-xl shadow-sm" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="w-full px-3 sm:px-6 lg:px-8">
          <div className="flex min-h-14 items-center justify-between gap-2 py-1">
            <Link to="/" className="flex min-h-[44px] items-center gap-2.5 min-w-0">
              <AppLogo className="h-9 w-9 shrink-0 rounded-xl" />
              <div className="min-w-0">
                <h1 className="text-base font-black tracking-tight leading-none text-foreground">Estim8r</h1>
                <p className="hidden xs:block text-xs font-semibold text-muted-foreground tracking-wide">Electrical estimating</p>
              </div>
            </Link>

            <div className="flex items-center gap-1">
              <nav className="hidden lg:flex items-center gap-1">
                {DESKTOP_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = active(tab);
                  return (
                    <Link key={tab.key} to={tab.path}>
                      <div className={cn(
                        "flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-all",
                        isActive
                          ? "bg-blue-600 text-white shadow-md shadow-blue-200 dark:bg-orange-500 dark:shadow-none"
                          : "text-foreground hover:bg-muted"
                      )}>
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </div>
                    </Link>
                  );
                })}
              </nav>

              <AppSwitcher />
              <button type="button" onClick={toggleTheme} className="ml-1 flex h-11 w-11 items-center justify-center rounded-full bg-muted hover:bg-muted/80 active:bg-muted/60" aria-label="Toggle dark mode" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
                {theme === "dark" ? <Sun className="h-5 w-5 text-foreground" /> : <Moon className="h-5 w-5 text-foreground" />}
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
                      <Button asChild size="touch" className={cn("ml-1 hidden sm:inline-flex", location.pathname.startsWith("/admin") && "ring-2 ring-blue-600 dark:ring-orange-500")}>
                        <Link to="/admin"><Shield className="h-4 w-4" />Access</Link>
                      </Button>
                    </>
                  )}
                  <Link to="/settings" className="ml-1 flex h-11 w-11 items-center justify-center rounded-full bg-muted hover:bg-muted/80" aria-label="Settings">
                    <Settings className="h-5 w-5 text-foreground" />
                  </Link>
                  <Link to="/profile" className="ml-1 flex h-11 w-11 items-center justify-center rounded-full bg-muted hover:bg-muted/80" aria-label="Profile">
                    <UserCircle className="h-6 w-6 text-foreground" />
                  </Link>
                  <Button type="button" variant="outline" size="touch" className="ml-1 hidden sm:inline-flex" onClick={() => void logout()}>
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </Button>
                </>
              ) : (
                <div className="ml-1 flex items-center gap-1.5">
                  <Button asChild size="touch" className={cn(onLogin && !location.pathname.startsWith("/login/owner") && "ring-2 ring-blue-600 dark:ring-orange-500")}>
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
        <Outlet />
      </main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl shadow-[0_-4px_24px_rgba(0,0,0,0.12)]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-stretch justify-around px-1 py-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = active(tab);
            return (
              <Link key={tab.key} to={tab.path} className="min-w-0 flex-1">
                <div className={cn(
                  "mx-0.5 flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-1",
                  isActive ? "bg-blue-100 text-blue-800 dark:bg-orange-500/15 dark:text-orange-300" : "text-foreground"
                )}>
                  <Icon className="h-5 w-5" />
                  <span className="max-w-full truncate text-[13px] font-bold leading-tight">{tab.label}</span>
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
