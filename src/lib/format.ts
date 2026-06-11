import type { Lang } from "./i18n";

export function formatTzs(amount: number): string {
  return `TZS ${amount.toLocaleString("en-US")}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

export function dayLabel(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isSameDay(d, now)) return lang === "sw" ? "Leo" : "Today";
  if (isSameDay(d, tomorrow)) return lang === "sw" ? "Kesho" : "Tomorrow";
  return d.toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-GB", { day: "numeric", month: "short" });
}

export function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function matchTimeLabel(iso: string, lang: Lang): string {
  return `${dayLabel(iso, lang)} ${timeLabel(iso)}`;
}

export function dateChipLabel(d: Date, lang: Lang): { top: string; bottom: string } {
  return {
    top: d.toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-GB", { day: "numeric", month: "short" }),
    bottom: d.toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-GB", { weekday: "short" }),
  };
}

export function fullDate(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
