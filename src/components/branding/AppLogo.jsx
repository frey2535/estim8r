import React from "react";
import { cn } from "@/lib/utils";

export default function AppLogo({ className, alt = "Estim8r logo" }) {
  return (
    <img
      src="/logo.png"
      alt={alt}
      className={cn("object-cover shadow-md shadow-blue-950/20", className)}
      loading="eager"
    />
  );
}
