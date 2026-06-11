"use client";

import Link from "next/link";
import Logo from "./Logo";
import { BellIcon, SettingsIcon } from "./Icons";

export default function Header({ right = "bell" }: { right?: "bell" | "settings" | "none" }) {
  return (
    <header className="flex items-center justify-between px-5 pb-2 pt-5">
      <span className="w-9" />
      <Link href="/" aria-label="TIPSO home">
        <Logo size={52} />
      </Link>
      {right === "none" ? (
        <span className="w-9" />
      ) : (
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full text-secondary transition-colors hover:text-primary"
          aria-label={right === "bell" ? "Notifications" : "Settings"}
        >
          {right === "bell" ? <BellIcon className="h-5 w-5" /> : <SettingsIcon className="h-5 w-5" />}
        </button>
      )}
    </header>
  );
}
