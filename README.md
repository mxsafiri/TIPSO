# Betua — Tips & Prediction Market

Betua (working repo name: TIPSO) is a Swahili-first **tips and prediction-market
platform** for East Africa, built to showcase real utility on the **nTZS
stablecoin**. It pairs AI-driven betting intelligence with a peer-to-peer
staking exchange where users stake nTZS against each other.

Two sides to the product:
- **Intelligence** — data- and AI-backed predictions with confidence scores and
  a transparent, publicly tracked win/loss ledger (sits on top of bookmakers,
  never handles bets); premium tiers paid via mobile money.
- **Exchange** — native peer-to-peer prediction markets settled in nTZS: stake
  YES/NO from your wallet, hold positions, redeem winnings. Built on the GUAP
  staking rails with Betua as the front-end.

> The user-facing brand is **Betua**; internal identifiers (env vars, cookies,
> package name) remain `tipso`/`TIPSO` to avoid config churn.

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
- **Neon Postgres** via `@neondatabase/serverless` (HTTP driver — ideal on Vercel)
- JWT sessions via `jose`, scrypt password hashing (Node crypto)
- Data layer behind one interface (`src/lib/store/types.ts`):
  `postgres.ts` in production, seeded `memory.ts` fallback when `DATABASE_URL`
  is unset (local dev / demos)

## Environment variables

Copy `.env.example` to `.env.local`. Summary:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | production | Neon Postgres connection string |
| `TIPSO_JWT_SECRET` | production | Session signing secret (`openssl rand -hex 32`) |
| `NTZS_API_BASE_URL` / `NTZS_API_KEY` / `NTZS_TREASURY_WALLET_ID` | optional | nTZS WaaS treasury credentials; simulator used when unset |
| `NTZS_CALLBACK_URL` / `NTZS_WEBHOOK_SECRET` | optional | Settlement webhook (`/api/webhooks/ntzs`) |

The database bootstraps itself: on first request the schema is created
(`CREATE TABLE IF NOT EXISTS`) and demo data is seeded if the DB is empty.
Stale demo fixtures are refreshed automatically so "today's tips" stay current.

## Deploying to Vercel

1. Import the GitHub repo in Vercel (framework auto-detected: Next.js).
2. Set `DATABASE_URL` and `TIPSO_JWT_SECRET` in Project → Settings →
   Environment Variables.
3. Deploy. First request creates and seeds the schema in Neon.
4. When nTZS credentials are available, add the `NTZS_*` variables and point
   the nTZS dashboard's callback at `https://<domain>/api/webhooks/ntzs`.

## Payments architecture (nTZS treasury model)

TIPSO holds **one master treasury wallet** (nTZS WaaS) — users do not get
individual on-chain wallets. User balances are internal ledger entries backed
by the treasury:

- **Collections in** — subscriptions and wallet top-ups are mobile-money
  collections into the treasury (`src/lib/payments.ts`). Pending collections
  are settled by the `/api/webhooks/ntzs` callback (idempotent, matched on our
  payment reference, full audit trail in `payment_events`).
- **Payouts out** — withdrawals debit the user's ledger balance and queue a
  `withdrawal_requests` row for operator review/release (automation via nTZS
  payout APIs later, ahead of the prediction-market roadmap).
- Until `NTZS_*` credentials are configured, a simulator settles collections
  instantly so every flow stays demoable end to end.

## Architecture notes

| Area | Current implementation | Production path |
| --- | --- | --- |
| Database | Neon Postgres, self-bootstrapping schema | Managed migrations as schema stabilises |
| Payments | nTZS treasury adapter + instant simulator fallback | Finalise adapter against nTZS API spec + sandbox |
| Tips engine | Claude Opus 4.8 picks + bilingual analysis (`src/lib/ai/tipster.ts`), strength-model fallback | Add real bookmaker odds + trained model on the settled ledger |
| Live scores | Seeded live state | Sports data API (e.g. API-Football) |
| Auth | Email + password | Add phone OTP (primary channel in TZ) |

## Compliance

TIPSO is an intelligence/affiliate layer and does not accept or place bets, so no
gambling licence is required. The UI carries an 18+ / responsible betting notice.

— Built by NEDALabs, lead technical partner.
