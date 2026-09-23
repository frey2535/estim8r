import React from "react";

const TONE = {
  REFERENCE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  ESTIM8R: "border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-200",
  COMPANY: "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200",
  CUSTOM: "border-violet-500/40 bg-violet-500/10 text-violet-800 dark:text-violet-200",
  UNVERIFIED: "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200",
};

export default function SourceBadges({ badges = [] }) {
  if (!badges.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {badges.map((badge) => (
        <span
          key={badge}
          className={`rounded px-1.5 py-0 text-[10px] font-bold uppercase tracking-wide ${TONE[badge] || TONE.UNVERIFIED}`}
        >
          {badge}
        </span>
      ))}
    </span>
  );
}
