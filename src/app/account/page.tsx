"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProviders";
import Header from "@/components/Header";
import PageShell from "@/components/PageShell";
import {
  ChevronRightIcon,
  CrownIcon,
  GiftIcon,
  GlobeIcon,
  HistoryIcon,
  LogoutIcon,
  MoonIcon,
  SunIcon,
  SupportIcon,
  WalletIcon,
} from "@/components/Icons";
import { formatTzs, fullDate } from "@/lib/format";
import type { PlatformStats, Transaction } from "@/lib/types";

export default function AccountPage() {
  const { t, lang, setLang, theme, setTheme, user, userLoaded, refreshUser } = useApp();
  const router = useRouter();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setStats(d.stats ?? null))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (showHistory && user) {
      fetch("/api/transactions")
        .then((r) => r.json())
        .then((d) => setTransactions(d.transactions ?? []))
        .catch(() => undefined);
    }
  }, [showHistory, user]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await refreshUser();
    router.push("/");
  }

  const initials = user?.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <PageShell>
      <Header right="settings" />

      <main className="px-5">
        {userLoaded && !user && (
          <div className="mt-8 rounded-2xl border border-app bg-card p-6 text-center">
            <h1 className="text-lg font-bold">{t("account.signIn")}</h1>
            <p className="mt-1 text-sm text-secondary">{t("account.signInDesc")}</p>
            <Link
              href="/login"
              className="mt-5 block w-full rounded-xl bg-gold-400 py-3 text-sm font-extrabold text-navy-900"
            >
              {t("account.signIn")}
            </Link>
          </div>
        )}

        {user && (
          <>
            <div className="mt-3 flex items-center gap-3.5">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-lg font-extrabold text-navy-900">
                {initials}
              </div>
              <div>
                <h1 className="text-lg font-bold">{user.name}</h1>
                <p className="flex items-center gap-1 text-xs text-secondary">
                  {user.subscription ? t("account.premiumMember") : t("account.freeMember")}
                  {user.subscription && <CrownIcon className="h-3.5 w-3.5 text-gold" />}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-app bg-card p-4">
              <div className="text-[10px] uppercase tracking-wide text-secondary">{t("account.currentPlan")}</div>
              {user.subscription ? (
                <div className="mt-1 flex items-end justify-between">
                  <div>
                    <div className="text-base font-bold">{user.subscription.planName}</div>
                    <div className="mt-0.5 text-xs text-secondary">
                      {t("account.validUntil")} {fullDate(user.subscription.expiresAt, lang)}
                    </div>
                  </div>
                  <Link
                    href="/plans"
                    className="rounded-lg bg-inset px-3 py-2 text-xs font-bold text-gold"
                  >
                    {t("account.viewDetails")}
                  </Link>
                </div>
              ) : (
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-sm font-semibold text-secondary">{t("account.noPlan")}</div>
                  <Link href="/plans" className="rounded-lg bg-gold-400 px-3 py-2 text-xs font-bold text-navy-900">
                    {t("account.choosePlan")}
                  </Link>
                </div>
              )}
            </div>

            {stats && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-secondary">{t("account.tipsterPerformance")}</div>
                <div className="mt-2 grid grid-cols-3 overflow-hidden rounded-2xl border border-app bg-card">
                  <div className="border-r border-app p-3.5 text-center">
                    <div className="text-lg font-extrabold">{stats.settledTips}</div>
                    <div className="text-[10px] text-secondary">{t("account.tips")}</div>
                  </div>
                  <div className="border-r border-app p-3.5 text-center">
                    <div className="text-lg font-extrabold text-win">{stats.accuracy}%</div>
                    <div className="text-[10px] text-secondary">{t("home.accuracy")}</div>
                  </div>
                  <div className="p-3.5 text-center">
                    <div className="text-lg font-extrabold text-gold">+{stats.roi}%</div>
                    <div className="text-[10px] text-secondary">{t("home.roi")}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-app bg-card">
              <div className="flex items-center gap-3 px-4 py-3.5">
                <WalletIcon className="h-5 w-5 text-gold" />
                <span className="flex-1 text-sm font-semibold">{t("account.wallet")}</span>
                <span className="text-sm font-bold tabular-nums">{formatTzs(user.walletTzs)}</span>
                <ChevronRightIcon className="h-4 w-4 text-secondary" />
              </div>
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <HistoryIcon className="h-5 w-5 text-gold" />
                <span className="flex-1 text-sm font-semibold">{t("account.paymentHistory")}</span>
                <ChevronRightIcon
                  className={`h-4 w-4 text-secondary transition-transform ${showHistory ? "rotate-90" : ""}`}
                />
              </button>
              {showHistory && (
                <div className="bg-inset px-4 py-2">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between border-b border-app py-2.5 text-xs last:border-0">
                      <div>
                        <div className="font-semibold">{tx.description}</div>
                        <div className="text-secondary">
                          {fullDate(tx.createdAt, lang)} · {tx.reference}
                        </div>
                      </div>
                      <span className={`font-bold tabular-nums ${tx.type === "referral_bonus" ? "text-win" : ""}`}>
                        {tx.type === "referral_bonus" ? "+" : "−"}
                        {formatTzs(tx.amountTzs)}
                      </span>
                    </div>
                  ))}
                  {transactions.length === 0 && (
                    <p className="py-3 text-center text-xs text-secondary">—</p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <GiftIcon className="h-5 w-5 text-gold" />
                <div className="flex-1">
                  <div className="text-sm font-semibold">{t("account.inviteEarn")}</div>
                  <div className="text-[11px] text-secondary">{t("account.referralDesc")}</div>
                </div>
                <span className="rounded-lg bg-inset px-2.5 py-1.5 font-mono text-xs font-bold text-gold">
                  {user.referralCode}
                </span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3.5">
                <SupportIcon className="h-5 w-5 text-gold" />
                <span className="flex-1 text-sm font-semibold">{t("account.support")}</span>
                <ChevronRightIcon className="h-4 w-4 text-secondary" />
              </div>
            </div>
          </>
        )}

        <div className="mt-4 divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-app bg-card">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <GlobeIcon className="h-5 w-5 text-gold" />
            <span className="flex-1 text-sm font-semibold">{t("account.language")}</span>
            <div className="flex overflow-hidden rounded-lg border border-app text-xs font-bold">
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`px-3 py-1.5 ${lang === "en" ? "bg-gold-400 text-navy-900" : "text-secondary"}`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang("sw")}
                className={`px-3 py-1.5 ${lang === "sw" ? "bg-gold-400 text-navy-900" : "text-secondary"}`}
              >
                SW
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            {theme === "dark" ? <MoonIcon className="h-5 w-5 text-gold" /> : <SunIcon className="h-5 w-5 text-gold" />}
            <span className="flex-1 text-sm font-semibold">{t("account.theme")}</span>
            <div className="flex overflow-hidden rounded-lg border border-app text-xs font-bold">
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`px-3 py-1.5 ${theme === "dark" ? "bg-gold-400 text-navy-900" : "text-secondary"}`}
              >
                {t("account.dark")}
              </button>
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`px-3 py-1.5 ${theme === "light" ? "bg-gold-400 text-navy-900" : "text-secondary"}`}
              >
                {t("account.light")}
              </button>
            </div>
          </div>
        </div>

        {user && (
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-app bg-card py-3.5 text-sm font-bold text-loss"
          >
            <LogoutIcon className="h-4 w-4" />
            {t("account.logout")}
          </button>
        )}

        <p className="mt-6 text-center text-[10px] text-secondary">{t("common.poweredBy")}</p>
      </main>
    </PageShell>
  );
}
