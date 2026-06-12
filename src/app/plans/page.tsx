"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/AppProviders";
import Logo from "@/components/Logo";
import { ArrowLeftIcon, CheckIcon } from "@/components/Icons";
import { PLANS } from "@/lib/plans";
import { formatTzs } from "@/lib/format";
import type { PaymentProvider, PlanId } from "@/lib/types";

const PROVIDERS: { id: PaymentProvider | "wallet"; label: string; color: string }[] = [
  { id: "mpesa", label: "M-Pesa", color: "#E60000" },
  { id: "tigopesa", label: "Tigo Pesa", color: "#001F8D" },
  { id: "airtelmoney", label: "Airtel Money", color: "#FF1C1C" },
  { id: "halopesa", label: "HaloPesa", color: "#F47B20" },
];

type Step = "choose" | "pay" | "processing" | "success" | "pendingSettlement";

export default function PlansPage() {
  const { t, lang, user, userLoaded, refreshUser } = useApp();
  const router = useRouter();
  const [planId, setPlanId] = useState<PlanId>("weekly");
  const [step, setStep] = useState<Step>("choose");
  const [provider, setProvider] = useState<PaymentProvider | "wallet">("mpesa");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const plan = PLANS.find((p) => p.id === planId)!;
  const periodKey = plan.period === "day" ? "plans.perDay" : plan.period === "week" ? "plans.perWeek" : "plans.perMonth";
  const walletOk = (user?.walletTzs ?? 0) >= plan.priceTzs;

  async function pay() {
    setError("");
    setStep("processing");
    // Brief delay so the flow mirrors real mobile-money STK-push UX.
    await new Promise((resolve) => setTimeout(resolve, 2200));
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, provider, phone: phone || user?.phone || "" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Payment failed");
        setStep("pay");
        return;
      }
      if (data.pending) {
        // Collection settles via webhook/reconciliation — poll for activation.
        let activated = false;
        for (let i = 0; i < 20; i++) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          const me = await fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json());
          if (me.user?.subscription) {
            activated = true;
            break;
          }
        }
        await refreshUser();
        setStep(activated ? "success" : "pendingSettlement");
        return;
      }
      await refreshUser();
      setStep("success");
    } catch {
      setError("Network error — try again");
      setStep("pay");
    }
  }

  return (
    <div className="min-h-dvh pb-10">
      <header className="flex items-center justify-between px-5 pb-2 pt-5">
        <button
          type="button"
          onClick={() => (step === "pay" ? setStep("choose") : router.back())}
          className="flex h-9 w-9 items-center justify-center rounded-full text-secondary hover:text-primary"
          aria-label={t("common.back")}
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <Logo size={52} />
        <span className="w-9" />
      </header>

      <main className="px-5">
        {step === "choose" && (
          <>
            <h1 className="mt-2 text-xl font-bold">{t("plans.title")}</h1>
            <p className="mt-1 text-sm text-secondary">{t("plans.subtitle")}</p>

            <div className="mt-5 space-y-3.5">
              {PLANS.map((p) => {
                const selected = p.id === planId;
                const pk = p.period === "day" ? "plans.perDay" : p.period === "week" ? "plans.perWeek" : "plans.perMonth";
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlanId(p.id)}
                    className={`relative block w-full rounded-2xl border p-4 text-left transition-colors ${
                      selected ? "border-gold-400 bg-gold-400/5" : "border-app bg-card"
                    }`}
                  >
                    {p.popular && (
                      <span className="absolute -top-2.5 left-4 rounded-md bg-gold-400 px-2 py-0.5 text-[10px] font-extrabold uppercase text-navy-900">
                        {t("plans.mostPopular")}
                      </span>
                    )}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-bold">{lang === "sw" ? p.nameSw : p.name}</div>
                        <div className="mt-1 text-lg font-extrabold">
                          {formatTzs(p.priceTzs)}
                          <span className="text-xs font-medium text-secondary">{t(pk)}</span>
                        </div>
                      </div>
                      <span
                        className={`mt-1 flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                          selected ? "border-gold-400 bg-gold-400" : "border-app"
                        }`}
                      >
                        {selected && <CheckIcon className="h-3.5 w-3.5 text-navy-900" />}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {(lang === "sw" ? p.featuresSw : p.features).map((f) => (
                        <li key={f} className="flex items-center gap-1.5 text-xs text-secondary">
                          <CheckIcon className="h-3.5 w-3.5 text-gold" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            {userLoaded && !user ? (
              <Link
                href="/login?next=/plans"
                className="mt-6 block w-full rounded-xl bg-gold-400 py-3.5 text-center text-sm font-extrabold text-navy-900"
              >
                {t("plans.loginFirst")}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setStep("pay")}
                className="mt-6 w-full rounded-xl bg-gold-400 py-3.5 text-sm font-extrabold text-navy-900 transition-opacity hover:opacity-90"
              >
                {t("plans.continue")}
              </button>
            )}
          </>
        )}

        {step === "pay" && (
          <>
            <h1 className="mt-2 text-xl font-bold">{t("plans.payWith")}</h1>
            <div className="mt-2 rounded-2xl border border-app bg-card px-4 py-3 text-sm">
              <span className="font-bold">{lang === "sw" ? plan.nameSw : plan.name}</span>
              <span className="float-right font-extrabold text-gold">
                {formatTzs(plan.priceTzs)}
                <span className="text-xs font-medium text-secondary">{t(periodKey)}</span>
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  className={`flex items-center gap-2.5 rounded-xl border p-3 text-sm font-semibold transition-colors ${
                    provider === p.id ? "border-gold-400 bg-gold-400/5" : "border-app bg-card"
                  }`}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-extrabold text-white"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.label.slice(0, 1)}
                  </span>
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                disabled={!walletOk}
                onClick={() => setProvider("wallet")}
                className={`col-span-2 flex items-center justify-between rounded-xl border p-3 text-sm font-semibold transition-colors disabled:opacity-40 ${
                  provider === "wallet" ? "border-gold-400 bg-gold-400/5" : "border-app bg-card"
                }`}
              >
                <span>
                  {t("plans.wallet")} — {formatTzs(user?.walletTzs ?? 0)}
                </span>
                {provider === "wallet" && <CheckIcon className="h-4 w-4 text-gold" />}
              </button>
            </div>

            {provider !== "wallet" && (
              <div className="mt-4">
                <label className="text-xs font-semibold text-secondary" htmlFor="phone">
                  {t("plans.phoneNumber")}
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone || user?.phone || ""}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+255 7XX XXX XXX"
                  className="mt-1.5 w-full rounded-xl border border-app bg-card px-4 py-3 text-sm outline-none focus:border-gold-400"
                />
              </div>
            )}

            {error && <p className="mt-3 text-sm font-semibold text-loss">{error}</p>}

            <button
              type="button"
              onClick={() => void pay()}
              className="mt-6 w-full rounded-xl bg-gold-400 py-3.5 text-sm font-extrabold text-navy-900 transition-opacity hover:opacity-90"
            >
              {t("plans.confirmPay")} · {formatTzs(plan.priceTzs)}
            </button>
          </>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center px-4 py-24 text-center">
            <span className="h-12 w-12 animate-spin rounded-full border-4 border-gold-400 border-t-transparent" />
            <h2 className="mt-6 text-lg font-bold">{t("plans.processing")}</h2>
            {provider !== "wallet" && <p className="mt-2 text-sm text-secondary">{t("plans.checkPhone")}</p>}
          </div>
        )}

        {step === "pendingSettlement" && (
          <div className="flex flex-col items-center px-4 py-20 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-400/15 text-3xl">
              ⏳
            </span>
            <h2 className="mt-6 text-xl font-extrabold">{t("plans.pendingTitle")}</h2>
            <p className="mt-2 text-sm text-secondary">{t("plans.pendingDesc")}</p>
            <Link
              href="/"
              className="mt-8 w-full rounded-xl bg-gold-400 py-3.5 text-sm font-extrabold text-navy-900"
            >
              {t("plans.backHome")}
            </Link>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center px-4 py-20 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-win/15">
              <CheckIcon className="h-8 w-8 text-win" />
            </span>
            <h2 className="mt-6 text-xl font-extrabold">{t("plans.success")}</h2>
            <p className="mt-2 text-sm text-secondary">{t("plans.activeNow")}</p>
            <Link
              href="/tips"
              className="mt-8 w-full rounded-xl bg-gold-400 py-3.5 text-sm font-extrabold text-navy-900"
            >
              {t("plans.viewTips")}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
