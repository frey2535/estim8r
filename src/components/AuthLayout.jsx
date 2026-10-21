import React from "react";
import AppLogo from "@/components/branding/AppLogo";

/**
 * @param {{
 *   title?: React.ReactNode,
 *   subtitle?: React.ReactNode,
 *   footer?: React.ReactNode,
 *   icon?: React.ComponentType<any> | React.ReactNode,
 *   children?: React.ReactNode,
 * }} props
 */
export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <AppLogo className="mx-auto mb-4 h-12 w-12 rounded-md" />
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
