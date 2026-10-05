import React from "react";
import { cn } from "@/lib/utils";
import { brandingLayout, resolveLogoBox } from "@/domain/estimate/branding";

export default function CompanyLogo({
  branding,
  design,
  className,
  alt = "Company logo",
}) {
  const layout = brandingLayout(branding);
  const box = resolveLogoBox(layout, design);
  const style = {
    width: `${box.width}px`,
    height: `${box.height}px`,
    objectFit: "fill",
  };

  if (!layout.logoDataUrl) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-dashed border-border bg-white text-center text-[10px] text-muted-foreground",
          className,
        )}
        style={style}
      >
        No logo
      </div>
    );
  }

  return (
    <img
      src={layout.logoDataUrl}
      alt={alt}
      className={cn("block max-w-none rounded-lg border border-border bg-white", className)}
      style={style}
    />
  );
}
