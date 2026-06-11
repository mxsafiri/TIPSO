import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import AppProviders from "@/components/AppProviders";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-app",
});

export const metadata: Metadata = {
  title: "TIPSO — Betting Intelligence Platform",
  description:
    "Verified betting tips with transparent, publicly tracked results. Swahili-first betting intelligence for East Africa.",
};

export const viewport: Viewport = {
  themeColor: "#0a0e1a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('tipso_theme');if(t==='light'){document.documentElement.classList.remove('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body className={`${jakarta.variable} font-sans`}>
        <AppProviders>
          <div className="mx-auto min-h-dvh w-full max-w-md bg-app shadow-2xl md:border-x md:border-app">
            {children}
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
