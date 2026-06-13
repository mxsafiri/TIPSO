import Anthropic from "@anthropic-ai/sdk";
import { MARKET_KEYS, isMarketKey, type MarketKey } from "../markets";

/**
 * Betua Prediction Intelligence engine.
 *
 * Claude Opus 4.8 acts as the reasoning + analysis layer on top of structured
 * match facts: it selects the sharpest settleable market, calibrates a
 * confidence score, estimates fair odds, and writes distinctive bilingual
 * (English + Swahili) analysis for every fixture. Output is constrained by a
 * strict tool schema so it maps 1:1 onto our Tip model with no parsing risk.
 *
 * This is gated on ANTHROPIC_API_KEY. When the key is absent or a call fails,
 * callers fall back to the deterministic strength model — the AI never blocks
 * tip generation, and published picks are still frozen and settled mechanically.
 */

const MODEL = "claude-opus-4-8";
const CALL_TIMEOUT_MS = 90_000;
const MAX_CONFIDENCE = 84; // We never claim certainty.
const MIN_CONFIDENCE = 52;

export interface MatchContext {
  matchId: string;
  competition: string;
  stage?: string;
  home: string;
  away: string;
  homeStrength: number;
  awayStrength: number;
  kickoffIso: string;
}

export interface AIPrediction {
  market: MarketKey;
  confidence: number;
  fairOdds: number;
  analysisEn: string;
  analysisSw: string;
  keyFactorsEn: string[];
  keyFactorsSw: string[];
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | undefined;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const SYSTEM_PROMPT = `You are the prediction intelligence engine behind Betua — a premium, Swahili-first tips and prediction-market platform for East Africa. Punters pay for your edge, so every selection must read like the work of a sharp, disciplined analyst, not a generic bot.

Your job for each fixture: choose the single most defensible betting market, set a calibrated confidence, estimate fair odds, and write tight, specific analysis in both English and Swahili.

Principles:
- Reason like a professional trader. Weigh team quality, the gap between sides, tournament stage and what it incentivises (caution in knockouts, openness when a team must chase a result), squad and fatigue context, and typical game state. You are given strength ratings (0-100, FIFA-informed) as one input — use judgement, do not just pick the favourite every time.
- Prefer value and defensibility over headline-grabbing longshots. A well-reasoned double chance or goals line often beats a coin-flip match winner.
- Confidence is a real probability estimate between ${MIN_CONFIDENCE} and 90. Reserve 80+ for genuinely strong, low-variance edges. Most picks should sit in the 60s-70s. Never inflate.
- Fair odds reflect your true estimated probability of the selection landing (roughly 1 / probability), not a bookmaker's padded price.
- Analysis must be concrete and match-specific: name the teams, cite the actual reasoning (the strength gap, the stage, the likely game shape). 2-3 sentences. No filler, no hedging clichés, no "anything can happen".
- Swahili analysis must be natural, fluent Swahili written for a Tanzanian punter — not a word-for-word translation. Same substance, idiomatic phrasing.
- Key factors: 2-3 short, punchy bullets (max ~8 words each) capturing the drivers of the pick, in both languages.

You must respond by calling submit_predictions exactly once, with one entry per fixture provided. Do not omit any fixture.`;

const PREDICTION_TOOL: Anthropic.Tool = {
  name: "submit_predictions",
  description: "Submit the Betua prediction for every fixture provided, in the same order.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      predictions: {
        type: "array",
        description: "One prediction per fixture.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            matchId: { type: "string", description: "The matchId from the fixture list." },
            market: {
              type: "string",
              enum: MARKET_KEYS,
              description: "The selected settleable market.",
            },
            confidence: {
              type: "integer",
              description: `Calibrated confidence (probability %) the selection lands, ${MIN_CONFIDENCE}-90.`,
            },
            fairOdds: {
              type: "number",
              description: "Estimated fair decimal odds for the selection (~1/probability).",
            },
            analysisEn: { type: "string", description: "2-3 sentence English analysis." },
            analysisSw: { type: "string", description: "2-3 sentence natural Swahili analysis." },
            keyFactorsEn: {
              type: "array",
              items: { type: "string" },
              description: "2-3 short English bullets driving the pick.",
            },
            keyFactorsSw: {
              type: "array",
              items: { type: "string" },
              description: "2-3 short Swahili bullets driving the pick.",
            },
          },
          required: [
            "matchId",
            "market",
            "confidence",
            "fairOdds",
            "analysisEn",
            "analysisSw",
            "keyFactorsEn",
            "keyFactorsSw",
          ],
        },
      },
    },
    required: ["predictions"],
  },
};

interface RawPrediction {
  matchId?: unknown;
  market?: unknown;
  confidence?: unknown;
  fairOdds?: unknown;
  analysisEn?: unknown;
  analysisSw?: unknown;
  keyFactorsEn?: unknown;
  keyFactorsSw?: unknown;
}

function sanitize(raw: RawPrediction): AIPrediction | null {
  if (!isMarketKey(raw.market)) return null;
  const confidenceNum = Number(raw.confidence);
  const oddsNum = Number(raw.fairOdds);
  if (!Number.isFinite(confidenceNum) || !Number.isFinite(oddsNum)) return null;
  const analysisEn = typeof raw.analysisEn === "string" ? raw.analysisEn.trim() : "";
  const analysisSw = typeof raw.analysisSw === "string" ? raw.analysisSw.trim() : "";
  if (!analysisEn || !analysisSw) return null;

  const toBullets = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim())
          .slice(0, 3)
      : [];

  return {
    market: raw.market,
    // Guardrail: cap confidence so the product never overclaims.
    confidence: Math.min(MAX_CONFIDENCE, Math.max(MIN_CONFIDENCE, Math.round(confidenceNum))),
    fairOdds: oddsNum,
    analysisEn,
    analysisSw,
    keyFactorsEn: toBullets(raw.keyFactorsEn),
    keyFactorsSw: toBullets(raw.keyFactorsSw),
  };
}

/**
 * Generate AI predictions for a batch of fixtures. Returns a map keyed by
 * matchId. Never throws — on any failure it returns an empty map and the
 * caller falls back to the strength model.
 */
export async function generatePredictions(
  contexts: MatchContext[],
): Promise<Map<string, AIPrediction>> {
  const out = new Map<string, AIPrediction>();
  if (!isAiConfigured() || contexts.length === 0) return out;

  const fixtures = contexts.map((c) => ({
    matchId: c.matchId,
    competition: c.competition,
    stage: c.stage ?? "group stage",
    home: c.home,
    away: c.away,
    homeStrength: c.homeStrength,
    awayStrength: c.awayStrength,
    strengthGap: c.homeStrength - c.awayStrength,
    kickoff: c.kickoffIso,
  }));

  try {
    const response = await getClient().messages.create(
      {
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        tools: [PREDICTION_TOOL],
        tool_choice: { type: "tool", name: "submit_predictions" },
        messages: [
          {
            role: "user",
            content: `Produce Betua predictions for these ${fixtures.length} fixture(s). Return one entry per fixture, keyed by matchId.\n\n${JSON.stringify(fixtures, null, 2)}`,
          },
        ],
      },
      { signal: AbortSignal.timeout(CALL_TIMEOUT_MS) },
    );

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_predictions",
    );
    if (!toolUse) return out;

    const input = toolUse.input as { predictions?: RawPrediction[] };
    const list = Array.isArray(input.predictions) ? input.predictions : [];
    const validIds = new Set(contexts.map((c) => c.matchId));

    for (const raw of list) {
      const matchId = typeof raw.matchId === "string" ? raw.matchId : "";
      if (!validIds.has(matchId)) continue;
      const pred = sanitize(raw);
      if (pred) out.set(matchId, pred);
    }
  } catch {
    // Network error, timeout, refusal, malformed output — fall back silently.
    return new Map();
  }

  return out;
}
