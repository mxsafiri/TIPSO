import type { Tip } from "./types";

/** Tip as exposed by the API: premium picks are masked for free users. */
export interface TipDto extends Omit<Tip, "prediction" | "predictionSw" | "analysis" | "analysisSw"> {
  prediction: string;
  predictionSw: string;
  analysis: string;
  analysisSw: string;
  locked: boolean;
}

export function toTipDto(tip: Tip, hasPremium: boolean): TipDto {
  const locked = tip.isPremium && !hasPremium && tip.status === "pending";
  if (!locked) return { ...tip, locked };
  return {
    ...tip,
    locked,
    prediction: "",
    predictionSw: "",
    analysis: "",
    analysisSw: "",
  };
}
