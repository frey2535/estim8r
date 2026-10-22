import React from "react";
import AppLogo from "@/components/branding/AppLogo";

/**
 * @param {{ title: string; subtitle?: string; footer?: import("react").ReactNode; children?: import("react").ReactNode; icon?: import("react").ComponentType<{ className?: string }>; }} props
 */
export default function AuthLayout({ title, subtitle, footer = null, children, icon: Icon }) {
  return (
    <div className="flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          {Icon ? <Icon className="mx-auto mb-4 h-12 w-12" /> : <AppLogo className="mx-auto mb-4 h-12 w-12 rounded-md" />}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="rounded-lg border border-border bg-card p-6 sm:p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}
