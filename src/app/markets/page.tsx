"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProviders";
import Header from "@/components/Header";
import PageShell from "@/components/PageShell";
import { CheckIcon, MarketsIcon } from "@/components/Icons";
import { formatTzs, fullDate } from "@/lib/format";
import type { GuapMarket, GuapPosition } from "@/lib/guap";

type Side = "YES" | "NO";

export default function MarketsPage() {
  const { t, lang, user, refreshUser } = useApp();
  const [markets, setMarkets] = useState<GuapMarket[]>([]);
  const [positions, setPositions] = useState<GuapPosition[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sheet, setSheet] = useState<{ market: GuapMarket; side: Side } | null>(null);

  const loadPositions = useCallback(() => {
    if (!user) {
      setPositions([]);
      return;
    }
    fetch("/api/markets/positions", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setPositions(d.positions ?? []))
      .catch(() => undefined);
  }, [user]);

  useEffect(() => {
    fetch("/api/guap/markets", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMarkets(d.markets ?? []))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  return (
    <PageShell>
      <Header right="bell" />

      <main className="px-5">
        <div className="mt-2 flex items-center gap-2">
          <MarketsIcon className="h-5 w-5 text-gold" />
          <h1 className="text-xl font-bold">{t("markets.title")}</h1>
        </div>
        <p className="mt-1 text-sm text-secondary">{t("markets.subtitle")}</p>

        {positions.length > 0 && (
          <section className="mt-5">
            <h2 className="text-sm font-bold">{t("markets.myPositions")}</h2>
            <div className="mt-2 space-y-2">
              {positions.map((p) => (
                <PositionRow key={`${p.marketId}_${p.side}`} position={p} onRedeemed={() => { loadPositions(); void refreshUser(); }} />
              ))}
            </div>
          </section>
        )}

        <div className="mt-5 space-y-3">
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

              <div className="mt-2 text-[10px] uppercase tracking-wide text-secondary">
                {t("markets.crowdLabel")}
              </div>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSheet({ market: m, side: "YES" })}
                  className="press rounded-xl border border-win/30 bg-win/10 px-3 py-2 text-center transition-colors hover:bg-win/20"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wide text-win">{t("markets.yes")}</div>
                  <div className="text-lg font-extrabold text-win">
                    {m.yesPercent !== null ? `${m.yesPercent}%` : "—"}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSheet({ market: m, side: "NO" })}
                  className="press rounded-xl border border-loss/30 bg-loss/10 px-3 py-2 text-center transition-colors hover:bg-loss/20"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wide text-loss">{t("markets.no")}</div>
                  <div className="text-lg font-extrabold text-loss">
                    {m.noPercent !== null ? `${m.noPercent}%` : "—"}
                  </div>
                </button>
              </div>

              {m.poolTzs !== null && (
                <div className="mt-2.5 text-xs text-secondary">
                  {t("markets.pool")}: <strong className="text-primary">{formatTzs(m.poolTzs)}</strong>
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-[10px] text-secondary">{t("markets.disclaimer")}</p>
      </main>

      {sheet && (
        <StakeSheet
          market={sheet.market}
          side={sheet.side}
          onClose={() => setSheet(null)}
          onDone={() => { setSheet(null); loadPositions(); void refreshUser(); }}
        />
      )}
    </PageShell>
  );
}

function PositionRow({ position, onRedeemed }: { position: GuapPosition; onRedeemed: () => void }) {
  const { t } = useApp();
  const [busy, setBusy] = useState(false);

  async function redeem() {
    setBusy(true);
    try {
      const res = await fetch("/api/markets/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: position.marketId }),
      });
      if (res.ok) onRedeemed();
    } finally {
      setBusy(false);
    }
  }

  const tone =
    position.status === "won"
      ? "bg-win/10 text-win"
      : position.status === "lost"
        ? "bg-loss/10 text-loss"
        : "bg-inset text-secondary";
  const label =
    position.status === "won" ? t("markets.posWon") : position.status === "lost" ? t("markets.posLost") : t("markets.posOpen");

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-app bg-card px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{position.marketTitle}</div>
        <div className="text-xs text-secondary">
          {position.side} · {position.stakeTzs !== null ? formatTzs(position.stakeTzs) : "—"}
        </div>
      </div>
      {position.redeemable ? (
        <button
          type="button"
          onClick={() => void redeem()}
          disabled={busy}
          className="rounded-lg bg-gold-400 px-3 py-2 text-xs font-bold text-navy-900 disabled:opacity-50"
        >
          {t("markets.redeem")}
          {position.payoutTzs ? ` ${formatTzs(position.payoutTzs)}` : ""}
        </button>
      ) : (
        <span className={`rounded-md px-2 py-1 text-[10px] font-extrabold ${tone}`}>{label}</span>
      )}
    </div>
  );
}

function StakeSheet({
  market,
  side,
  onClose,
  onDone,
}: {
  market: GuapMarket;
  side: Side;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, user } = useApp();
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
      setDone(true);
      setTimeout(onDone, 1100);
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="anim-fade-up w-full max-w-md rounded-t-3xl border-t border-app bg-card p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="flex flex-col items-center py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-win/15">
              <CheckIcon className="h-7 w-7 text-win" />
            </span>
            <p className="mt-4 text-lg font-extrabold">{t("markets.stakeSuccess")}</p>
          </div>
        ) : (
          <>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border)]" />
            <div className="text-[10px] uppercase tracking-wide text-secondary">
              {t("markets.stakeOn")}{" "}
              <span className={side === "YES" ? "text-win" : "text-loss"}>{t(side === "YES" ? "markets.yes" : "markets.no")}</span>
            </div>
            <h3 className="mt-1 text-sm font-bold leading-snug">{market.title}</h3>

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
                  <label htmlFor="stake" className="font-semibold text-secondary">
                    {t("markets.stakeAmount")}
                  </label>
                  <span className="text-secondary">
                    {t("markets.walletBalance")}: <strong className="text-primary">{formatTzs(user.walletTzs)}</strong>
                  </span>
                </div>
                <input
                  id="stake"
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
                  <Link
                    href="/account"
                    className="mt-4 block w-full rounded-xl border border-gold-400 py-3.5 text-center text-sm font-bold text-gold"
                  >
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
      </div>
    </div>
  );
}
