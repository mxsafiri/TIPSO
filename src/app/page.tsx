"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProviders";
import Header from "@/components/Header";
import PageShell from "@/components/PageShell";
import TeamBadge from "@/components/TeamBadge";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import { FlameIcon, LockIcon, ShieldCheckIcon } from "@/components/Icons";
import { matchTimeLabel, isSameDay } from "@/lib/format";
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

      <main className="px-4">
        {/* Greeting */}
        <p className="mt-1 text-sm text-secondary">
          {firstName ? `${t("home.greeting")}, ${firstName}` : t("home.guest")} 👋
        </p>

        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-bold">{t("home.topTips")}</h1>
          <Link href="/tips" className="text-xs font-semibold text-gold">
            {t("home.viewAll")}
          </Link>
        </div>

        {/* ── Featured Match Card ──────────────────────────────────── */}
        {featured && (
          <div
            className="anim-fade-up relative mt-3 overflow-hidden rounded-[26px]"
            style={{
              boxShadow: '0 0 0 1px var(--border-subtle), 0 20px 60px rgba(0,0,0,0.3)',
              background: 'var(--bg-card)',
            }}
          >
            {/* Team color atmospheric washes */}
            <div
              className="pointer-events-none absolute inset-0 glow-pulse"
              style={{
                background: `radial-gradient(ellipse 55% 90% at 10% 50%, ${featured.homeColor}22, transparent 55%), radial-gradient(ellipse 55% 90% at 90% 50%, ${featured.awayColor}22, transparent 55%)`,
              }}
            />
            {/* Dot-grid texture */}
            <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-40" />

            <div className="relative">
              {/* League + kickoff strip */}
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-gold">
                  {featured.league}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-secondary">
                  <span className="h-1 w-1 rounded-full" style={{ background: 'var(--gold)', opacity: 0.5 }} />
                  {matchTimeLabel(featured.kickoff, lang)}
                </span>
              </div>

              {/* Teams */}
              <div className="flex items-center justify-between gap-4 px-5 py-6">
                <div className="flex flex-1 flex-col items-center gap-3">
                  <div style={{ filter: `drop-shadow(0 4px 16px ${featured.homeColor}44)` }}>
                    <TeamBadge code={featured.homeCode} color={featured.homeColor} size={62} />
                  </div>
                  <span className="text-center text-[13px] font-bold leading-tight text-primary">
                    {featured.home}
                  </span>
                </div>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.22em]" style={{ color: 'rgba(128,128,128,0.3)' }}>
                  VS
                </span>
                <div className="flex flex-1 flex-col items-center gap-3">
                  <div style={{ filter: `drop-shadow(0 4px 16px ${featured.awayColor}44)` }}>
                    <TeamBadge code={featured.awayCode} color={featured.awayColor} size={62} />
                  </div>
                  <span className="text-center text-[13px] font-bold leading-tight text-primary">
                    {featured.away}
                  </span>
                </div>
              </div>

              {/* Intelligence strip */}
              <div className="relative mx-4 mb-4 overflow-hidden rounded-2xl">
                <div
                  className="fill-animate absolute inset-y-0 left-0 rounded-l-2xl bg-gradient-to-r from-gold-500/[0.14] via-gold-500/[0.07] to-transparent"
                  style={{ width: `${featured.confidence}%` }}
                />
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{ boxShadow: 'inset 0 0 0 1px var(--border-subtle)' }}
                />
                <div
                  className="relative flex items-center justify-between gap-3 px-4 py-3.5"
                  style={{ background: 'var(--strip-bg)', backdropFilter: 'blur(4px)' }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-secondary/50">
                      {t("home.tip")}
                    </div>
                    <div className="mt-0.5 truncate text-[15px] font-bold text-primary">
                      {featured.locked
                        ? <span className="select-none blur-[5px]">Hidden Pick</span>
                        : (lang === "sw" ? featured.predictionSw : featured.prediction)
                      }
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3.5">
                    <div className="text-right">
                      <div className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-secondary/50">
                        {t("home.odds")}
                      </div>
                      <div className="mt-0.5 text-xl font-extrabold text-gold tabular-nums">
                        {featured.odds.toFixed(2)}
                      </div>
                    </div>
                    <div className="h-8 w-px" style={{ background: 'var(--border-subtle)' }} />
                    <div className="flex flex-col items-center gap-0.5">
                      <ConfidenceBadge value={featured.confidence} />
                      <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-secondary/40">
                        Conf.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lock CTA row */}
                {featured.locked && (
                  <div
                    className="relative flex items-center justify-between px-4 py-2.5"
                    style={{
                      borderTop: '1px solid var(--border-subtle)',
                      background: 'var(--strip-bg)',
                    }}
                  >
                    <div className="flex items-center gap-1.5 text-secondary">
                      <LockIcon className="h-3.5 w-3.5 text-gold" />
                      <span className="text-xs">{t("tips.premiumLocked")}</span>
                    </div>
                    <Link
                      href="/plans"
                      className="rounded-xl bg-gold-400 px-4 py-1.5 text-xs font-extrabold text-navy-900 transition-opacity hover:opacity-90 active:scale-95"
                    >
                      {t("tips.unlock")}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* World Cup banner */}
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

        {/* Stats strip */}
        {stats && stats.settledTips > 0 && (
          <div
            className="anim-fade-up mt-3 flex items-center gap-3 rounded-[18px] px-4 py-3"
            style={{
              background: 'var(--bg-card)',
              boxShadow: '0 0 0 1px var(--border-ring), 0 2px 12px rgba(0,0,0,0.1)',
              animationDelay: '140ms',
            }}
          >
            <ShieldCheckIcon className="h-7 w-7 shrink-0 text-gold" />
            <div className="flex-1">
              <div className="text-[11px] font-bold text-primary">{t("home.todayRecord")}</div>
              <div className="mt-0.5 flex gap-3.5 text-[11px] text-secondary">
                <span>
                  <strong className="text-primary tabular-nums">{stats.settledTips}</strong>{" "}
                  {t("home.tipsGiven")}
                </span>
                <span>
                  <strong className="text-win tabular-nums">{stats.accuracy}%</strong>{" "}
                  {t("home.accuracy")}
                </span>
                <span>
                  <strong className="text-gold tabular-nums">+{stats.roi}%</strong>{" "}
                  {t("home.roi")}
                </span>
              </div>
            </div>
            <Link href="/stats" className="text-xs font-bold text-gold">
              {t("home.viewAll")}
            </Link>
          </div>
        )}

        {/* Hot Picks */}
        <div className="mt-5 flex items-center gap-1.5">
          <h2 className="text-[17px] font-bold">{t("home.hotPicks")}</h2>
          <FlameIcon className="h-5 w-5 text-orange-500" />
        </div>

        <div className="mt-2.5 space-y-2">
          {hotPicks.map((tip, i) => (
            <Link
              key={tip.id}
              href="/tips"
              className="anim-fade-up press group flex items-center gap-3 rounded-[16px] px-4 py-3 transition-all"
              style={{
                background: 'var(--bg-card)',
                boxShadow: '0 0 0 1px var(--border-ring), 0 2px 8px rgba(0,0,0,0.08)',
                animationDelay: `${200 + i * 70}ms`,
              }}
            >
              {/* Team color accent bar */}
              <div
                className="h-10 w-[3px] shrink-0 rounded-full"
                style={{ background: `linear-gradient(to bottom, ${tip.homeColor}cc, ${tip.homeColor}33)` }}
              />
              <TeamBadge code={tip.homeCode} color={tip.homeColor} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-primary">
                  {tip.home} <span className="text-secondary/40">vs</span> {tip.away}
                </div>
                <div className="text-[11px] text-secondary">{matchTimeLabel(tip.kickoff, lang)}</div>
              </div>
              {tip.locked ? (
                <LockIcon className="h-4 w-4 text-gold" />
              ) : (
                <div className="text-right">
                  <div className="text-base font-extrabold text-gold tabular-nums">
                    {tip.odds.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-secondary">{t("home.odds")}</div>
                </div>
              )}
            </Link>
          ))}
        </div>

        {/* Premium CTA */}
        {!hasPremium && (
          <Link
            href="/plans"
            className="group mt-5 block overflow-hidden rounded-[20px] p-[1px]"
            style={{ background: 'linear-gradient(135deg, #d4a017, #e0b23a, #b8890f)' }}
          >
            <div
              className="anim-shimmer relative overflow-hidden rounded-[19px] px-5 py-4"
              style={{ background: 'linear-gradient(135deg, #d4a017 0%, #c49012 50%, #b8890f 100%)' }}
            >
              <div className="relative flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-extrabold text-navy-900">
                    {t("home.goPremium")} 👑
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-navy-900/70">
                    {t("home.goPremiumDesc")}
                  </div>
                </div>
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: 'rgba(10,14,26,0.2)' }}
                >
                  <span className="text-base font-extrabold text-navy-900">→</span>
                </div>
              </div>
            </div>
          </Link>
        )}

        <p className="mt-8 text-center text-[10px] text-secondary/50">{t("common.poweredBy")}</p>
      </main>
    </PageShell>
  );
}
