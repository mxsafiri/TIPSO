"use client";

import Link from "next/link";
import { useApp } from "./AppProviders";
import ConfidenceBadge from "./ConfidenceBadge";
import { LockIcon } from "./Icons";
import TeamBadge from "./TeamBadge";
import { matchTimeLabel } from "@/lib/format";
import type { TipDto } from "@/lib/dto";

export default function TipCard({ tip }: { tip: TipDto }) {
  const { t, lang } = useApp();
  const prediction = lang === "sw" ? tip.predictionSw : tip.prediction;

  return (
    <div className="rounded-2xl border border-app bg-card p-4">
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
    </div>
  );
}
