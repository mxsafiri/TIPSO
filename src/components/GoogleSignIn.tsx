"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "./AppProviders";

interface GoogleAccountsId {
  initialize(config: { client_id: string; callback: (resp: { credential: string }) => void }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

/**
 * Renders the official Google Identity Services button. Hidden entirely when
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured.
 */
export default function GoogleSignIn({ onSuccess }: { onSuccess: () => void }) {
  const { theme } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;

    const init = () => {
      const gsi = window.google?.accounts.id;
      if (!gsi || !ref.current) return;
      gsi.initialize({
        client_id: clientId,
        callback: async (resp) => {
          setError("");
          try {
            const res = await fetch("/api/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential: resp.credential }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              setError(data.error ?? "Google sign-in failed");
              return;
            }
            onSuccess();
          } catch {
            setError("Network error — try again");
          }
        },
      });
      ref.current.innerHTML = "";
      gsi.renderButton(ref.current, {
        theme: theme === "dark" ? "filled_black" : "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: 320,
      });
    };

    if (window.google?.accounts) {
      init();
      return;
    }
    const existing = document.getElementById("google-gsi-script");
    if (existing) {
      existing.addEventListener("load", init);
      return () => existing.removeEventListener("load", init);
    }
    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = init;
    document.head.appendChild(script);
  }, [clientId, theme, onSuccess]);

  if (!clientId) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={ref} className="min-h-[44px]" />
      {error && <p className="text-sm font-semibold text-loss">{error}</p>}
    </div>
  );
}
