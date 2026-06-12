import type { Tip } from "../types";
import type { DataStore } from "../store/types";

/**
 * FIFA World Cup 2026 live fixtures via football-data.org (free tier includes
 * the World Cup). Requires FOOTBALL_DATA_API_KEY; without it this module is a
 * no-op and the app keeps running on its seeded fixtures.
 *
 * Each fixture becomes a TIPSO tip with a deterministic, strength-model
 * prediction. Finished matches are settled automatically (won/lost + result),
 * feeding the public transparency ledger with real outcomes.
 */

const SYNC_INTERVAL_MS = 30 * 60 * 1000;
let lastSyncAt = 0;

export interface FeedDiagnostics {
  keyPresent: boolean;
  lastAttemptAt: string | null;
  httpStatus: number | null;
  matchesFromApi: number | null;
  tipsUpserted: number | null;
  requestsAvailable: string | null;
  error: string | null;
}

let lastDiag: FeedDiagnostics = {
  keyPresent: false,
  lastAttemptAt: null,
  httpStatus: null,
  matchesFromApi: null,
  tipsUpserted: null,
  requestsAvailable: null,
  error: null,
};

export function getFeedDiagnostics(): FeedDiagnostics {
  return { ...lastDiag, keyPresent: Boolean(process.env.FOOTBALL_DATA_API_KEY) };
}

interface FdTeam {
  id: number;
  name: string;
  shortName?: string;
  tla?: string;
}

interface FdMatch {
  id: number;
  utcDate: string;
  status: string; // SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED | ...
  stage?: string;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
}

/** Rough national-team strength tiers (FIFA-ranking informed, early 2026). */
const TEAM_STRENGTH: Record<string, number> = {
  ARG: 93, FRA: 92, ESP: 92, ENG: 90, BRA: 89, POR: 88, NED: 87, BEL: 85,
  GER: 85, CRO: 84, ITA: 84, URU: 83, COL: 83, MAR: 83, JPN: 81, USA: 80,
  SUI: 80, DEN: 80, MEX: 79, SEN: 79, ECU: 78, KOR: 77, SRB: 77, IRN: 76,
  POL: 76, NGA: 76, CIV: 76, PAR: 76, CAN: 76, AUS: 75, ALG: 75, EGY: 75,
  GHA: 74, CMR: 74, TUN: 72, RSA: 71, KSA: 70, PAN: 70, CRC: 70, JOR: 70,
  QAT: 68, UZB: 68, JAM: 68, IRQ: 66, NZL: 65, CPV: 65, CUW: 64, HAI: 63,
};

const TEAM_COLORS: Record<string, string> = {
  ARG: "#75AADB", FRA: "#002395", ESP: "#AA151B", ENG: "#CF081F", BRA: "#009C3B",
  POR: "#006600", NED: "#FF6600", BEL: "#E30613", GER: "#1A1A1A", CRO: "#FF0000",
  ITA: "#0064AA", URU: "#5CBFEB", COL: "#FCD116", MAR: "#C1272D", JPN: "#1A2B63",
  USA: "#3C3B6E", SUI: "#D52B1E", DEN: "#C60C30", MEX: "#006847", SEN: "#00853F",
  ECU: "#FFD100", KOR: "#CD2E3A", SRB: "#C6363C", IRN: "#239F40", POL: "#DC143C",
  NGA: "#008751", CIV: "#FF8200", PAR: "#D52B1E", CAN: "#FF0000", AUS: "#FFCD00",
  ALG: "#006233", EGY: "#CE1126", GHA: "#FCD116", CMR: "#007A5E", TUN: "#E70013",
  RSA: "#007A4D", KSA: "#006C35", PAN: "#DA121A", CRC: "#002B7F", JOR: "#007A3D",
  QAT: "#8A1538", UZB: "#1EB53A", JAM: "#009B3A", IRQ: "#CE1126", NZL: "#1A1A1A",
  CPV: "#003893", CUW: "#002B7F", HAI: "#00209F",
};

function strength(tla: string): number {
  return TEAM_STRENGTH[tla] ?? 70;
}

interface Pick {
  prediction: string;
  predictionSw: string;
  odds: number;
  confidence: number;
}

/** Deterministic per-match prediction from the strength model. */
function makePick(m: FdMatch): Pick {
  const homeTla = m.homeTeam.tla ?? "???";
  const awayTla = m.awayTeam.tla ?? "???";
  const home = m.homeTeam.shortName ?? m.homeTeam.name;
  const away = m.awayTeam.shortName ?? m.awayTeam.name;
  const diff = strength(homeTla) - strength(awayTla);
  const jitter = (m.id % 7) - 3; // ±3 deterministic variety per fixture

  if (diff >= 9) {
    const conf = Math.min(84, 72 + Math.floor(diff / 3) + jitter);
    return {
      prediction: `${home} Win`,
      predictionSw: `${home} Kushinda`,
      odds: round2(1.25 + Math.max(0, 30 - diff) * 0.02),
      confidence: conf,
    };
  }
  if (diff <= -9) {
    const conf = Math.min(84, 72 + Math.floor(-diff / 3) + jitter);
    return {
      prediction: `${away} Win`,
      predictionSw: `${away} Kushinda`,
      odds: round2(1.35 + Math.max(0, 30 + diff) * 0.02),
      confidence: conf,
    };
  }
  if (diff >= 4) {
    return {
      prediction: `Draw or ${home}`,
      predictionSw: `Sare au ${home}`,
      odds: round2(1.3 + (9 - diff) * 0.02),
      confidence: 68 + jitter,
    };
  }
  if (diff <= -4) {
    return {
      prediction: `Draw or ${away}`,
      predictionSw: `Sare au ${away}`,
      odds: round2(1.32 + (9 + diff) * 0.02),
      confidence: 68 + jitter,
    };
  }
  const combined = strength(homeTla) + strength(awayTla);
  if (combined >= 168) {
    return {
      prediction: "Over 1.5 Goals",
      predictionSw: "Zaidi ya Magoli 1.5",
      odds: round2(1.4 + (m.id % 5) * 0.04),
      confidence: 66 + jitter,
    };
  }
  return {
    prediction: "Both Teams to Score",
    predictionSw: "Timu Zote Kufunga",
    odds: round2(1.65 + (m.id % 5) * 0.05),
    confidence: 62 + jitter,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function settle(pick: Pick, m: FdMatch): { status: "won" | "lost"; result: string } | null {
  const ft = m.score.fullTime;
  if (ft.home == null || ft.away == null) return null;
  const total = ft.home + ft.away;
  const result = `${ft.home}-${ft.away}`;
  const home = m.homeTeam.shortName ?? m.homeTeam.name;
  const away = m.awayTeam.shortName ?? m.awayTeam.name;

  let won: boolean;
  if (pick.prediction === `${home} Win`) won = m.score.winner === "HOME_TEAM";
  else if (pick.prediction === `${away} Win`) won = m.score.winner === "AWAY_TEAM";
  else if (pick.prediction === `Draw or ${home}`) won = m.score.winner !== "AWAY_TEAM";
  else if (pick.prediction === `Draw or ${away}`) won = m.score.winner !== "HOME_TEAM";
  else if (pick.prediction === "Over 1.5 Goals") won = total > 1.5;
  else if (pick.prediction === "Both Teams to Score") won = ft.home > 0 && ft.away > 0;
  else return null;

  return { status: won ? "won" : "lost", result };
}

function estimateMinute(utcDate: string, status: string): number {
  if (status === "PAUSED") return 45;
  const elapsed = Math.floor((Date.now() - new Date(utcDate).getTime()) / 60000);
  // Subtract the halftime break once we're past it.
  const minute = elapsed > 60 ? elapsed - 17 : elapsed;
  return Math.max(1, Math.min(90, minute));
}

function toTip(m: FdMatch): Tip | null {
  const homeTla = m.homeTeam.tla ?? "";
  const awayTla = m.awayTeam.tla ?? "";
  if (!homeTla || !awayTla) return null;
  const pick = makePick(m);
  const live = m.status === "IN_PLAY" || m.status === "PAUSED";
  const settled = m.status === "FINISHED" ? settle(pick, m) : null;

  return {
    id: `wc_${m.id}`,
    sport: "football",
    league: "FIFA World Cup 2026",
    home: m.homeTeam.shortName ?? m.homeTeam.name,
    away: m.awayTeam.shortName ?? m.awayTeam.name,
    homeCode: homeTla,
    awayCode: awayTla,
    homeColor: TEAM_COLORS[homeTla] ?? "#1B2440",
    awayColor: TEAM_COLORS[awayTla] ?? "#B8890F",
    kickoff: m.utcDate,
    prediction: pick.prediction,
    predictionSw: pick.predictionSw,
    odds: pick.odds,
    confidence: pick.confidence,
    isPremium: pick.confidence >= 76,
    isHotPick: pick.confidence >= 72 && !settled,
    status: settled?.status ?? "pending",
    result: settled?.result,
    live: live
      ? {
          minute: estimateMinute(m.utcDate, m.status),
          homeScore: m.score.fullTime.home ?? 0,
          awayScore: m.score.fullTime.away ?? 0,
        }
      : undefined,
    analysis: `TIPSO model pick for ${m.homeTeam.name} vs ${m.awayTeam.name}, FIFA World Cup 2026.`,
    analysisSw: `Utabiri wa modeli ya TIPSO kwa ${m.homeTeam.name} dhidi ya ${m.awayTeam.name}, Kombe la Dunia 2026.`,
  };
}

/**
 * Throttled sync of World Cup fixtures into the tips store. Never throws —
 * a feed outage must not break the app. Pass force=true (diagnostics) to
 * bypass the throttle.
 */
export async function syncWorldCupTips(store: DataStore, force = false): Promise<void> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) return;
  const now = Date.now();
  if (!force && now - lastSyncAt < SYNC_INTERVAL_MS) return;
  lastSyncAt = now;
  lastDiag = {
    keyPresent: true,
    lastAttemptAt: new Date(now).toISOString(),
    httpStatus: null,
    matchesFromApi: null,
    tipsUpserted: null,
    requestsAvailable: null,
    error: null,
  };

  try {
    const from = new Date(now - 2 * 86400000).toISOString().slice(0, 10);
    const to = new Date(now + 7 * 86400000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${from}&dateTo=${to}`,
      { headers: { "X-Auth-Token": apiKey }, signal: AbortSignal.timeout(8000) },
    );
    lastDiag.httpStatus = res.status;
    lastDiag.requestsAvailable = res.headers.get("x-requests-available-minute");
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      lastDiag.error = `football-data.org returned ${res.status}: ${body.slice(0, 200)}`;
      console.error("[worldcup-feed]", lastDiag.error);
      // Retry sooner than the normal interval after a failure.
      lastSyncAt = now - SYNC_INTERVAL_MS + 60_000;
      return;
    }
    const data = (await res.json()) as { matches?: FdMatch[] };
    const tips = (data.matches ?? []).map(toTip).filter((t): t is Tip => t !== null);
    lastDiag.matchesFromApi = data.matches?.length ?? 0;
    if (tips.length > 0) {
      await store.upsertTips(tips);
      // Real fixtures are flowing — retire the demo/seed fixtures.
      await store.deletePendingSeedTips();
    }
    lastDiag.tipsUpserted = tips.length;
  } catch (e) {
    lastDiag.error = e instanceof Error ? e.message : String(e);
    console.error("[worldcup-feed]", lastDiag.error);
    lastSyncAt = now - SYNC_INTERVAL_MS + 60_000;
  }
}
