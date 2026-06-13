"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProviders";
import Header from "@/components/Header";
import PageShell from "@/components/PageShell";
import { MarketsIcon } from "@/components/Icons";
import { formatTzs, fullDate } from "@/lib/format";
import type { GuapMarket } from "@/lib/guap";

export default function MarketsPage() {
  const { t, lang } = useApp();
  const [markets, setMarkets] = useState<GuapMarket[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/guap/markets", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMarkets(d.markets ?? []))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  return (
    <PageShell>
      <Header right="bell" />

      <main className="px-5">
        <div className="mt-2 flex items-center gap-2">
          <MarketsIcon className="h-5 w-5 text-gold" />
          <h1 className="text-xl font-bold">{t("markets.title")}</h1>
        </div>
        <p className="mt-1 text-sm text-secondary">{t("markets.subtitle")}</p>

        <div className="mt-4 space-y-3">
          {loaded && markets.length === 0 && (
            <p className="py-16 text-center text-sm text-secondary">{t("markets.empty")}</p>
          )}

          {markets.map((m, i) => (
            <div
              key={m.id}
              className="anim-fade-up rounded-2xl border border-app bg-card p-4"
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wide">
                <span className="font-semibold text-gold">{m.category}</span>
                {m.closesAt && (
                  <span className="text-secondary">
                    {t("markets.closes")} {fullDate(m.closesAt, lang)}
                  </span>
                )}
              </div>

              <h2 className="mt-2 text-sm font-bold leading-snug">{m.title}</h2>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-win/25 bg-win/10 px-3 py-2 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-win">
                    {t("markets.yes")}
                  </div>
                  <div className="text-lg font-extrabold text-win">
                    {m.yesPercent !== null ? `${m.yesPercent}%` : "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-loss/25 bg-loss/10 px-3 py-2 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-loss">
                    {t("markets.no")}
                  </div>
                  <div className="text-lg font-extrabold text-loss">
                    {m.noPercent !== null ? `${m.noPercent}%` : "—"}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                {m.volumeTzs !== null ? (
                  <span className="text-xs text-secondary">
                    {t("markets.volume")}: <strong className="text-primary">{formatTzs(m.volumeTzs)}</strong>
                  </span>
                ) : (
                  <span />
                )}
                <a
                  href={m.url ?? "https://guap.gold"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press rounded-lg bg-gold-400 px-3.5 py-2 text-xs font-bold text-navy-900 transition-opacity hover:opacity-90"
                >
                  {t("markets.trade")} ↗
                </a>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-[10px] text-secondary">{t("markets.disclaimer")}</p>
      </main>
    </PageShell>
  );
}
