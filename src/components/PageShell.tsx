"use client";

import BottomNav from "./BottomNav";

export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-28">
      {children}
      <BottomNav />
    </div>
  );
}
