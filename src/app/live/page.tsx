"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProviders";
import Header from "@/components/Header";
import PageShell from "@/components/PageShell";
import TeamBadge from "@/components/TeamBadge";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import type { TipDto } from "@/lib/dto";

export default function LivePage() {
  const { t, lang } = useApp();
  const [tips, setTips] = useState<TipDto[]>([]);

  useEffect(() => {
    fetch("/api/tips")
      .then((r) => r.json())
      .then((d) => setTips(d.tips ?? []))
      .catch(() => undefined);
  }, []);

  const liveTips = useMemo(() => tips.filter((tip) => tip.live), [tips]);

  return (
    <PageShell>
      <Header right="bell" />

      <main className="px-5">
        <div className="mt-2 flex items-center gap-2">
          <h1 className="text-xl font-bold">{t("live.title")}</h1>
          <span className="live-dot h-2.5 w-2.5 rounded-full bg-loss" />
        </div>

        <div className="mt-4 space-y-3">
          {liveTips.length === 0 && (
            <p className="py-16 text-center text-sm text-secondary">{t("live.empty")}</p>
          )}
          {liveTips.map((tip, i) => (
            <div
              key={tip.id}
              className="anim-fade-up rounded-2xl border border-app bg-card p-4"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wide text-gold">{tip.league}</span>
                <span className="flex items-center gap-1.5 rounded-full bg-loss/10 px-2 py-0.5 text-[10px] font-bold text-loss">
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-loss" />
                  {t("live.live")} {tip.live?.minute}&apos;
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="flex flex-1 flex-col items-center gap-2">
                  <TeamBadge code={tip.homeCode} color={tip.homeColor} />
                  <span className="text-center text-sm font-semibold leading-tight">{tip.home}</span>
                </div>
                <div className="text-2xl font-extrabold tabular-nums">
                  {tip.live?.homeScore}
                  <span className="px-1.5 text-secondary">–</span>
                  {tip.live?.awayScore}
                </div>
                <div className="flex flex-1 flex-col items-center gap-2">
                  <TeamBadge code={tip.awayCode} color={tip.awayColor} />
                  <span className="text-center text-sm font-semibold leading-tight">{tip.away}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-inset px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-secondary">{t("live.liveTip")}</div>
                  <div className="truncate text-sm font-bold">
                    {lang === "sw" ? tip.predictionSw : tip.prediction}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wide text-secondary">{t("home.odds")}</div>
                    <div className="text-sm font-bold text-gold">{tip.odds.toFixed(2)}</div>
                  </div>
                  <ConfidenceBadge value={tip.confidence} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </PageShell>
  );
}
