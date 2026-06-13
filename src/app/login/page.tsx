"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useApp } from "@/components/AppProviders";
import GoogleSignIn from "@/components/GoogleSignIn";
import Logo from "@/components/Logo";

function LoginForm() {
  const { t, refreshUser } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      await refreshUser();
      router.push(params.get("next") ?? "/");
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-6 pt-14">
      <div className="flex justify-center">
        <Logo size={72} />
      </div>
      <h1 className="mt-8 text-2xl font-extrabold">{t("auth.welcomeBack")}</h1>
      <p className="mt-1 text-sm text-secondary">{t("auth.loginSubtitle")}</p>

      <div className="mt-7">
        <GoogleSignIn
          onSuccess={async () => {
            await refreshUser();
            router.push(params.get("next") ?? "/");
          }}
        />
      </div>

      <div className="mt-5 flex items-center gap-3 text-[11px] uppercase tracking-wide text-secondary">
        <span className="h-px flex-1 bg-[var(--border)]" />
        {t("auth.orEmail")}
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="email" className="text-xs font-semibold text-secondary">
            {t("auth.email")}
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-app bg-card px-4 py-3 text-sm outline-none focus:border-gold-400"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="text-xs font-semibold text-secondary">
            {t("auth.password")}
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-app bg-card px-4 py-3 text-sm outline-none focus:border-gold-400"
            placeholder="••••••••"
          />
        </div>

        {error && <p className="text-sm font-semibold text-loss">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-gold-400 py-3.5 text-sm font-extrabold text-navy-900 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {t("auth.login")}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-secondary">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="font-bold text-gold">
          {t("auth.register")}
        </Link>
      </p>

      <div className="mt-8 rounded-xl border border-dashed border-app bg-card p-3 text-center text-xs text-secondary">
        {t("auth.demoHint")}: <strong>demo@betua.co.tz</strong> / <strong>demo1234</strong>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
