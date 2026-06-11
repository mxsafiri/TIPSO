"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/AppProviders";
import Logo from "@/components/Logo";

export default function RegisterPage() {
  const { t, refreshUser } = useApp();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        return;
      }
      await refreshUser();
      router.push("/");
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  const fields = [
    { key: "name" as const, label: t("auth.name"), type: "text", placeholder: "Juma Hassan" },
    { key: "email" as const, label: t("auth.email"), type: "email", placeholder: "you@example.com" },
    { key: "phone" as const, label: t("auth.phone"), type: "tel", placeholder: "+255 7XX XXX XXX" },
    { key: "password" as const, label: t("auth.password"), type: "password", placeholder: "••••••••" },
  ];

  return (
    <div className="flex min-h-dvh flex-col px-6 pt-14">
      <div className="flex justify-center">
        <Logo size={72} />
      </div>
      <h1 className="mt-8 text-2xl font-extrabold">{t("auth.createTitle")}</h1>
      <p className="mt-1 text-sm text-secondary">{t("auth.createSubtitle")}</p>

      <form onSubmit={submit} className="mt-7 space-y-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label htmlFor={f.key} className="text-xs font-semibold text-secondary">
              {f.label}
            </label>
            <input
              id={f.key}
              type={f.type}
              required
              value={form[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-app bg-card px-4 py-3 text-sm outline-none focus:border-gold-400"
              placeholder={f.placeholder}
            />
          </div>
        ))}

        {error && <p className="text-sm font-semibold text-loss">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-gold-400 py-3.5 text-sm font-extrabold text-navy-900 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {t("auth.register")}
        </button>
      </form>

      <p className="mt-5 pb-10 text-center text-sm text-secondary">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="font-bold text-gold">
          {t("auth.login")}
        </Link>
      </p>
    </div>
  );
}
