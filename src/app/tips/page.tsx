"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProviders";
import Header from "@/components/Header";
import PageShell from "@/components/PageShell";
import TipCard from "@/components/TipCard";
import { dateChipLabel, isSameDay } from "@/lib/format";
import type { TipDto } from "@/lib/dto";
import type { Sport } from "@/lib/types";

const SPORTS: { id: Sport | "all"; key: "tips.all" | "tips.football" | "tips.basketball" | "tips.tennis" }[] = [
  { id: "all", key: "tips.all" },
  { id: "football", key: "tips.football" },
  { id: "basketball", key: "tips.basketball" },
  { id: "tennis", key: "tips.tennis" },
];

export default function TipsPage() {
  const { t, lang } = useApp();
  const [tips, setTips] = useState<TipDto[]>([]);
  const [sport, setSport] = useState<Sport | "all">("all");
  const [dayOffset, setDayOffset] = useState(0);

  useEffect(() => {
    fetch("/api/tips")
      .then((r) => r.json())
      .then((d) => setTips(d.tips ?? []))
      .catch(() => undefined);
  }, []);

  const days = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const visible = useMemo(() => {
    const day = days[dayOffset];
    return tips.filter((tip) => {
      if (tip.live) return false;
      if (sport !== "all" && tip.sport !== sport) return false;
      return isSameDay(new Date(tip.kickoff), day);
    });
  }, [tips, sport, dayOffset, days]);

  const grouped = useMemo(() => {
    const map = new Map<string, TipDto[]>();
    for (const tip of visible) {
      const list = map.get(tip.league) ?? [];
      list.push(tip);
      map.set(tip.league, list);
    }
    return [...map.entries()];
  }, [visible]);

  return (
    <PageShell>
      <Header right="bell" />

      <main className="px-5">
        <h1 className="mt-2 text-xl font-bold">{t("tips.title")}</h1>

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {SPORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSport(s.id)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                sport === s.id
                  ? "bg-gold-400 text-navy-900"
                  : "border border-app bg-card text-secondary hover:text-primary"
              }`}
            >
              {t(s.key)}
            </button>
          ))}
        </div>

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {days.map((d, i) => {
            const { top, bottom } = dateChipLabel(d, lang);
            const active = i === dayOffset;
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => setDayOffset(i)}
                className={`flex shrink-0 flex-col items-center rounded-xl border px-3.5 py-2 text-xs transition-colors ${
                  active
                    ? "border-gold-400 bg-gold-400/10 text-gold"
                    : "border-app bg-card text-secondary hover:text-primary"
                }`}
              >
                <span className="font-bold">{top}</span>
                <span className="text-[10px]">{bottom}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-5">
          {grouped.length === 0 && (
            <p className="py-16 text-center text-sm text-secondary">{t("tips.empty")}</p>
          )}
          {grouped.map(([league, leagueTips]) => (
            <section key={league} className="space-y-2.5">
              {leagueTips.map((tip) => (
                <TipCard key={tip.id} tip={tip} />
              ))}
            </section>
          ))}
        </div>
      </main>
    </PageShell>
  );
}
