# TIPSO — Betting Intelligence Platform

Verified betting tips with a transparent, publicly tracked record. Swahili-first,
mobile-money native, built for the East African market starting in Tanzania.

TIPSO sits **on top of existing bookmakers** — it never handles bets. The product
sells intelligence: data-backed predictions with confidence scores, a public
win/loss ledger, and premium subscription tiers paid via mobile money.

## Features (MVP)

- **Home** — Today's top tip, verified track-record strip, Hot Picks 🔥
- **Tips** — all tips filterable by sport (Football / Basketball / Tennis) and date,
  grouped by league, with odds and confidence scores
- **Live** — in-play matches with live scores and live tips
- **Stats** — the transparency layer: full settled-tip ledger, accuracy, flat-stake
  ROI, average odds and monthly breakdown. Nothing hidden, nothing deleted.
- **Plans** — Daily (TZS 2,000), Weekly (TZS 10,000, most popular) and VIP
  (TZS 25,000) tiers with a simulated mobile-money checkout
  (M-Pesa / Tigo Pesa / Airtel Money / HaloPesa / wallet)
- **Account** — profile, current plan, wallet, payment history, Invite & Earn
  referral code, support
- **Premium gating** — premium picks are masked server-side for free users
- **Dark / Light mode** — full theme switch, persisted locally
- **English / Swahili** — complete bilingual UI, persisted locally
- **Auth** — email + password sessions (scrypt hashing, JWT http-only cookie)

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000 (the UI is mobile-first; use a phone viewport).

**Demo account:** `demo@tipso.co.tz` / `demo1234` — John Mbeya, active Weekly
Plan, TZS 45,000 wallet, payment history.

## Stack

- [Next.js 15](https://nextjs.org) (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- JWT sessions via `jose`, scrypt password hashing (Node crypto)
- Data layer: in-memory store seeded with demo fixtures, mirrored to
  `.data/db.json` when writable. All access goes through `src/lib/db.ts`, so
  swapping in Postgres/Prisma later touches one file.

## Architecture notes

| Area | MVP implementation | Production path |
| --- | --- | --- |
| Database | Seeded in-memory + JSON snapshot (`src/lib/db.ts`) | Postgres + Prisma |
| Payments | Simulated STK push in `/api/subscribe` | M-Pesa OpenAPI / Selcom / DPO aggregator |
| Tips feed | Seed fixtures (`src/lib/seed.ts`) | Admin console + odds-feed ingestion + ML scoring |
| Live scores | Seeded live state | Sports data API (e.g. API-Football) |
| Auth | Email + password | Add phone OTP (primary channel in TZ) |

## Compliance

TIPSO is an intelligence/affiliate layer and does not accept or place bets, so no
gambling licence is required. The UI carries an 18+ / responsible betting notice.

— Built by NEDALabs, lead technical partner.
