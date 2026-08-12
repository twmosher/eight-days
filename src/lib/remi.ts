export type RemiTrait = "discernment" | "efficiency" | "resolve" | "adaptability" | "calibration" | "stewardship";

export type RemiSignal = {
  trait: RemiTrait;
  value: number;
  weight?: number;
  evidence: string;
};

export type RemiProfile = {
  score: number;
  band: "developing" | "capable" | "strong" | "exceptional";
  fingerprint: string;
  headline: string;
  portrait: string;
  traits: Record<RemiTrait, number>;
  evidence: string[];
  possibilityKey: string;
};

const TRAITS: RemiTrait[] = ["discernment", "efficiency", "resolve", "adaptability", "calibration", "stewardship"];
const labels: Record<RemiTrait, string> = {
  discernment: "Pattern reader", efficiency: "Value maker", resolve: "Conviction holder",
  adaptability: "Agile operator", calibration: "Clear-eyed forecaster", stewardship: "Long-game steward",
};
const openings = [
  "You make decisions by finding the signal beneath the noise.",
  "You tend to turn uncertainty into a position others can act on.",
  "Your choices show a preference for leverage over motion for its own sake.",
  "You work from the shape of the whole situation, then commit.",
];
const tensions = [
  "Under pressure, your edge is selectivity; your risk is waiting for certainty that never arrives.",
  "You are strongest when your confidence stays proportional to the evidence.",
  "Your next level is preserving the same judgment when the clock and the crowd disagree.",
  "The trade-off in your style is that decisive moves can outrun the assumptions beneath them.",
  "You create room by keeping options alive, but too many live options can dilute the move that matters.",
];
const stances = ["measured", "opportunistic", "assertive", "protective", "contrarian"];

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const hash = (text: string) => [...text].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);

/**
 * REMI converts game-specific, evidence-backed signals into one portable score.
 * Each game owns its adapter; the model owns normalization and interpretation.
 */
export function createRemiProfile(signals: RemiSignal[], seed = "remi"): RemiProfile {
  const traits = Object.fromEntries(TRAITS.map((trait) => {
    const matching = signals.filter((signal) => signal.trait === trait);
    const weight = matching.reduce((sum, signal) => sum + (signal.weight ?? 1), 0);
    const value = weight ? matching.reduce((sum, signal) => sum + clamp(signal.value) * (signal.weight ?? 1), 0) / weight : 50;
    return [trait, clamp(value)];
  })) as Record<RemiTrait, number>;

  const ranked = [...TRAITS].sort((a, b) => traits[b] - traits[a] || a.localeCompare(b));
  const score = clamp(
    traits.discernment * .24 + traits.efficiency * .2 + traits.resolve * .16 +
    traits.adaptability * .14 + traits.calibration * .14 + traits.stewardship * .12,
  );
  const band = score >= 85 ? "exceptional" : score >= 70 ? "strong" : score >= 50 ? "capable" : "developing";
  const spread = traits[ranked[0]] - traits[ranked[5]];
  const stanceIndex = clamp((traits.resolve + (100 - traits.stewardship)) / 2) / 21;
  const stance = stances[Math.min(4, Math.floor(stanceIndex))];
  const variant = hash(`${seed}:${ranked.join(":")}:${Object.values(traits).map((value) => Math.round(value / 10)).join("")}`);
  const fingerprint = `${labels[ranked[0]]} · ${stance}`;
  const portrait = `${openings[variant % openings.length]} Your strongest signature is ${labels[ranked[0]].toLowerCase()}, supported by ${labels[ranked[1]].toLowerCase()}. ${tensions[Math.floor(variant / openings.length) % tensions.length]}`;

  return {
    score, band, fingerprint,
    headline: spread < 12 ? "THE BALANCED HAND" : labels[ranked[0]].toUpperCase(),
    portrait, traits,
    evidence: [...new Set(signals.sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1)).map((signal) => signal.evidence))].slice(0, 3),
    possibilityKey: `${ranked[0]}:${ranked[1]}:${stance}:${band}:${variant % 4}`,
  };
}

// 6 lead traits × 5 supporting traits × 5 stances × 4 narrative variants × 4 score bands.
export const REMI_PERSONALITY_POSSIBILITIES = 2400;
