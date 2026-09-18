import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { BookOpen, Calculator, FolderOpen, Moon, Settings, Sun, TrendingUp, UserCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/ThemeContext";

const TABS = [
  { key: "estimates", path: "/", label: "Estimates", icon: FolderOpen },
  { key: "new", path: "/estimates/new", label: "New Estimate", icon: Calculator },
  { key: "labor", path: "/labor", label: "Labor", icon: BookOpen },
  { key: "production", path: "/production", label: "Production", icon: TrendingUp },
];

export default function AppLayout() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const active = (tab) => tab.path === "/" ? location.pathname === "/" : location.pathname.startsWith(tab.path);

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header
        className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl shadow-sm"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="grid w-8 h-8 place-items-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-950/20 dark:bg-orange-500">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight leading-none text-foreground">Estim8r</h1>
                <p className="text-[9px] font-semibold text-muted-foreground tracking-widest uppercase">Electrical Estimating</p>
              </div>
            </Link>

            <div className="flex items-center gap-1">
              <nav className="hidden sm:flex items-center gap-1">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = active(tab);
                  return (
                    <Link key={tab.key} to={tab.path}>
                      <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                        isActive
                          ? "bg-blue-600 text-white shadow-md shadow-blue-200 dark:bg-orange-500 dark:shadow-none"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}>
                        <Icon className="w-3.5 h-3.5" />
                        {tab.label}
                      </div>
                    </Link>
                  );
                })}
              </nav>

              <button
                type="button"
                onClick={toggleTheme}
                className="ml-1 w-8 h-8 rounded-full bg-muted hover:bg-muted/80 active:bg-muted/60 flex items-center justify-center transition-colors"
                aria-label="Toggle dark mode"
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun className="w-4 h-4 text-foreground" /> : <Moon className="w-4 h-4 text-foreground" />}
              </button>
              <Link to="/settings" className="ml-1 w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors" aria-label="Settings">
                <Settings className="w-4 h-4 text-foreground" />
              </Link>
              <Link to="/profile" className="ml-1 w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors" aria-label="Profile">
                <UserCircle className="w-5 h-5 text-foreground" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-4 pb-24 sm:pb-8">
        <Outlet />
      </main>

      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-border/60 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-around py-1.5 px-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = active(tab);
            return (
              <Link key={tab.key} to={tab.path} className="flex-1">
                <div className={cn(
                  "flex flex-col items-center gap-1 py-1.5 rounded-xl mx-1 transition-all",
                  isActive ? "text-blue-600 dark:text-orange-500" : "text-muted-foreground"
                )}>
                  <div className={cn(
                    "w-10 h-6 rounded-full flex items-center justify-center transition-all",
                    isActive ? "bg-blue-100 dark:bg-orange-500/10" : ""
                  )}>
                    <Icon className={cn("w-5 h-5 transition-all", isActive && "scale-110")} />
                  </div>
                  <span className="text-[10px] font-semibold">{tab.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
