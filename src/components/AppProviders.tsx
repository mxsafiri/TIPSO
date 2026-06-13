"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Lang, DictKey } from "@/lib/i18n";
import { t as translate } from "@/lib/i18n";
import type { PublicUser } from "@/lib/types";

interface AppContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: DictKey) => string;
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  user: PublicUser | null;
  userLoaded: boolean;
  refreshUser: () => Promise<void>;
  guapEnabled: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProviders");
  return ctx;
}

export default function AppProviders({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [theme, setThemeState] = useState<"dark" | "light">("dark");
  const [user, setUser] = useState<PublicUser | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [guapEnabled, setGuapEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setGuapEnabled(Boolean(d.guapEnabled)))
      .catch(() => undefined);
    const storedLang = window.localStorage.getItem("tipso_lang") as Lang | null;
    if (storedLang === "en" || storedLang === "sw") setLangState(storedLang);
    const storedTheme = window.localStorage.getItem("tipso_theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      setThemeState(storedTheme);
      document.documentElement.classList.toggle("dark", storedTheme === "dark");
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setUserLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const setLang = (l: Lang) => {
    setLangState(l);
    window.localStorage.setItem("tipso_lang", l);
  };

  const setTheme = (next: "dark" | "light") => {
    setThemeState(next);
    window.localStorage.setItem("tipso_theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const t = (key: DictKey) => translate(key, lang);

  return (
    <AppContext.Provider value={{ lang, setLang, t, theme, setTheme, user, userLoaded, refreshUser, guapEnabled }}>
      {children}
    </AppContext.Provider>
  );
}
