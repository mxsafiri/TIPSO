"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProviders";
import Header from "@/components/Header";
import PageShell from "@/components/PageShell";
import TeamBadge from "@/components/TeamBadge";
import { ShieldCheckIcon } from "@/components/Icons";
import { dayLabel } from "@/lib/format";
import type { PlatformStats, Tip } from "@/lib/types";

export default function StatsPage() {
  const { t, lang } = useApp();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recent, setRecent] = useState<Tip[]>([]);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => {
        setStats(d.stats ?? null);
        setRecent(d.recent ?? []);
      })
      .catch(() => undefined);
  }, []);

  return (
    <PageShell>
      <Header right="bell" />

      <main className="px-5">
        <h1 className="mt-2 text-xl font-bold">{t("stats.title")}</h1>
        <p className="mt-1 flex items-start gap-1.5 text-xs text-secondary">
          <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          {t("stats.subtitle")}
        </p>

        {stats && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-app bg-card p-4">
                <div className="text-2xl font-extrabold">{stats.settledTips}</div>
                <div className="mt-1 text-xs text-secondary">{t("stats.totalTips")}</div>
              </div>
              <div className="rounded-2xl border border-app bg-card p-4">
                <div className="text-2xl font-extrabold text-win">{stats.accuracy}%</div>
                <div className="mt-1 text-xs text-secondary">{t("stats.accuracy")}</div>
              </div>
              <div className="rounded-2xl border border-app bg-card p-4">
                <div className="text-2xl font-extrabold text-gold">+{stats.roi}%</div>
                <div className="mt-1 text-xs text-secondary">{t("stats.roi")}</div>
              </div>
              <div className="rounded-2xl border border-app bg-card p-4">
                <div className="text-2xl font-extrabold">{stats.avgOdds.toFixed(2)}</div>
                <div className="mt-1 text-xs text-secondary">{t("stats.avgOdds")}</div>
              </div>
            </div>

            <h2 className="mt-6 text-lg font-bold">{t("stats.monthly")}</h2>
            <div className="mt-3 overflow-hidden rounded-2xl border border-app bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-app text-left text-xs uppercase tracking-wide text-secondary">
                    <th className="px-4 py-2.5 font-semibold">{t("stats.month")}</th>
                    <th className="px-4 py-2.5 text-right font-semibold">{t("home.tipsGiven")}</th>
                    <th className="px-4 py-2.5 text-right font-semibold">{t("stats.accuracy")}</th>
                    <th className="px-4 py-2.5 text-right font-semibold">{t("stats.roi")}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.monthly.map((m) => (
                    <tr key={m.month} className="border-b border-app last:border-0">
                      <td className="px-4 py-2.5 font-semibold">{m.month}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{m.tips}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-win">{m.accuracy}%</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gold">
                        {m.roi >= 0 ? "+" : ""}
                        {m.roi}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <h2 className="mt-6 text-lg font-bold">{t("stats.recentResults")}</h2>
        <div className="mt-3 space-y-2">
          {recent.map((tip, i) => (
            <div
              key={tip.id}
              className="anim-fade-up flex items-center gap-3 rounded-2xl border border-app bg-card px-4 py-3"
              style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
            >
              <TeamBadge code={tip.homeCode} color={tip.homeColor} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {tip.home} vs {tip.away}
                </div>
                <div className="truncate text-xs text-secondary">
                  {lang === "sw" ? tip.predictionSw : tip.prediction} · @{tip.odds.toFixed(2)} ·{" "}
                  {dayLabel(tip.kickoff, lang)}
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`rounded-md px-2 py-1 text-[10px] font-extrabold ${
                    tip.status === "won" ? "bg-win/10 text-win" : "bg-loss/10 text-loss"
                  }`}
                >
                  {tip.status === "won" ? t("stats.won") : t("stats.lost")}
                </span>
                {tip.result && <div className="mt-1 text-xs tabular-nums text-secondary">{tip.result}</div>}
              </div>
            </div>
          ))}
        </div>
      </main>
    </PageShell>
  );
}
