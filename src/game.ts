import chipsData from "./data/chips.json";
import posturesData from "./data/postures.json";

export const CHIP_IDS = ["AUTO_SURTAX", "DAIRY_TRQ", "ALCOHOL", "USMCA_PROCESS", "SA_QUOTA"] as const;
export const POSTURES = ["BUILDER", "BROADCASTER", "DETROIT", "SQUEEZE"] as const;
export const INTEL_IDS = ["DETROIT_LINE", "SENATE_BACKCHANNEL", "PREMIERS_CALL", "DAIRY_CAUCUS", "LEGAL_READ", "USTR_READOUT"] as const;

export type Chip = typeof CHIP_IDS[number];
export type Posture = typeof POSTURES[number];
export type IntelCard = typeof INTEL_IDS[number];
export type ValueGuess = "low" | "medium" | "high";
export type Prize = "338_POSTPONEMENT" | "338_WITHDRAWAL" | "SA_RELIEF" | "AUTO_RELIEF" | "USMCA_EXTENSION";
export type Phase = "desk" | "intel" | "offer" | "counter" | "backfire" | "postponement" | "final" | "reveal";
export type FinalDecision = "accept" | "counter" | "let_hit" | "call_bluff";
export type DeliveryStatus = "full" | "partial" | "failed";

export interface GameState {
  seed: string;
  posture: Posture;
  phase: Phase;
  daysRemaining: number;
  intelPurchased: IntelCard[];
  beliefs: { willImpose: number; waitingHelps: number };
  offered: Chip[];
  delivery: Partial<Record<Chip, DeliveryStatus>>;
  won: Prize[];
  domesticCapital: number;
  playerEstimates: Record<Chip, ValueGuess | null>;
  authorizedNothing: boolean;
  domesticResponse: string | null;
  postponementAccepted: boolean | null;
  finalDecision: FinalDecision | null;
  tariffsLanded: boolean;
  outcome: string;
  log: string[];
}

export type GameAction =
  | { type: "SET_BELIEFS"; willImpose: number; waitingHelps: number }
  | { type: "BUY_INTEL"; card: IntelCard }
  | { type: "FINISH_INTEL" }
  | { type: "SET_ESTIMATE"; chip: Chip; guess: ValueGuess }
  | { type: "TOGGLE_CHIP"; chip: Chip }
  | { type: "AUTHORIZE_NOTHING" }
  | { type: "SUBMIT_OFFER" }
  | { type: "ACK_COUNTER" }
  | { type: "HANDLE_BACKFIRE"; response: "capital" | "substitute" | "limits" | "blame" }
  | { type: "RESPOND_POSTPONEMENT"; accept: boolean }
  | { type: "FINAL_DECISION"; decision: FinalDecision };

export type ChipData = { id: Chip; label: string; what: string; cost: string; costValue: number; deliverability: string; detail: string };
export const chips = chipsData as ChipData[];
type PostureSpec = { values: Record<Chip, number>; resolve: number; wanted: Chip; tell: string };
export const postureSpecs = posturesData as Record<Posture, PostureSpec>;

export function randomFor(seed: string, key: string) {
  let h = 2166136261;
  const input = `${seed}:${key}`;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h += h << 13; h ^= h >>> 7; h += h << 3; h ^= h >>> 17; h += h << 5;
  return (h >>> 0) / 4294967296;
}

export function createInitialState(seed: string): GameState {
  const posture = POSTURES[Math.floor(randomFor(seed, "posture") * POSTURES.length)];
  return {
    seed, posture, phase: "desk", daysRemaining: 8, intelPurchased: [],
    beliefs: { willImpose: 50, waitingHelps: 50 }, offered: [], delivery: {}, won: [],
    domesticCapital: 3, playerEstimates: Object.fromEntries(CHIP_IDS.map((chip) => [chip, null])) as Record<Chip, null>,
    authorizedNothing: false, domesticResponse: null, postponementAccepted: null,
    finalDecision: null, tariffsLanded: false, outcome: "", log: [],
  };
}

function deliver(state: GameState, chip: Chip, context: string): DeliveryStatus {
  if (chip === "AUTO_SURTAX" || chip === "USMCA_PROCESS" || chip === "SA_QUOTA") return "full";
  if (chip === "DAIRY_TRQ") {
    if (state.intelPurchased.includes("DAIRY_CAUCUS")) return "partial";
    return randomFor(state.seed, `${context}:dairy`) < 0.6 ? "full" : "partial";
  }
  const improved = state.intelPurchased.includes("PREMIERS_CALL");
  const chance = improved ? 0.68 + randomFor(state.seed, "premiers:lift") * 0.17 : 0.35;
  return randomFor(state.seed, `${context}:alcohol`) < chance ? "full" : "failed";
}

function addOffered(state: GameState, chip: Chip, context: string) {
  if (state.offered.includes(chip)) return state;
  const status = deliver(state, chip, context);
  return {
    ...state,
    offered: [...state.offered, chip],
    delivery: { ...state.delivery, [chip]: status },
    log: [...state.log, status === "failed" ? `${chip} was offered but could not be delivered.` : `${chip} delivered ${status === "partial" ? "only in part" : "as authorized"}.`],
  };
}

function deliveredValue(state: GameState) {
  const values = postureSpecs[state.posture].values;
  return state.offered.reduce((sum, chip) => {
    const status = state.delivery[chip];
    return sum + (status === "full" ? values[chip] : status === "partial" ? values[chip] * 0.55 : 0);
  }, 0);
}

function prizePackage(state: GameState, aggressive = false): Prize[] {
  const value = deliveredValue(state) + (aggressive ? 1 : 0);
  const delivered = (chip: Chip) => state.delivery[chip] === "full" || state.delivery[chip] === "partial";
  if (state.posture === "SQUEEZE") return delivered("USMCA_PROCESS") && value >= 4 ? ["338_WITHDRAWAL"] : ["338_POSTPONEMENT"];
  if (state.posture === "DETROIT") {
    const prizes: Prize[] = value >= 4 ? ["338_WITHDRAWAL"] : ["338_POSTPONEMENT"];
    if (delivered("SA_QUOTA") && value >= 6) prizes.push("SA_RELIEF");
    if (delivered("AUTO_SURTAX") && value >= (aggressive ? 5 : 7)) prizes.push("AUTO_RELIEF");
    return prizes;
  }
  if (state.posture === "BUILDER") {
    const prizes: Prize[] = value >= 5 ? ["338_WITHDRAWAL"] : ["338_POSTPONEMENT"];
    if (value >= (aggressive ? 7 : 8)) prizes.push("SA_RELIEF");
    return prizes;
  }
  const prizes: Prize[] = value >= 3 ? ["338_WITHDRAWAL"] : ["338_POSTPONEMENT"];
  if (value >= (aggressive ? 5 : 6)) prizes.push("SA_RELIEF");
  return prizes;
}

export function resolve(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SET_BELIEFS":
      return { ...state, beliefs: { willImpose: action.willImpose, waitingHelps: action.waitingHelps }, phase: "intel", log: [...state.log, "Initial probabilities entered."] };
    case "BUY_INTEL":
      if (state.intelPurchased.includes(action.card) || state.intelPurchased.length >= 3 || state.daysRemaining <= 0) return state;
      return { ...state, intelPurchased: [...state.intelPurchased, action.card], daysRemaining: state.daysRemaining - 1, log: [...state.log, `Authorized ${action.card}.`] };
    case "FINISH_INTEL": return { ...state, phase: "offer" };
    case "SET_ESTIMATE": return { ...state, playerEstimates: { ...state.playerEstimates, [action.chip]: action.guess } };
    case "TOGGLE_CHIP": {
      if (state.authorizedNothing) return { ...state, authorizedNothing: false, offered: [action.chip] };
      if (state.offered.includes(action.chip)) return { ...state, offered: state.offered.filter((chip) => chip !== action.chip) };
      if (state.offered.length >= 2) return state;
      return { ...state, offered: [...state.offered, action.chip] };
    }
    case "AUTHORIZE_NOTHING": return { ...state, authorizedNothing: true, offered: [] };
    case "SUBMIT_OFFER": {
      if (!state.authorizedNothing && state.offered.length !== 2) return state;
      const selected = [...state.offered];
      let next = { ...state, delivery: {}, phase: "counter" as Phase, log: [...state.log, state.authorizedNothing ? "No opening concessions authorized." : "Opening package authorized."] };
      for (const chip of selected) {
        const status = deliver(next, chip, "opening");
        next = { ...next, delivery: { ...next.delivery, [chip]: status }, log: [...next.log, status === "failed" ? `${chip} failed at delivery.` : `${chip} reached Washington ${status === "partial" ? "in part" : "in full"}.`] };
      }
      return next;
    }
    case "ACK_COUNTER": return { ...state, phase: "backfire" };
    case "HANDLE_BACKFIRE": {
      let next: GameState = { ...state, domesticResponse: action.response, phase: "postponement" };
      if (action.response === "capital") next = { ...next, domesticCapital: Math.max(0, next.domesticCapital - 2), log: [...next.log, "Political capital spent to shore up delivery."] };
      if (action.response === "blame") next = { ...next, domesticCapital: Math.max(0, next.domesticCapital - 1), log: [...next.log, "Federal limits were made public at a domestic cost."] };
      if (action.response === "substitute") {
        const substitute = chips.filter((chip) => !next.offered.includes(chip.id)).sort((a, b) => a.costValue - b.costValue)[0]?.id;
        if (substitute) next = addOffered(next, substitute, "substitute");
      }
      return next;
    }
    case "RESPOND_POSTPONEMENT": {
      let next: GameState = { ...state, postponementAccepted: action.accept, phase: "final", won: action.accept ? [...new Set([...state.won, "338_POSTPONEMENT" as Prize])] : state.won };
      if (action.accept) next = addOffered(next, postureSpecs[state.posture].wanted, "postponement");
      return next;
    }
    case "FINAL_DECISION": {
      const next: GameState = { ...state, finalDecision: action.decision, phase: "reveal" };
      if (action.decision === "accept" || action.decision === "counter") {
        const counter = action.decision === "counter";
        const accepted = !counter || randomFor(state.seed, "final-counter") > postureSpecs[state.posture].resolve * 0.72;
        if (counter) next.daysRemaining = Math.max(0, next.daysRemaining - 1);
        if (accepted) {
          next.won = [...new Set([...next.won, ...prizePackage(next, counter)])];
          next.outcome = counter ? "Washington accepted the final counter." : "Canada accepted the final package.";
        } else {
          next.tariffsLanded = true;
          next.outcome = "The final counter expired. The Section 338 tariffs took effect.";
        }
      } else if (action.decision === "let_hit") {
        next.tariffsLanded = true;
        next.outcome = "Canada held every remaining position. The Section 338 tariffs took effect.";
      } else {
        const legalEdge = state.intelPurchased.includes("LEGAL_READ") ? 0.12 : 0;
        const bluffSucceeds = randomFor(state.seed, "bluff") + legalEdge > postureSpecs[state.posture].resolve;
        next.tariffsLanded = !bluffSucceeds;
        next.won = bluffSucceeds ? [...new Set([...state.won, "338_WITHDRAWAL" as Prize])] : state.won;
        next.outcome = bluffSucceeds ? "Washington withdrew the Section 338 action without another concession." : "Washington did not blink. The Section 338 tariffs took effect.";
      }
      return next;
    }
  }
}

const guessValue: Record<ValueGuess, number> = { low: 1, medium: 3, high: 5 };
const prizeValue: Record<Prize, number> = { "338_POSTPONEMENT": 1, "338_WITHDRAWAL": 3, SA_RELIEF: 4, AUTO_RELIEF: 5, USMCA_EXTENSION: 6 };

export function scoreGame(state: GameState) {
  const truth = postureSpecs[state.posture].values;
  const error = CHIP_IDS.reduce((sum, chip) => sum + (state.playerEstimates[chip] ? Math.abs(guessValue[state.playerEstimates[chip]!] - truth[chip]) : 2.5), 0);
  const read = Math.round(Math.max(0, 100 - (error / 20) * 100));
  const spent = state.offered.reduce((sum, chip) => sum + (state.delivery[chip] === "partial" ? chips.find((item) => item.id === chip)!.costValue * 0.65 : chips.find((item) => item.id === chip)!.costValue), 0);
  const wonValue = state.won.reduce((sum, prize) => sum + prizeValue[prize], 0);
  const price = Math.round(Math.max(0, Math.min(100, spent === 0 ? (wonValue ? 100 : 52) : (wonValue / spent) * 68)));
  const waited = state.postponementAccepted === false;
  const finalHeld = state.finalDecision === "let_hit" || state.finalDecision === "call_bluff" || state.finalDecision === "counter";
  let nerve = 50;
  nerve += (waited === (state.beliefs.waitingHelps >= 50)) ? 25 : -25;
  nerve += (finalHeld === (state.beliefs.willImpose < 50)) ? 25 : -25;
  nerve = Math.max(0, Math.min(100, nerve));
  const total = Math.round(read * 0.4 + price * 0.4 + nerve * 0.2);
  return { read, price, nerve, total, spent: Math.round(spent * 10) / 10 };
}

export function archetype(state: GameState) {
  if (Object.values(state.delivery).includes("failed")) return { name: "THE EMPTY HAND", copy: "You spent a chip Washington could not receive. The offer became a permanent discount on your credibility." };
  if (state.finalDecision === "call_bluff" && state.posture === "SQUEEZE" && state.tariffsLanded) return { name: "THE STRAIGHT SPINE", copy: "You read the pressure and refused to buy peace. The hit was real; the price was still yours to refuse." };
  if (state.finalDecision === "call_bluff" && state.posture === "BROADCASTER" && !state.tariffsLanded) return { name: "THE BLUFF-CALLER", copy: "They needed an announcement more than they needed the tariff. You made them prove it." };
  if (state.offered.length === 0 && state.tariffsLanded) return { name: "THE PATRIOT", copy: "You protected every sensitive position and let $20 billion enter the tariff regime. Your error was treating every concession as equally costly." };
  const score = scoreGame(state);
  if (score.read >= 60 && score.price >= 60) return { name: "THE CHEAP CONCESSION", copy: "You found the gap between what Washington valued and what Canada could afford." };
  if (score.read >= 60) return { name: "THE OVERPAYER", copy: "You knew what it was worth and paid anyway." };
  if (score.price >= 60) return { name: "THE LUCKY HAND", copy: "The package worked. Your read did not fully explain why." };
  return { name: "THE MARK", copy: "You gave them the thing they would have traded away." };
}

export function valueLabel(value: number) { return value >= 5 ? "highest" : value >= 3 ? "medium" : "low"; }
export function chipLabel(chip: Chip) { return chips.find((item) => item.id === chip)?.label ?? chip; }
export function finalPackageText(state: GameState) {
  const value = deliveredValue(state);
  if (state.posture === "SQUEEZE" && !state.offered.includes("USMCA_PROCESS")) return "Ninety days of 338 relief. No movement on any Section 232 measure. Formal USMCA rounds remain the price of further talks.";
  if (state.posture === "DETROIT" && state.offered.includes("AUTO_SURTAX")) return "Withdrawal of the 338 action, with a narrow opening on the 25% auto tariff. Canada’s delivered package remains on the table.";
  if (value >= 6) return "Withdrawal of the 338 action and conditional steel and aluminum relief. Every delivered Canadian commitment becomes part of the record.";
  return "Withdrawal or postponement of the 338 action, depending on delivery. No broader 232 settlement is guaranteed.";
}
