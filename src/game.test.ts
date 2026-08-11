import { describe, expect, it } from "vitest";
import { POSTURES, createInitialState, resolve, scoreGame, type GameState, type Posture } from "./game";

function seedFor(posture: Posture) {
  for (let index = 0; index < 10_000; index += 1) {
    const seed = `test-${index}`;
    if (createInitialState(seed).posture === posture) return seed;
  }
  throw new Error(`No seed found for ${posture}`);
}

function play(seed: string): GameState {
  let state = createInitialState(seed);
  state = resolve(state, { type: "SET_BELIEFS", willImpose: 55, waitingHelps: 60 });
  state = resolve(state, { type: "BUY_INTEL", card: "LEGAL_READ" });
  state = resolve(state, { type: "BUY_INTEL", card: "USTR_READOUT" });
  state = resolve(state, { type: "FINISH_INTEL" });
  state = resolve(state, { type: "TOGGLE_CHIP", chip: "AUTO_SURTAX" });
  state = resolve(state, { type: "TOGGLE_CHIP", chip: "USMCA_PROCESS" });
  state = resolve(state, { type: "SET_ESTIMATE", chip: "AUTO_SURTAX", guess: "high" });
  state = resolve(state, { type: "SUBMIT_OFFER" });
  state = resolve(state, { type: "ACK_COUNTER" });
  state = resolve(state, { type: "HANDLE_BACKFIRE", response: "limits" });
  state = resolve(state, { type: "RESPOND_POSTPONEMENT", accept: false });
  return resolve(state, { type: "FINAL_DECISION", decision: "accept" });
}

describe("EIGHT DAYS resolver", () => {
  it("maps the same seed to the same hidden posture and result", () => {
    expect(play("fixed-seed")).toEqual(play("fixed-seed"));
  });

  it.each(POSTURES)("completes a full run under %s", (posture) => {
    const state = play(seedFor(posture));
    expect(state.posture).toBe(posture);
    expect(state.phase).toBe("reveal");
    expect(state.outcome.length).toBeGreaterThan(20);
    expect(scoreGame(state).total).toBeGreaterThanOrEqual(0);
    expect(scoreGame(state).total).toBeLessThanOrEqual(100);
  });

  it("never allows more than three intelligence moves", () => {
    let state = resolve(createInitialState("intel-cap"), { type: "SET_BELIEFS", willImpose: 50, waitingHelps: 50 });
    for (const card of ["LEGAL_READ", "USTR_READOUT", "DETROIT_LINE", "PREMIERS_CALL"] as const) state = resolve(state, { type: "BUY_INTEL", card });
    expect(state.intelPurchased).toHaveLength(3);
    expect(state.daysRemaining).toBe(5);
  });

  it("supports authorizing nothing without inventing delivered chips", () => {
    let state = resolve(createInitialState("hold"), { type: "SET_BELIEFS", willImpose: 40, waitingHelps: 70 });
    state = resolve(state, { type: "FINISH_INTEL" });
    state = resolve(state, { type: "AUTHORIZE_NOTHING" });
    state = resolve(state, { type: "SUBMIT_OFFER" });
    expect(state.offered).toEqual([]);
    expect(state.delivery).toEqual({});
  });
});
