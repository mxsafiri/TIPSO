"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./AppProviders";
import { HomeIcon, LiveIcon, MarketsIcon, StatsIcon, TicketIcon, UserIcon } from "./Icons";
import type { DictKey } from "@/lib/i18n";

type NavItem = { href: string; key: DictKey; Icon: (p: { className?: string }) => React.ReactNode };

// Markets is a core Betua feature (native peer-to-peer exchange), always shown.
const items: NavItem[] = [
  { href: "/", key: "nav.home", Icon: HomeIcon },
  { href: "/tips", key: "nav.tips", Icon: TicketIcon },
  { href: "/markets", key: "nav.markets", Icon: MarketsIcon },
  { href: "/live", key: "nav.live", Icon: LiveIcon },
  { href: "/stats", key: "nav.stats", Icon: StatsIcon },
  { href: "/account", key: "nav.account", Icon: UserIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useApp();

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-app bg-card/95 backdrop-blur">
      <div className="flex items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {items.map(({ href, key, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                active ? "text-gold" : "text-secondary hover:text-primary"
              }`}
            >
              <Icon className="h-5 w-5" />
              {t(key)}
              <span
                className={`h-0.5 w-6 rounded-full transition-opacity ${
                  active ? "bg-gold-400 opacity-100" : "opacity-0"
                }`}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
