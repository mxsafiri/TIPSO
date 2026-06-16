"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProviders";
import Header from "@/components/Header";
import PageShell from "@/components/PageShell";
import { CheckIcon, LockIcon, MarketsIcon, SparkIcon } from "@/components/Icons";
import { MARKET_CATEGORIES } from "@/lib/exchange";
import { formatTzs } from "@/lib/format";
import type { Market, MarketStake, MarketView } from "@/lib/types";
import type { GuapMarket } from "@/lib/guap";

type Side = "YES" | "NO";
type PositionView = { stake: MarketStake; market: Market | undefined };

function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MarketsPage() {
  const { t, user, refreshUser } = useApp();

  // Source detection — use GUAP when it's enabled
  const [guapEnabled, setGuapEnabled] = useState(false);
  const [guapMarkets, setGuapMarkets] = useState<GuapMarket[]>([]);
  const [guapCategories, setGuapCategories] = useState<string[]>([]);

  // Betua-native markets (fallback when GUAP not configured)
  const [markets, setMarkets] = useState<MarketView[]>([]);
  const [positions, setPositions] = useState<PositionView[]>([]);
  const [loaded, setLoaded] = useState(false);

  // UI state
  const [creating, setCreating] = useState(false);
  const [stakeFor, setStakeFor] = useState<{ market: MarketView | GuapMarket; side: Side } | null>(null);
  const [resolveFor, setResolveFor] = useState<MarketView | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  const load = useCallback(() => {
    // Always probe GUAP status
    fetch("/api/guap/markets")
      .then((r) => r.json())
      .then((d) => {
        if (d.enabled) {
          setGuapEnabled(true);
          setGuapMarkets(d.markets ?? []);
        } else {
          setGuapEnabled(false);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));

    fetch("/api/guap/categories")
      .then((r) => r.json())
      .then((d) => {
        if (d.categories?.length) setGuapCategories(d.categories);
      })
      .catch(() => undefined);

    // Also load Betua-native as fallback / supplemental
    fetch("/api/markets", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMarkets(d.markets ?? []))
      .catch(() => undefined);

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

  // Categories for the filter chips
  const availableCategories = guapEnabled
    ? ["ALL", ...guapCategories]
    : ["ALL", ...MARKET_CATEGORIES];

  // Markets to render
  const visibleGuap =
    categoryFilter === "ALL"
      ? guapMarkets
      : guapMarkets.filter((m) => m.category === categoryFilter);

  const visibleNative =
    categoryFilter === "ALL"
      ? markets
      : markets.filter((m) => m.category === categoryFilter);

  return (
    <PageShell>
      <Header right="bell" />

      <main className="px-4">
        {/* Header row */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MarketsIcon className="h-5 w-5 text-gold" />
            <h1 className="text-xl font-bold">{t("markets.title")}</h1>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="press anim-shimmer rounded-xl bg-gold-400 px-3.5 py-1.5 text-xs font-extrabold text-navy-900"
          >
            + {t("markets.create")}
          </button>
        </div>
        <p className="mt-1 text-sm text-secondary">
          {guapEnabled ? "Peer-to-peer prediction markets on the GUAP network" : t("markets.subtitle")}
        </p>

        {/* GUAP badge */}
        {guapEnabled && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-gold">
            <SparkIcon className="h-3 w-3" />
            Powered by GUAP · P2P prediction markets
          </div>
        )}

        {/* Category filter chips */}
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {availableCategories.slice(0, 8).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoryFilter(c)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                categoryFilter === c
                  ? "bg-gold-400 text-navy-900"
                  : "border border-app bg-card text-secondary hover:text-primary"
              }`}
            >
              {c === "ALL" ? "All" : c}
            </button>
          ))}
        </div>

        {/* My positions (Betua-native) */}
        {positions.length > 0 && (
          <section className="mt-5">
            <h2 className="text-sm font-bold">{t("markets.myPositions")}</h2>
            <div className="mt-2 space-y-2">
              {positions.map(({ stake, market }) => (
                <div
                  key={stake.id}
                  className="flex items-center gap-3 rounded-[18px] px-4 py-3"
                  style={{
                    background: "var(--bg-card)",
                    boxShadow: "0 0 0 1px var(--border-ring)",
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {market?.question ?? "Market"}
                    </div>
                    <div className="text-xs text-secondary">
                      {stake.side} · {t("markets.youStaked")} {formatTzs(stake.amountTzs)}
                    </div>
                  </div>
                  {stake.settled ? (
                    stake.payoutTzs && stake.payoutTzs > 0 ? (
                      <span className="rounded-lg bg-win/10 px-2 py-1 text-[10px] font-extrabold text-win">
                        +{formatTzs(stake.payoutTzs)}
                      </span>
                    ) : (
                      <span className="rounded-lg bg-loss/10 px-2 py-1 text-[10px] font-extrabold text-loss">
                        {t("markets.posLost")}
                      </span>
                    )
                  ) : (
                    <span className="rounded-lg bg-inset px-2 py-1 text-[10px] font-extrabold text-secondary">
                      {t("markets.posOpen")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* GUAP markets */}
        {guapEnabled && visibleGuap.length > 0 && (
          <div className="mt-5 space-y-3">
            {visibleGuap.map((m, i) => (
              <GuapMarketCard
                key={m.id}
                market={m}
                index={i}
                onStake={(side) => setStakeFor({ market: m, side })}
              />
            ))}
          </div>
        )}

        {/* Betua-native markets */}
        {visibleNative.length > 0 && (
          <div className={`space-y-3 ${guapEnabled && visibleGuap.length > 0 ? "mt-5" : "mt-5"}`}>
            {guapEnabled && visibleGuap.length > 0 && (
              <p className="text-[10px] font-bold uppercase tracking-wide text-secondary">
                Community markets
              </p>
            )}
            {visibleNative.map((m, i) => (
              <NativeMarketCard
                key={m.id}
                market={m}
                isCreator={user?.id === m.creatorId}
                onStake={(side) => setStakeFor({ market: m, side })}
                onResolve={() => setResolveFor(m)}
                index={i}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {loaded && visibleGuap.length === 0 && visibleNative.length === 0 && (
          <p className="py-14 text-center text-sm text-secondary">
            {t("markets.emptyCreate")}
          </p>
        )}

        <p className="mt-6 text-center text-[10px] text-secondary">{t("markets.disclaimer")}</p>
      </main>

      {/* Sheets */}
      {creating && (
        <CreateSheet
          guapEnabled={guapEnabled}
          guapCategories={guapCategories}
          onClose={() => setCreating(false)}
          onDone={() => { setCreating(false); refresh(); }}
        />
      )}
      {stakeFor && (
        <StakeSheet
          market={stakeFor.market}
          side={stakeFor.side}
          guapEnabled={guapEnabled && "title" in stakeFor.market && !("question" in stakeFor.market)}
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

// ---------------------------------------------------------------------------
// GUAP market card
// ---------------------------------------------------------------------------

function GuapMarketCard({
  market,
  index,
  onStake,
}: {
  market: GuapMarket;
  index: number;
  onStake: (side: Side) => void;
}) {
  const isOpen = market.status === "OPEN" || market.status === "unknown";

  return (
    <div
      className="anim-fade-up rounded-[20px] p-4"
      style={{
        animationDelay: `${Math.min(index, 8) * 60}ms`,
        background: "var(--bg-card)",
        boxShadow: "0 0 0 1px var(--border-ring), 0 2px 12px rgba(0,0,0,0.1)",
      }}
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide">
        <div className="flex items-center gap-1.5">
          <SparkIcon className="h-3 w-3 text-gold" />
          <span className="font-semibold text-gold">{market.category}</span>
        </div>
        <span className="text-secondary">
          {market.closesAt ? `Closes ${whenLabel(market.closesAt)}` : market.status}
        </span>
      </div>

      <h2 className="mt-2 text-sm font-bold leading-snug">{market.title}</h2>

      {market.description && (
        <p className="mt-1 line-clamp-2 text-[11px] text-secondary">{market.description}</p>
      )}

      {market.poolTzs !== null && (
        <div className="mt-1 text-[11px] text-secondary">
          Pool: <strong className="text-primary">{formatTzs(market.poolTzs)}</strong>
        </div>
      )}

      {isOpen ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onStake("YES")}
            className="press rounded-xl border border-win/30 bg-win/10 px-3 py-2.5 text-center transition-colors hover:bg-win/20"
          >
            <div className="text-[10px] font-bold uppercase tracking-wide text-win">YES</div>
            <div className="mt-0.5 text-lg font-extrabold text-win">
              {market.yesPercent !== null ? `${market.yesPercent}%` : "—"}
            </div>
          </button>
          <button
            type="button"
            onClick={() => onStake("NO")}
            className="press rounded-xl border border-loss/30 bg-loss/10 px-3 py-2.5 text-center transition-colors hover:bg-loss/20"
          >
            <div className="text-[10px] font-bold uppercase tracking-wide text-loss">NO</div>
            <div className="mt-0.5 text-lg font-extrabold text-loss">
              {market.noPercent !== null ? `${market.noPercent}%` : "—"}
            </div>
          </button>
        </div>
      ) : (
        <div
          className="mt-3 rounded-xl px-3 py-2 text-xs font-semibold text-secondary"
          style={{ background: "var(--bg-inset)" }}
        >
          Resolved
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Betua-native market card (unchanged logic)
// ---------------------------------------------------------------------------

function NativeMarketCard({
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
      className="anim-fade-up rounded-[20px] p-4"
      style={{
        animationDelay: `${Math.min(index, 8) * 60}ms`,
        background: "var(--bg-card)",
        boxShadow: "0 0 0 1px var(--border-ring)",
      }}
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide">
        <span className="font-semibold text-gold">{market.category}</span>
        <span className="text-secondary">
          {open ? `${t("markets.closes")} ${whenLabel(market.closesAt)}` : t("markets.closed")}
        </span>
      </div>

      <h2 className="mt-2 text-sm font-bold leading-snug">{market.question}</h2>
      <div className="mt-1 text-[11px] text-secondary">
        {t("markets.by")} {market.creatorName} · {market.stakerCount}{" "}
        {t("markets.players")} · {t("markets.pool")} {formatTzs(market.totalPoolTzs)}
      </div>

      {open ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onStake("YES")}
            className="press rounded-xl border border-win/30 bg-win/10 px-3 py-2 text-center"
          >
            <div className="text-[10px] font-bold uppercase tracking-wide text-win">
              {t("markets.yes")}
            </div>
            <div className="text-lg font-extrabold text-win">
              {market.yesPercent !== null ? `${market.yesPercent}%` : "—"}
            </div>
          </button>
          <button
            type="button"
            onClick={() => onStake("NO")}
            className="press rounded-xl border border-loss/30 bg-loss/10 px-3 py-2 text-center"
          >
            <div className="text-[10px] font-bold uppercase tracking-wide text-loss">
              {t("markets.no")}
            </div>
            <div className="text-lg font-extrabold text-loss">
              {market.noPercent !== null ? `${market.noPercent}%` : "—"}
            </div>
          </button>
        </div>
      ) : market.status === "resolved" ? (
        <div className="mt-3 rounded-xl bg-inset px-3 py-2 text-xs font-semibold">
          {t("markets.resolved")}:{" "}
          <span className={market.outcome === "YES" ? "text-win" : "text-loss"}>
            {market.outcome}
          </span>
        </div>
      ) : market.status === "void" ? (
        <div className="mt-3 rounded-xl bg-inset px-3 py-2 text-xs font-semibold text-secondary">
          {t("markets.voided")}
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-inset px-3 py-2">
          <span className="text-xs font-semibold text-secondary">{t("markets.awaitingResult")}</span>
          {isCreator && (
            <button
              type="button"
              onClick={onResolve}
              className="rounded-lg bg-gold-400 px-3 py-1.5 text-xs font-bold text-navy-900"
            >
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

// ---------------------------------------------------------------------------
// Sheet wrapper
// ---------------------------------------------------------------------------

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="anim-fade-up max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-app pb-8"
        style={{ background: "var(--bg-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--border)" }} />
          {children}
        </div>
      </div>
    </div>
  );
}

function SuccessSheet({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-win/15">
        <CheckIcon className="h-7 w-7 text-win" />
      </span>
      <p className="mt-4 text-lg font-extrabold">{label}</p>
      {sub && <p className="mt-1 text-sm text-secondary">{sub}</p>}
    </div>
  );
}

function defaultResolveAt(): string {
  const d = new Date(Date.now() + 24 * 3600000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// ---------------------------------------------------------------------------
// Create sheet — GUAP or Betua-native
// ---------------------------------------------------------------------------

function CreateSheet({
  guapEnabled,
  guapCategories,
  onClose,
  onDone,
}: {
  guapEnabled: boolean;
  guapCategories: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, user, refreshUser } = useApp();

  // Common
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");
  const [resolvesAt, setResolvesAt] = useState(defaultResolveAt());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [creationFee, setCreationFee] = useState<number | null>(null);

  // GUAP extras
  const [initialProb, setInitialProb] = useState(50);
  const [pythSymbol, setPythSymbol] = useState("");
  const [pythTargetPrice, setPythTargetPrice] = useState("");
  const [pythOperator, setPythOperator] = useState<"above" | "below">("above");
  const [usePyth, setUsePyth] = useState(false);

  // Betua-native
  const [side, setSide] = useState<Side>("YES");
  const [amount, setAmount] = useState("");

  const categories = guapEnabled
    ? guapCategories
    : MARKET_CATEGORIES;

  const effectiveCategory = category || categories[0] || "";

  async function submitGuap() {
    setError("");
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        title: usePyth ? `Will ${pythSymbol} go ${pythOperator} ${pythTargetPrice}?` : title,
        description,
        category: effectiveCategory,
        resolvesAt: new Date(resolvesAt).toISOString(),
        initialProb,
      };
      if (usePyth) {
        body.pythSymbol = pythSymbol;
        body.pythTargetPrice = Number(pythTargetPrice);
        body.pythOperator = pythOperator;
      }
      const res = await fetch("/api/guap/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Could not create market"); return; }
      setCreationFee(data.creationFee ?? null);
      setDone(true);
      setTimeout(onDone, 1400);
    } catch { setError("Network error — try again"); }
    finally { setBusy(false); }
  }

  async function submitNative() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: title,
          category: effectiveCategory,
          closesAt: new Date(resolvesAt).toISOString(),
          side,
          amountTzs: Number(amount),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Could not create market"); return; }
      await refreshUser();
      setDone(true);
      setTimeout(onDone, 1100);
    } catch { setError("Network error — try again"); }
    finally { setBusy(false); }
  }

  if (done) {
    return (
      <SuccessSheet
        label={guapEnabled ? "Market live on GUAP!" : t("markets.created")}
        sub={creationFee ? `Creation fee: ${formatTzs(creationFee)}` : undefined}
      />
    );
  }

  if (!user) {
    return (
      <div className="py-4">
        <h3 className="text-base font-bold">{t("markets.createTitle")}</h3>
        <Link
          href="/login?next=/markets"
          className="mt-5 block w-full rounded-xl bg-gold-400 py-3.5 text-center text-sm font-extrabold text-navy-900"
        >
          {t("markets.signInToStake")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {guapEnabled && <SparkIcon className="h-4 w-4 text-gold" />}
        <h3 className="text-base font-bold">
          {guapEnabled ? "Create GUAP Market" : t("markets.createTitle")}
        </h3>
      </div>
      {guapEnabled && (
        <p className="mt-0.5 text-[11px] text-secondary">
          Goes live on the full GUAP peer-to-peer network
        </p>
      )}

      {/* Pyth auto-resolve toggle (GUAP only) */}
      {guapEnabled && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-inset px-3.5 py-2.5">
          <div>
            <div className="text-xs font-bold">Pyth Auto-resolve</div>
            <div className="text-[10px] text-secondary">
              Settles automatically from live price data
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUsePyth((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition-colors ${usePyth ? "bg-gold-400" : "bg-inset border border-app"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${usePyth ? "translate-x-5" : "translate-x-0.5"}`}
            />
          </button>
        </div>
      )}

      {/* Pyth fields */}
      {guapEnabled && usePyth ? (
        <>
          <label className="mt-4 block text-xs font-semibold text-secondary">Price Feed Symbol</label>
          <input
            value={pythSymbol}
            onChange={(e) => setPythSymbol(e.target.value.toUpperCase())}
            placeholder="BTC/USD, XAU/USD, ETH/USD…"
            className="mt-1.5 w-full rounded-xl border border-app bg-inset px-3.5 py-2.5 text-sm outline-none focus:border-gold-400"
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-secondary">Target Price</label>
              <input
                type="number"
                value={pythTargetPrice}
                onChange={(e) => setPythTargetPrice(e.target.value)}
                placeholder="e.g. 100000"
                className="mt-1.5 w-full rounded-xl border border-app bg-inset px-3.5 py-2.5 text-sm outline-none focus:border-gold-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-secondary">Direction</label>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {(["above", "below"] as const).map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setPythOperator(op)}
                    className={`rounded-xl border py-2.5 text-xs font-bold capitalize ${
                      pythOperator === op
                        ? "border-gold-400 bg-gold-400/15 text-gold"
                        : "border-app text-secondary"
                    }`}
                  >
                    {op}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="mt-3 block text-xs font-semibold text-secondary">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Additional context for this market…"
            rows={2}
            className="mt-1.5 w-full resize-none rounded-xl border border-app bg-inset px-3.5 py-2.5 text-sm outline-none focus:border-gold-400"
          />
        </>
      ) : (
        <>
          <label className="mt-4 block text-xs font-semibold text-secondary">
            {guapEnabled ? "Market Title" : t("markets.question")}
          </label>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={guapEnabled ? "Will X happen by Friday?" : t("markets.questionPh")}
            rows={2}
            className="mt-1.5 w-full resize-none rounded-xl border border-app bg-inset px-3.5 py-2.5 text-sm outline-none focus:border-gold-400"
          />
          {guapEnabled && (
            <>
              <label className="mt-3 block text-xs font-semibold text-secondary">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="How and when will this market resolve?"
                rows={2}
                className="mt-1.5 w-full resize-none rounded-xl border border-app bg-inset px-3.5 py-2.5 text-sm outline-none focus:border-gold-400"
              />
            </>
          )}
        </>
      )}

      {/* Category */}
      <label className="mt-3 block text-xs font-semibold text-secondary">{t("markets.category")}</label>
      <div className="no-scrollbar mt-1.5 flex gap-2 overflow-x-auto">
        {categories.slice(0, 8).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              effectiveCategory === c
                ? "bg-gold-400 text-navy-900"
                : "border border-app bg-card text-secondary"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Resolve time */}
      <label className="mt-3 block text-xs font-semibold text-secondary">{t("markets.closeTime")}</label>
      <input
        type="datetime-local"
        value={resolvesAt}
        onChange={(e) => setResolvesAt(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-app bg-inset px-3.5 py-2.5 text-sm outline-none focus:border-gold-400"
      />

      {/* Binary starting probability (GUAP only) */}
      {guapEnabled && !usePyth && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-secondary">Starting YES probability</label>
            <span className="font-bold text-gold">{initialProb}%</span>
          </div>
          <input
            type="range"
            min={1}
            max={99}
            value={initialProb}
            onChange={(e) => setInitialProb(Number(e.target.value))}
            className="mt-2 w-full accent-gold-400"
          />
        </div>
      )}

      {/* Betua-native: side + stake */}
      {!guapEnabled && (
        <>
          <label className="mt-3 block text-xs font-semibold text-secondary">{t("markets.yourSide")}</label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSide("YES")}
              className={`rounded-xl border py-2.5 text-sm font-bold ${
                side === "YES" ? "border-win bg-win/15 text-win" : "border-app text-secondary"
              }`}
            >
              {t("markets.yes")}
            </button>
            <button
              type="button"
              onClick={() => setSide("NO")}
              className={`rounded-xl border py-2.5 text-sm font-bold ${
                side === "NO" ? "border-loss bg-loss/15 text-loss" : "border-app text-secondary"
              }`}
            >
              {t("markets.no")}
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <label className="font-semibold text-secondary">{t("markets.openingStake")}</label>
            <span className="text-secondary">
              {t("markets.walletBalance")}:{" "}
              <strong className="text-primary">{formatTzs(user.walletTzs)}</strong>
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
        </>
      )}

      {error && <p className="mt-3 text-sm font-semibold text-loss">{error}</p>}

      <button
        type="button"
        onClick={() => void (guapEnabled ? submitGuap() : submitNative())}
        disabled={
          busy ||
          (!usePyth && (guapEnabled ? title.length < 8 : !amount || title.length < 8)) ||
          (usePyth && (!pythSymbol || !pythTargetPrice))
        }
        className="mt-4 w-full rounded-xl bg-gold-400 py-3.5 text-sm font-extrabold text-navy-900 disabled:opacity-50"
      >
        {busy
          ? t("markets.publishing")
          : guapEnabled
          ? "Create Market on GUAP"
          : t("markets.publish")}
      </button>
      <p className="mb-2 mt-2 text-center text-[10px] text-secondary">
        {guapEnabled
          ? "5% entry fee collected by GUAP at trade time"
          : t("markets.feeNote")}
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Stake sheet
// ---------------------------------------------------------------------------

function StakeSheet({
  market,
  side,
  guapEnabled,
  onClose,
  onDone,
}: {
  market: MarketView | GuapMarket;
  side: Side;
  guapEnabled: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, user, refreshUser } = useApp();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const title = "question" in market ? market.question : market.title;
  const marketId = market.id;

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const endpoint = guapEnabled ? "/api/guap/trade" : "/api/markets/stake";
      const body = guapEnabled
        ? { marketId, side, amountTzs: Number(amount) }
        : { marketId, side, amountTzs: Number(amount) };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Stake failed"); return; }
      await refreshUser();
      setDone(true);
      setTimeout(onDone, 1100);
    } catch { setError("Network error — try again"); }
    finally { setBusy(false); }
  }

  return (
    <Sheet onClose={onClose}>
      {done ? (
        <SuccessSheet label={t("markets.stakeSuccess")} />
      ) : (
        <>
          <div className="text-[10px] uppercase tracking-wide text-secondary">
            {t("markets.stakeOn")}{" "}
            <span className={side === "YES" ? "text-win" : "text-loss"}>{side}</span>
            {guapEnabled && (
              <span className="ml-1.5 text-gold">· GUAP</span>
            )}
          </div>
          <h3 className="mt-1 text-sm font-bold leading-snug">{title}</h3>

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
                  {t("markets.walletBalance")}:{" "}
                  <strong className="text-primary">{formatTzs(user.walletTzs)}</strong>
                </span>
              </div>
              <input
                type="number"
                inputMode="numeric"
                min={100}
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
                  {busy
                    ? t("markets.staking")
                    : `${t("markets.confirmStake")} · ${formatTzs(Number(amount || 0))}`}
                </button>
              )}
              {guapEnabled && (
                <p className="mt-1.5 text-center text-[10px] text-secondary">
                  5% entry fee deducted by GUAP
                </p>
              )}
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Resolve sheet (Betua-native only)
// ---------------------------------------------------------------------------

function ResolveSheet({
  market,
  onClose,
  onDone,
}: {
  market: MarketView;
  onClose: () => void;
  onDone: () => void;
}) {
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
      if (!res.ok) { setError(data.error ?? "Resolve failed"); return; }
      onDone();
    } catch { setError("Network error — try again"); }
    finally { setBusy(false); }
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
