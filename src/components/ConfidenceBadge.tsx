"use client";

import { useApp } from "./AppProviders";

export default function ConfidenceBadge({ value }: { value: number }) {
  const { t } = useApp();
  const tone =
    value >= 75
      ? "text-win bg-win/10 border-win/30"
      : value >= 65
        ? "text-gold border-gold-500/30 bg-gold-500/10"
        : "text-secondary border-app bg-inset";
  return (
    <div className={`flex flex-col items-center rounded-lg border px-2.5 py-1 ${tone}`}>
      <span className="text-sm font-bold leading-tight">{value}%</span>
      <span className="text-[9px] uppercase tracking-wide opacity-80">{t("home.confidence")}</span>
    </div>
  );
}
