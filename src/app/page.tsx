"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProviders";
import Header from "@/components/Header";
import PageShell from "@/components/PageShell";
import TeamBadge from "@/components/TeamBadge";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import { FlameIcon, LockIcon, ShieldCheckIcon } from "@/components/Icons";
import { matchTimeLabel } from "@/lib/format";
import { isSameDay } from "@/lib/format";
import type { TipDto } from "@/lib/dto";
import type { PlatformStats } from "@/lib/types";

export default function HomePage() {
  const { t, lang, user } = useApp();
  const [tips, setTips] = useState<TipDto[]>([]);
  const [hasPremium, setHasPremium] = useState(false);
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    fetch("/api/tips")
      .then((r) => r.json())
      .then((d) => {
        setTips(d.tips ?? []);
        setHasPremium(Boolean(d.hasPremium));
      })
      .catch(() => undefined);
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setStats(d.stats ?? null))
      .catch(() => undefined);
  }, [user]);

  const todayTips = useMemo(() => {
    const now = new Date();
    return tips.filter((tip) => !tip.live && isSameDay(new Date(tip.kickoff), now));
  }, [tips]);

  const featured = useMemo(() => {
    const unlocked = todayTips.filter((tip) => !tip.locked);
    const pool = unlocked.length > 0 ? unlocked : todayTips;
    return [...pool].sort((a, b) => b.confidence - a.confidence)[0];
  }, [todayTips]);

  const hotPicks = useMemo(
    () => todayTips.filter((tip) => tip.isHotPick && tip.id !== featured?.id).slice(0, 4),
    [todayTips, featured],
  );

  const hasWorldCup = useMemo(() => tips.some((tip) => tip.league.includes("World Cup")), [tips]);

  const firstName = user?.name.split(" ")[0];

  return (
    <PageShell>
      <Header right="bell" />

      <main className="px-5">
        <p className="mt-2 text-sm text-secondary">
          {firstName ? `${t("home.greeting")}, ${firstName}` : t("home.guest")} 👋
        </p>

        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-bold">{t("home.topTips")}</h1>
          <Link href="/tips" className="text-xs font-semibold text-gold">
            {t("home.viewAll")}
          </Link>
        </div>

        {featured && (
          <div className="anim-fade-up rounded-2xl border border-gold-500/25 bg-card p-4 shadow-lg shadow-black/5 mt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wide text-gold">{featured.league}</span>
              <span className="text-secondary">{matchTimeLabel(featured.kickoff, lang)}</span>
            </div>
            <div className="mt-5 flex items-center justify-between gap-2">
              <div className="flex flex-1 flex-col items-center gap-2">
                <TeamBadge code={featured.homeCode} color={featured.homeColor} size={56} />
                <span className="text-center text-sm font-semibold">{featured.home}</span>
              </div>
              <span className="text-sm font-bold text-secondary">VS</span>
              <div className="flex flex-1 flex-col items-center gap-2">
                <TeamBadge code={featured.awayCode} color={featured.awayColor} size={56} />
                <span className="text-center text-sm font-semibold">{featured.away}</span>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-inset px-3.5 py-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-secondary">{t("home.tip")}</div>
                <div className="truncate text-base font-bold">
                  {featured.locked ? "•••••" : lang === "sw" ? featured.predictionSw : featured.prediction}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wide text-secondary">{t("home.odds")}</div>
                  <div className="text-base font-bold text-gold">{featured.odds.toFixed(2)}</div>
                </div>
                <ConfidenceBadge value={featured.confidence} />
              </div>
            </div>
          </div>
        )}

        {hasWorldCup && (
          <Link
            href="/tips"
            className="anim-fade-up press mt-4 flex items-center gap-3 rounded-2xl border border-gold-500/40 bg-gradient-to-r from-navy-800 to-navy-700 px-4 py-3 dark:from-navy-800 dark:to-navy-700"
            style={{ animationDelay: "80ms" }}
          >
            <span className="anim-trophy text-2xl">🏆</span>
            <div className="flex-1">
              <div className="text-sm font-bold text-white">{t("wc.banner")}</div>
              <div className="text-[11px] text-gold-300">{t("wc.bannerDesc")}</div>
            </div>
            <span className="text-xs font-semibold text-gold">{t("home.viewAll")}</span>
          </Link>
        )}

        {stats && (
          <div
            className="anim-fade-up mt-4 flex items-center gap-3 rounded-2xl border border-app bg-card px-4 py-3"
            style={{ animationDelay: "140ms" }}
          >
            <ShieldCheckIcon className="h-8 w-8 shrink-0 text-gold" />
            <div className="flex-1">
              <div className="text-xs font-semibold">{t("home.todayRecord")}</div>
              <div className="mt-0.5 flex gap-4 text-[11px] text-secondary">
                <span>
                  <strong className="text-primary">{stats.settledTips}</strong> {t("home.tipsGiven")}
                </span>
                <span>
                  <strong className="text-win">{stats.accuracy}%</strong> {t("home.accuracy")}
                </span>
                <span>
                  <strong className="text-gold">+{stats.roi}%</strong> {t("home.roi")}
                </span>
              </div>
            </div>
            <Link href="/stats" className="text-xs font-semibold text-gold">
              {t("home.viewAll")}
            </Link>
          </div>
        )}

        <div className="mt-6 flex items-center gap-1.5">
          <h2 className="text-lg font-bold">{t("home.hotPicks")}</h2>
          <FlameIcon className="h-5 w-5 text-orange-500" />
        </div>

        <div className="mt-3 space-y-2.5">
          {hotPicks.map((tip, i) => (
            <Link
              key={tip.id}
              href="/tips"
              className="anim-fade-up press flex items-center gap-3 rounded-2xl border border-app bg-card px-4 py-3 transition-colors hover:border-gold-500/40"
              style={{ animationDelay: `${200 + i * 70}ms` }}
            >
              <TeamBadge code={tip.homeCode} color={tip.homeColor} size={38} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {tip.home} vs {tip.away}
                </div>
                <div className="text-xs text-secondary">{matchTimeLabel(tip.kickoff, lang)}</div>
              </div>
              {tip.locked ? (
                <LockIcon className="h-4 w-4 text-gold" />
              ) : (
                <span className="text-base font-bold text-gold">{tip.odds.toFixed(2)}</span>
              )}
            </Link>
          ))}
        </div>

        {!hasPremium && (
          <Link
            href="/plans"
            className="anim-shimmer press mt-6 block rounded-2xl bg-gradient-to-r from-gold-500 to-gold-400 p-4 text-navy-900"
          >
            <div className="text-base font-extrabold">{t("home.goPremium")} 👑</div>
            <div className="mt-0.5 text-xs font-medium opacity-80">{t("home.goPremiumDesc")}</div>
          </Link>
        )}

        <p className="mt-8 text-center text-[10px] text-secondary">{t("common.poweredBy")}</p>
      </main>
    </PageShell>
  );
}
