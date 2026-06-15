"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./AppProviders";
import { HomeIcon, LiveIcon, MarketsIcon, StatsIcon, TicketIcon, UserIcon } from "./Icons";
import type { DictKey } from "@/lib/i18n";

type NavItem = { href: string; key: DictKey; Icon: (p: { className?: string }) => React.ReactNode };

const items: NavItem[] = [
  { href: "/",        key: "nav.home",    Icon: HomeIcon },
  { href: "/tips",    key: "nav.tips",    Icon: TicketIcon },
  { href: "/markets", key: "nav.markets", Icon: MarketsIcon },
  { href: "/live",    key: "nav.live",    Icon: LiveIcon },
  { href: "/stats",   key: "nav.stats",   Icon: StatsIcon },
  { href: "/account", key: "nav.account", Icon: UserIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useApp();

  return (
    <nav
      className="fixed bottom-4 left-1/2 z-40 w-full max-w-[calc(28rem-1rem)] -translate-x-1/2"
    >
      <div
        className="flex items-center justify-around rounded-[28px] px-1 py-1.5"
        style={{
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(24px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
          boxShadow:
            '0 0 0 1px var(--border-subtle), 0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)',
        }}
      >
        {items.map(({ href, key, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-1 flex-col items-center gap-[3px] rounded-[20px] py-2 transition-all duration-200 ${
                active ? "text-gold" : "text-secondary/50 hover:text-secondary"
              }`}
            >
              {active && (
                <span
                  className="absolute inset-0 rounded-[20px]"
                  style={{
                    background: 'rgba(224,178,58,0.1)',
                    boxShadow: 'inset 0 0 0 1px rgba(224,178,58,0.18)',
                  }}
                />
              )}
              <Icon className="relative h-[17px] w-[17px]" />
              <span className="relative text-[8px] font-bold uppercase tracking-[0.06em]">
                {t(key)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
