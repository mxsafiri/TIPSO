"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProviders";
import Header from "@/components/Header";
import PageShell from "@/components/PageShell";
import { CheckIcon, MarketsIcon } from "@/components/Icons";
import { MARKET_CATEGORIES } from "@/lib/exchange";
import { formatTzs } from "@/lib/format";
import type { Market, MarketStake, MarketView } from "@/lib/types";

type Side = "YES" | "NO";
type PositionView = { stake: MarketStake; market: Market | undefined };

function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function MarketsPage() {
  const { t, user, refreshUser } = useApp();
  const [markets, setMarkets] = useState<MarketView[]>([]);
  const [positions, setPositions] = useState<PositionView[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [stakeFor, setStakeFor] = useState<{ market: MarketView; side: Side } | null>(null);
  const [resolveFor, setResolveFor] = useState<MarketView | null>(null);

  const load = useCallback(() => {
    fetch("/api/markets", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMarkets(d.markets ?? []))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
    if (user) {
      fetch("/api/markets/positions", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setPositions(d.positions ?? []))
        .catch(() => undefined);
    } else {
      setPositions([]);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    load();
    void refreshUser();
  };

  return (
    <PageShell>
      <Header right="bell" />

      <main className="px-5">
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MarketsIcon className="h-5 w-5 text-gold" />
            <h1 className="text-xl font-bold">{t("markets.title")}</h1>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="press rounded-lg bg-gold-400 px-3 py-1.5 text-xs font-bold text-navy-900"
          >
            + {t("markets.create")}
          </button>
        </div>
        <p className="mt-1 text-sm text-secondary">{t("markets.subtitle")}</p>

        {positions.length > 0 && (
          <section className="mt-5">
            <h2 className="text-sm font-bold">{t("markets.myPositions")}</h2>
            <div className="mt-2 space-y-2">
              {positions.map(({ stake, market }) => (
                <div key={stake.id} className="flex items-center gap-3 rounded-2xl border border-app bg-card px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{market?.question ?? "Market"}</div>
                    <div className="text-xs text-secondary">
                      {stake.side} · {t("markets.youStaked")} {formatTzs(stake.amountTzs)}
                    </div>
                  </div>
                  {stake.settled ? (
                    stake.payoutTzs && stake.payoutTzs > 0 ? (
                      <span className="rounded-md bg-win/10 px-2 py-1 text-[10px] font-extrabold text-win">
                        +{formatTzs(stake.payoutTzs)}
                      </span>
                    ) : (
                      <span className="rounded-md bg-loss/10 px-2 py-1 text-[10px] font-extrabold text-loss">
                        {t("markets.posLost")}
                      </span>
                    )
                  ) : (
                    <span className="rounded-md bg-inset px-2 py-1 text-[10px] font-extrabold text-secondary">
                      {t("markets.posOpen")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-5 space-y-3">
          {loaded && markets.length === 0 && (
            <p className="py-14 text-center text-sm text-secondary">{t("markets.emptyCreate")}</p>
          )}
          {markets.map((m, i) => (
            <MarketCard
              key={m.id}
              market={m}
              isCreator={user?.id === m.creatorId}
              onStake={(side) => setStakeFor({ market: m, side })}
              onResolve={() => setResolveFor(m)}
              index={i}
            />
          ))}
        </div>

        <p className="mt-6 text-center text-[10px] text-secondary">{t("markets.disclaimer")}</p>
      </main>

      {creating && <CreateSheet onClose={() => setCreating(false)} onDone={() => { setCreating(false); refresh(); }} />}
      {stakeFor && (
        <StakeSheet
          market={stakeFor.market}
          side={stakeFor.side}
          onClose={() => setStakeFor(null)}
          onDone={() => { setStakeFor(null); refresh(); }}
        />
      )}
      {resolveFor && (
        <ResolveSheet
          market={resolveFor}
          onClose={() => setResolveFor(null)}
          onDone={() => { setResolveFor(null); refresh(); }}
        />
      )}
    </PageShell>
  );
}

function MarketCard({
  market,
  isCreator,
  onStake,
  onResolve,
  index,
}: {
  market: MarketView;
  isCreator: boolean;
  onStake: (side: Side) => void;
  onResolve: () => void;
  index: number;
}) {
  const { t } = useApp();
  const now = Date.now();
  const open = market.status === "open" && new Date(market.closesAt).getTime() > now;
  const closedUnresolved = market.status === "open" && new Date(market.closesAt).getTime() <= now;

  return (
    <div
      className="anim-fade-up rounded-2xl border border-app bg-card p-4"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide">
        <span className="font-semibold text-gold">{market.category}</span>
        <span className="text-secondary">
          {open ? `${t("markets.closes")} ${whenLabel(market.closesAt)}` : t("markets.closed")}
        </span>
      </div>

      <h2 className="mt-2 text-sm font-bold leading-snug">{market.question}</h2>
      <div className="mt-1 text-[11px] text-secondary">
        {t("markets.by")} {market.creatorName} · {market.stakerCount} {t("markets.players")} · {t("markets.pool")} {formatTzs(market.totalPoolTzs)}
      </div>

      {open ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onStake("YES")}
            className="press rounded-xl border border-win/30 bg-win/10 px-3 py-2 text-center transition-colors hover:bg-win/20"
          >
            <div className="text-[10px] font-bold uppercase tracking-wide text-win">{t("markets.yes")}</div>
            <div className="text-lg font-extrabold text-win">{market.yesPercent !== null ? `${market.yesPercent}%` : "—"}</div>
          </button>
          <button
            type="button"
            onClick={() => onStake("NO")}
            className="press rounded-xl border border-loss/30 bg-loss/10 px-3 py-2 text-center transition-colors hover:bg-loss/20"
          >
            <div className="text-[10px] font-bold uppercase tracking-wide text-loss">{t("markets.no")}</div>
            <div className="text-lg font-extrabold text-loss">{market.noPercent !== null ? `${market.noPercent}%` : "—"}</div>
          </button>
        </div>
      ) : market.status === "resolved" ? (
        <div className="mt-3 rounded-xl bg-inset px-3 py-2 text-xs font-semibold">
          {t("markets.resolved")}:{" "}
          <span className={market.outcome === "YES" ? "text-win" : "text-loss"}>{market.outcome}</span>
        </div>
      ) : market.status === "void" ? (
        <div className="mt-3 rounded-xl bg-inset px-3 py-2 text-xs font-semibold text-secondary">{t("markets.voided")}</div>
      ) : (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-inset px-3 py-2">
          <span className="text-xs font-semibold text-secondary">{t("markets.awaitingResult")}</span>
          {isCreator && (
            <button type="button" onClick={onResolve} className="rounded-lg bg-gold-400 px-3 py-1.5 text-xs font-bold text-navy-900">
              {t("markets.resolve")}
            </button>
          )}
        </div>
      )}
      {closedUnresolved && !isCreator && (
        <p className="mt-1.5 text-[10px] text-secondary">{t("markets.awaitingResult")}…</p>
      )}
    </div>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="anim-fade-up max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-app bg-card p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border)]" />
        {children}
      </div>
    </div>
  );
}

function SuccessSheet({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-win/15">
        <CheckIcon className="h-7 w-7 text-win" />
      </span>
      <p className="mt-4 text-lg font-extrabold">{label}</p>
    </div>
  );
}

function defaultClose(): string {
  const d = new Date(Date.now() + 24 * 3600000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function CreateSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t, user, refreshUser } = useApp();
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<string>(MARKET_CATEGORIES[0]);
  const [closesAt, setClosesAt] = useState(defaultClose());
  const [side, setSide] = useState<Side>("YES");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          category,
          closesAt: new Date(closesAt).toISOString(),
          side,
          amountTzs: Number(amount),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create market");
        return;
      }
      await refreshUser();
      setDone(true);
      setTimeout(onDone, 1100);
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={onClose}>
      {done ? (
        <SuccessSheet label={t("markets.created")} />
      ) : !user ? (
        <div className="py-4">
          <h3 className="text-base font-bold">{t("markets.createTitle")}</h3>
          <Link
            href="/login?next=/markets"
            className="mt-5 block w-full rounded-xl bg-gold-400 py-3.5 text-center text-sm font-extrabold text-navy-900"
          >
            {t("markets.signInToStake")}
          </Link>
        </div>
      ) : (
        <>
          <h3 className="text-base font-bold">{t("markets.createTitle")}</h3>

          <label className="mt-4 block text-xs font-semibold text-secondary">{t("markets.question")}</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t("markets.questionPh")}
            rows={2}
            className="mt-1.5 w-full resize-none rounded-xl border border-app bg-inset px-3.5 py-2.5 text-sm outline-none focus:border-gold-400"
          />

          <label className="mt-3 block text-xs font-semibold text-secondary">{t("markets.category")}</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {MARKET_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${category === c ? "bg-gold-400 text-navy-900" : "border border-app bg-card text-secondary"}`}
              >
                {c}
              </button>
            ))}
          </div>

          <label className="mt-3 block text-xs font-semibold text-secondary">{t("markets.closeTime")}</label>
          <input
            type="datetime-local"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-app bg-inset px-3.5 py-2.5 text-sm outline-none focus:border-gold-400"
          />

          <label className="mt-3 block text-xs font-semibold text-secondary">{t("markets.yourSide")}</label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSide("YES")}
              className={`rounded-xl border py-2.5 text-sm font-bold ${side === "YES" ? "border-win bg-win/15 text-win" : "border-app text-secondary"}`}
            >
              {t("markets.yes")}
            </button>
            <button
              type="button"
              onClick={() => setSide("NO")}
              className={`rounded-xl border py-2.5 text-sm font-bold ${side === "NO" ? "border-loss bg-loss/15 text-loss" : "border-app text-secondary"}`}
            >
              {t("markets.no")}
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs">
            <label className="font-semibold text-secondary">{t("markets.openingStake")}</label>
            <span className="text-secondary">
              {t("markets.walletBalance")}: <strong className="text-primary">{formatTzs(user.walletTzs)}</strong>
            </span>
          </div>
          <input
            type="number"
            inputMode="numeric"
            min={500}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="mt-1.5 w-full rounded-xl border border-app bg-inset px-4 py-3 text-lg font-bold outline-none focus:border-gold-400"
          />

          {error && <p className="mt-3 text-sm font-semibold text-loss">{error}</p>}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !amount || question.length < 8}
            className="mt-4 w-full rounded-xl bg-gold-400 py-3.5 text-sm font-extrabold text-navy-900 disabled:opacity-50"
          >
            {busy ? t("markets.publishing") : t("markets.publish")}
          </button>
          <p className="mt-2 text-center text-[10px] text-secondary">{t("markets.feeNote")}</p>
        </>
      )}
    </Sheet>
  );
}

function StakeSheet({
  market,
  side,
  onClose,
  onDone,
}: {
  market: MarketView;
  side: Side;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, user, refreshUser } = useApp();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/markets/stake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: market.id, side, amountTzs: Number(amount) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Stake failed");
        return;
      }
      await refreshUser();
      setDone(true);
      setTimeout(onDone, 1100);
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={onClose}>
      {done ? (
        <SuccessSheet label={t("markets.stakeSuccess")} />
      ) : (
        <>
          <div className="text-[10px] uppercase tracking-wide text-secondary">
            {t("markets.stakeOn")} <span className={side === "YES" ? "text-win" : "text-loss"}>{side}</span>
          </div>
          <h3 className="mt-1 text-sm font-bold leading-snug">{market.question}</h3>

          {!user ? (
            <Link
              href="/login?next=/markets"
              className="mt-5 block w-full rounded-xl bg-gold-400 py-3.5 text-center text-sm font-extrabold text-navy-900"
            >
              {t("markets.signInToStake")}
            </Link>
          ) : (
            <>
              <div className="mt-4 flex items-center justify-between text-xs">
                <label className="font-semibold text-secondary">{t("markets.stakeAmount")}</label>
                <span className="text-secondary">
                  {t("markets.walletBalance")}: <strong className="text-primary">{formatTzs(user.walletTzs)}</strong>
                </span>
              </div>
              <input
                type="number"
                inputMode="numeric"
                min={500}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="mt-1.5 w-full rounded-xl border border-app bg-inset px-4 py-3 text-lg font-bold outline-none focus:border-gold-400"
              />
              <div className="mt-2 flex gap-2">
                {[1000, 5000, 10000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmount(String(v))}
                    className="flex-1 rounded-lg border border-app bg-card py-1.5 text-xs font-semibold text-secondary"
                  >
                    {v.toLocaleString()}
                  </button>
                ))}
              </div>

              {error && <p className="mt-3 text-sm font-semibold text-loss">{error}</p>}

              {user.walletTzs < Number(amount || 0) ? (
                <Link href="/account" className="mt-4 block w-full rounded-xl border border-gold-400 py-3.5 text-center text-sm font-bold text-gold">
                  {t("markets.topUp")}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={busy || !amount}
                  className="mt-4 w-full rounded-xl bg-gold-400 py-3.5 text-sm font-extrabold text-navy-900 disabled:opacity-50"
                >
                  {busy ? t("markets.staking") : `${t("markets.confirmStake")} · ${formatTzs(Number(amount || 0))}`}
                </button>
              )}
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

function ResolveSheet({ market, onClose, onDone }: { market: MarketView; onClose: () => void; onDone: () => void }) {
  const { t } = useApp();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function resolve(outcome: Side) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/markets/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: market.id, outcome }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Resolve failed");
        return;
      }
      onDone();
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={onClose}>
      <h3 className="text-sm font-bold leading-snug">{market.question}</h3>
      <p className="mt-1 text-xs text-secondary">{t("markets.resolveAs")}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void resolve("YES")}
          className="rounded-xl border border-win bg-win/15 py-4 text-base font-extrabold text-win disabled:opacity-50"
        >
          {t("markets.yes")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void resolve("NO")}
          className="rounded-xl border border-loss bg-loss/15 py-4 text-base font-extrabold text-loss disabled:opacity-50"
        >
          {t("markets.no")}
        </button>
      </div>
      {error && <p className="mt-3 text-sm font-semibold text-loss">{error}</p>}
    </Sheet>
  );
}
