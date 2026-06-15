"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "./AppProviders";
import ConfidenceBadge from "./ConfidenceBadge";
import { ChevronRightIcon, LockIcon, SparkIcon } from "./Icons";
import TeamBadge from "./TeamBadge";
import { matchTimeLabel } from "@/lib/format";
import type { TipDto } from "@/lib/dto";

export default function TipCard({ tip, index = 0 }: { tip: TipDto; index?: number }) {
  const { t, lang } = useApp();
  const [open, setOpen] = useState(false);
  const prediction = lang === "sw" ? tip.predictionSw : tip.prediction;
  const analysis = lang === "sw" ? tip.analysisSw : tip.analysis;
  const factors = (lang === "sw" ? tip.keyFactorsSw : tip.keyFactors) ?? [];
  const hasIntelligence = !tip.locked && tip.aiGenerated && Boolean(analysis);

  return (
    <div
      className="anim-fade-up relative overflow-hidden rounded-[20px]"
      style={{
        animationDelay: `${Math.min(index, 8) * 70}ms`,
        background: 'var(--bg-card)',
        boxShadow: `0 0 0 1px var(--border-ring), 0 2px 16px rgba(0,0,0,0.12), inset 3px 0 0 0 ${tip.homeColor}bb`,
      }}
    >
      {/* Faint home-team color wash on the left */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-24"
        style={{ background: `linear-gradient(to right, ${tip.homeColor}0d, transparent)` }}
      />

      <div className="relative pl-4">
        {/* League + time */}
        <div className="flex items-center justify-between pr-4 pt-3.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold">
            {tip.league}
          </span>
          <span className="text-[11px] text-secondary">
            {matchTimeLabel(tip.kickoff, lang)}
          </span>
        </div>

        {/* Teams */}
        <div className="flex items-center gap-2 py-3.5 pr-4">
          <div className="flex flex-1 flex-col items-center gap-1.5">
            <TeamBadge code={tip.homeCode} color={tip.homeColor} />
            <span className="text-center text-xs font-semibold leading-tight text-primary">
              {tip.home}
            </span>
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-secondary/35">
            vs
          </span>
          <div className="flex flex-1 flex-col items-center gap-1.5">
            <TeamBadge code={tip.awayCode} color={tip.awayColor} />
            <span className="text-center text-xs font-semibold leading-tight text-primary">
              {tip.away}
            </span>
          </div>
        </div>

        {/* Prediction / lock strip */}
        <div className="relative mr-4 mb-3 overflow-hidden rounded-[14px]">
          {/* Confidence fill bar */}
          {!tip.locked && (
            <div
              className="fill-animate absolute inset-y-0 left-0 rounded-[14px] bg-gradient-to-r from-gold-500/[0.11] to-transparent"
              style={{ width: `${tip.confidence}%` }}
            />
          )}
          {/* Strip border */}
          <div
            className="absolute inset-0 rounded-[14px]"
            style={{ boxShadow: 'inset 0 0 0 1px var(--border-subtle)' }}
          />

          {tip.locked ? (
            <div
              className="relative flex items-center justify-between px-3.5 py-2.5"
              style={{ background: 'var(--bg-inset)' }}
            >
              <div className="flex items-center gap-2">
                <LockIcon className="h-3.5 w-3.5 shrink-0 text-gold" />
                <div>
                  <div className="text-[9px] uppercase tracking-[0.14em] text-secondary/55">
                    {t("tips.premiumLocked")}
                  </div>
                  <div className="select-none text-sm font-bold text-primary blur-[5px]">
                    Hidden Pick
                  </div>
                </div>
              </div>
              <Link
                href="/plans"
                className="rounded-[10px] bg-gold-400 px-3 py-1.5 text-xs font-bold text-navy-900 transition-opacity hover:opacity-90 active:scale-95"
              >
                {t("tips.unlock")}
              </Link>
            </div>
          ) : (
            <div
              className="relative flex items-center justify-between gap-3 px-3.5 py-2.5"
              style={{ background: 'var(--strip-bg)' }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[9px] uppercase tracking-[0.14em] text-secondary/55">
                  {t("home.tip")}
                </div>
                <div className="mt-0.5 truncate text-sm font-bold text-primary">
                  {prediction}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-secondary/55">
                    {t("home.odds")}
                  </div>
                  <div className="mt-0.5 text-base font-extrabold text-gold tabular-nums">
                    {tip.odds.toFixed(2)}
                  </div>
                </div>
                <ConfidenceBadge value={tip.confidence} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Intelligence panel */}
      {hasIntelligence && (
        <div className="relative px-4 pb-3 pl-8">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left"
          >
            <SparkIcon className="h-4 w-4 text-gold" />
            <span className="text-xs font-semibold text-gold">{t("tips.whyThisPick")}</span>
            <span className="rounded bg-gold-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gold">
              {t("tips.aiPowered")}
            </span>
            <ChevronRightIcon
              className={`ml-auto h-4 w-4 text-secondary transition-transform ${open ? "rotate-90" : ""}`}
            />
          </button>

          {open && (
            <div className="anim-fade-up mt-1 rounded-xl border border-gold-500/20 bg-inset p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-secondary">
                <SparkIcon className="h-3 w-3 text-gold" />
                {t("tips.intelligence")}
              </div>
              <p className="text-xs leading-relaxed text-primary">{analysis}</p>
              {factors.length > 0 && (
                <ul className="mt-2.5 space-y-1">
                  {factors.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-secondary">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-gold-400" />
                      {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
