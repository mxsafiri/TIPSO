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
      className="anim-fade-up press rounded-2xl border border-app bg-card p-4"
      style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wide text-gold">{tip.league}</span>
        <span className="text-secondary">{matchTimeLabel(tip.kickoff, lang)}</span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex flex-1 flex-col items-center gap-2">
          <TeamBadge code={tip.homeCode} color={tip.homeColor} />
          <span className="text-center text-sm font-semibold leading-tight">{tip.home}</span>
        </div>
        <span className="text-xs font-bold text-secondary">VS</span>
        <div className="flex flex-1 flex-col items-center gap-2">
          <TeamBadge code={tip.awayCode} color={tip.awayColor} />
          <span className="text-center text-sm font-semibold leading-tight">{tip.away}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-inset px-3 py-2.5">
        {tip.locked ? (
          <>
            <div className="flex items-center gap-2 text-secondary">
              <LockIcon className="h-4 w-4 text-gold" />
              <div>
                <div className="text-[10px] uppercase tracking-wide">{t("tips.premiumLocked")}</div>
                <div className="select-none text-sm font-bold blur-sm">Hidden Pick</div>
              </div>
            </div>
            <Link
              href="/plans"
              className="rounded-lg bg-gold-400 px-3.5 py-2 text-xs font-bold text-navy-900 transition-opacity hover:opacity-90"
            >
              {t("tips.unlock")}
            </Link>
          </>
        ) : (
          <>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-secondary">{t("home.tip")}</div>
              <div className="truncate text-sm font-bold">{prediction}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-secondary">{t("home.odds")}</div>
                <div className="text-sm font-bold text-gold">{tip.odds.toFixed(2)}</div>
              </div>
              <ConfidenceBadge value={tip.confidence} />
            </div>
          </>
        )}
      </div>

      {hasIntelligence && (
        <div className="mt-2.5">
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
