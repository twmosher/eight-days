import { useEffect, useRef, useState } from "react";
import { createGameAnalytics } from "judgethesituation-analytics";
import intelData from "./data/intel.json";
import {
  CHIP_IDS, archetype, chipLabel, chips, createInitialState, finalPackageText,
  postureSpecs, randomFor, remiProfile, resolve, scoreGame, valueLabel,
  type Chip, type FinalDecision, type GameAction, type GameState, type IntelCard, type ValueGuess,
} from "./game";

const GAME_SLUG = "eight-days";
const GAME_VERSION = "1.0.0";
const analytics = createGameAnalytics({ gameSlug: GAME_SLUG, gameVersion: GAME_VERSION });
const prizeNames = {
  "338_POSTPONEMENT": "Section 338 postponed 90 days",
  "338_WITHDRAWAL": "Section 338 withdrawn",
  SA_RELIEF: "Steel & aluminum relief",
  AUTO_RELIEF: "Auto tariff relief",
  USMCA_EXTENSION: "USMCA extended",
} as const;
const roundNames: Record<GameState["phase"], string> = {
  desk: "The desk", intel: "Authorize intelligence", offer: "Authorize the package",
  counter: "The counter", backfire: "The backfire", postponement: "The postponement trap",
  final: "August 18 · 9:10 p.m.", reveal: "The record",
};

function makeSeed() {
  return new URLSearchParams(location.search).get("seed") || crypto.randomUUID().slice(0, 8);
}

function Header({ state }: { state: GameState }) {
  const phaseIndex = ["desk", "intel", "offer", "counter", "backfire", "postponement", "final", "reveal"].indexOf(state.phase);
  const completedRounds = Math.min(6, Math.max(0, phaseIndex));
  return <header className="masthead">
    <a className="wordmark" href="https://judgethesituation.com" aria-label="Judge the Situation home">JUDGE THE SITUATION</a>
    <div className="case-number">CASE 338–CA / v{GAME_VERSION}</div>
    <div className="progress" aria-label={`Game progress: ${completedRounds} of 6`}><span style={{ width: `${completedRounds / 6 * 100}%` }} /></div>
  </header>;
}

function Frame({ state, eyebrow, title, children }: { state: GameState; eyebrow?: string; title: string; children: React.ReactNode }) {
  return <main className={`document phase-${state.phase}`}>
    <Header state={state} />
    <section className="page-heading">
      <div><p className="eyebrow">{eyebrow ?? roundNames[state.phase]}</p><h1>{title}</h1></div>
      {state.phase !== "desk" && state.phase !== "reveal" && <div className="days"><strong>{state.daysRemaining}</strong><span>days remain</span></div>}
    </section>
    {children}
  </main>;
}

function Redaction({ revealed, text }: { revealed?: boolean; text?: string }) {
  return <span className={`redaction ${revealed ? "is-revealed" : ""}`}><span>{revealed ? text : "REDACTED"}</span></span>;
}

function Desk({ state, onBegin }: { state: GameState; onBegin: (willImpose: number, waitingHelps: number) => void }) {
  const [willImpose, setWillImpose] = useState(50);
  const [waitingHelps, setWaitingHelps] = useState(50);
  return <Frame state={state} eyebrow="Prime Minister’s Office · August 11, 2026 · 1:30 p.m. ET" title="Eight days">
    <p className="standfirst">In eight days, a <strong className="data">50%</strong> U.S. tariff lands on roughly <strong className="data">$20 billion</strong> of Canadian goods.</p>
    <div className="assessment"><span>ASSESSMENT — NEGOTIATING TEAM</span><p>You have five concessions. You know what each costs Canada. You do not know what any is worth to Washington. Some are not yours to deliver.</p></div>
    <div className="docket-title"><span>Schedule A</span><span>Canadian authorities available</span></div>
    <div className="chip-table">
      {chips.map((chip) => <article className="desk-chip" key={chip.id}>
        <div className="chip-index">{String(chips.indexOf(chip) + 1).padStart(2, "0")}</div>
        <div><h2>{chip.label}</h2><p>{chip.what}</p><dl><div><dt>Cost to Canada</dt><dd>{chip.cost}</dd></div><div><dt>Deliverability</dt><dd>{chip.deliverability}</dd></div><div><dt>Value to Washington</dt><dd><Redaction /></dd></div></dl></div>
      </article>)}
    </div>
    <details className="briefing"><summary>Open factual briefing · frozen August 11, 2026</summary><div>
      <p>Section 338 duties are scheduled for <strong className="data">12:01 a.m. ET, August 19</strong>. The additional duty is USMCA-blind and covers specified autos, alcohol, dairy and other goods.</p>
      <p>Canada seeks relief from the existing Section 232 wall. The reported negotiation includes auto counter-tariffs, dairy quota allocation, provincial alcohol listings, and a possible steel and aluminum export quota.</p>
      <p className="source-note">Scenario facts are frozen before the August 11 meeting. Hidden values are invented game state, randomized per playthrough.</p>
    </div></details>
    <section className="beliefs">
      <p className="section-label">Before you begin, your own read</p>
      <label><span>Probability Washington lets the tariffs land if Canada offers nothing</span><output>{willImpose}%</output><input type="range" min="0" max="100" step="1" value={willImpose} onChange={(e) => setWillImpose(Number(e.target.value))} /></label>
      <label><span>Probability Canada’s position improves by waiting</span><output>{waitingHelps}%</output><input type="range" min="0" max="100" step="1" value={waitingHelps} onChange={(e) => setWaitingHelps(Number(e.target.value))} /></label>
    </section>
    <button className="primary" onClick={() => onBegin(willImpose, waitingHelps)}>Open the file <span>→</span></button>
  </Frame>;
}

function intelFinding(state: GameState, id: IntelCard) {
  const truth = postureSpecs[state.posture];
  if (id === "DETROIT_LINE") return `Auto surtax: ${valueLabel(truth.values.AUTO_SURTAX)} value. S&A quota: ${valueLabel(truth.values.SA_QUOTA)} value.`;
  if (id === "SENATE_BACKCHANNEL") return `The cleanest announcement is ${chipLabel(truth.wanted).toLowerCase()}.`;
  if (id === "PREMIERS_CALL") return `The provincial path can now deliver at roughly ${Math.round((0.68 + randomFor(state.seed, "premiers:lift") * 0.17) * 100)}%.`;
  if (id === "DAIRY_CAUCUS") return "Full delivery remains costly. Retailer access can be delivered as a narrower, partial commitment.";
  if (id === "LEGAL_READ") return "Section 338 faces meaningful litigation exposure. A bluff call now rests on a reasoned legal edge.";
  return state.posture === "BROADCASTER" ? "The other side is working from an announcement grid, not treaty text." : state.posture === "DETROIT" ? "The readout is sector-specific: vehicle flows lead every exchange." : "The other side is working from a text. The drafting horizon extends beyond August 19.";
}

function Intel({ state, onBuy, onContinue }: { state: GameState; onBuy: (id: IntelCard) => void; onContinue: () => void }) {
  return <Frame state={state} title="Spend time to learn value">
    <p className="lede">You may spend up to three days. No file names the posture. Together, they narrow it.</p>
    <div className="intel-grid">{(intelData as {id: IntelCard; label: string; source: string; reveals: string}[]).map((card) => {
      const bought = state.intelPurchased.includes(card.id);
      return <button key={card.id} className={`intel-card ${bought ? "bought" : ""}`} disabled={bought || state.intelPurchased.length >= 3} onClick={() => onBuy(card.id)}>
        <span className="stamp">{bought ? "RECEIVED" : "1 DAY"}</span><h2>{card.label}</h2><p className="source">{card.source}</p>
        {bought ? <p className="finding"><strong>FINDING</strong>{intelFinding(state, card.id)}</p> : <p>{card.reveals}</p>}
      </button>;
    })}</div>
    <div className="action-row"><p><strong className="data">{state.intelPurchased.length}/3</strong> files authorized</p><button className="primary" onClick={onContinue}>Go to the table <span>→</span></button></div>
  </Frame>;
}

const guessLabels: Record<ValueGuess, string> = { low: "Low", medium: "Medium", high: "High" };
function Offer({ state, dispatch }: { state: GameState; dispatch: (action: GameAction) => void }) {
  const selected = state.offered;
  return <Frame state={state} eyebrow="Round 1 · Before 1:30 p.m." title="Authorize the package">
    <p className="lede">Put exactly two authorities on the table. First, mark your read of what Washington values.</p>
    <div className="offer-table" onDragOver={(e) => e.preventDefault()} onDrop={(e) => dispatch({ type: "TOGGLE_CHIP", chip: e.dataTransfer.getData("chip") as Chip })}>
      <div className="table-label">THE TABLE · {selected.length}/2</div>
      {selected.length === 0 ? <p className="drop-note">Drag or tap two chips to authorize them.</p> : selected.map((chip) => <button className="table-chip" key={chip} onClick={() => dispatch({ type: "TOGGLE_CHIP", chip })}>{chipLabel(chip)} <span>×</span></button>)}
    </div>
    <div className="offer-list">{chips.map((chip) => <article key={chip.id} draggable onDragStart={(e) => e.dataTransfer.setData("chip", chip.id)} className={`offer-chip ${selected.includes(chip.id) ? "selected" : ""}`}>
      <button className="chip-button" onClick={() => dispatch({ type: "TOGGLE_CHIP", chip: chip.id })} aria-pressed={selected.includes(chip.id)}><span><strong>{chip.label}</strong><small>{chip.cost} Canadian cost</small></span><span className="select-mark">{selected.includes(chip.id) ? "ON TABLE" : "ADD"}</span></button>
      <div className="estimate"><span>Your read</span>{(["low", "medium", "high"] as ValueGuess[]).map((guess) => <button key={guess} className={state.playerEstimates[chip.id] === guess ? "active" : ""} onClick={() => dispatch({ type: "SET_ESTIMATE", chip: chip.id, guess })}>{guessLabels[guess]}</button>)}</div>
    </article>)}</div>
    <button className={`nothing ${state.authorizedNothing ? "selected" : ""}`} onClick={() => dispatch({ type: "AUTHORIZE_NOTHING" })}><strong>Authorize nothing</strong><span>Demand a comprehensive package.</span></button>
    <button className="primary" disabled={!state.authorizedNothing && selected.length !== 2} onClick={() => dispatch({ type: "SUBMIT_OFFER" })}>Send authority to the room <span>→</span></button>
  </Frame>;
}

function Counter({ state, next }: { state: GameState; next: () => void }) {
  const spec = postureSpecs[state.posture];
  return <Frame state={state} eyebrow="Round 2 · The counter" title="Washington marks the paper">
    <div className="washington"><div className="side-label">WASHINGTON / RETURNED</div><p>{spec.tell}</p></div>
    <div className="assessment"><span>ASSESSMENT — USTR</span><p>{state.authorizedNothing ? "The demand for a comprehensive package has not produced a comprehensive answer. The other side is testing whether Canada will spend future leverage." : `The counter places the most weight on ${chipLabel(spec.wanted).toLowerCase()}. The rest is being split, discounted or held pending proof of delivery.`}</p></div>
    <div className="status-list">{state.authorizedNothing ? <div><span>Canadian offer</span><strong>None authorized</strong></div> : state.offered.map((chip) => <div key={chip}><span>{chipLabel(chip)}</span><strong>{state.delivery[chip] === "failed" ? "DELIVERY UNCONFIRMED" : state.delivery[chip] === "partial" ? "PARTIAL LANGUAGE" : spec.values[chip] >= 4 ? "ENGAGED" : "DISCOUNTED"}</strong></div>)}</div>
    <button className="primary" onClick={next}>Take the counter <span>→</span></button>
  </Frame>;
}

function backfireCopy(state: GameState) {
  if (state.offered.includes("ALCOHOL")) return "No province has agreed to be bound by a federal commitment on retail alcohol. Washington is treating the offer as unbacked.";
  if (state.offered.includes("DAIRY_TRQ")) return "The caucus arithmetic is on the desk. Full dairy language cannot move without a domestic price that was not in the opening authority.";
  if (state.authorizedNothing) return "The auto sector has asked publicly what the government plans to protect before August 19. The absence of an offer now carries a domestic cost.";
  return "Industry has identified the opening package as precedent, not a one-time exchange. The authority is deliverable; the domestic friction is now visible.";
}

function Backfire({ state, choose }: { state: GameState; choose: (response: "capital" | "substitute" | "limits" | "blame") => void }) {
  const substitute = chips.filter((chip) => !state.offered.includes(chip.id)).sort((a, b) => a.costValue - b.costValue)[0];
  return <Frame state={state} eyebrow="Round 3 · Domestic note" title="The offer comes home">
    <div className="assessment urgent"><span>ASSESSMENT — INTERGOVERNMENTAL</span><p>{backfireCopy(state)}</p></div>
    <p className="section-label">Authorize one response</p>
    <div className="decision-list">
      <button onClick={() => choose("capital")}><span>A</span><div><strong>Spend political capital</strong><small>Shore up the package · costs 2 capital</small></div></button>
      <button onClick={() => choose("substitute")}><span>B</span><div><strong>Substitute {substitute?.label ?? "another authority"}</strong><small>Put a cheaper unoffered chip into play</small></div></button>
      <button onClick={() => choose("limits")}><span>C</span><div><strong>State the limits of federal authority</strong><small>Protect credibility · concede no new authority</small></div></button>
      <button onClick={() => choose("blame")}><span>D</span><div><strong>Make the provincial failure public</strong><small>Clarify responsibility · costs 1 capital</small></div></button>
    </div>
  </Frame>;
}

function Postponement({ state, respond }: { state: GameState; respond: (accept: boolean) => void }) {
  const wanted = postureSpecs[state.posture].wanted;
  return <Frame state={state} eyebrow="Round 4 · August 15" title="Ninety days">
    <div className="washington offer-sheet"><div className="side-label">WITHOUT PREJUDICE</div><p><strong>Washington offers a 90-day postponement.</strong></p><p>Price: Canada delivers <span className="data">{chipLabel(wanted).toUpperCase()}</span> now. The Section 338 action remains available after the pause.</p></div>
    <blockquote><p>You put the probability that waiting improves Canada’s position at</p><strong>{state.beliefs.waitingHelps}%</strong><p>This offer costs you {chipLabel(wanted).toLowerCase()} to avoid 90 days of waiting.</p></blockquote>
    <div className="split-actions"><button className="secondary" onClick={() => respond(false)}>Refuse the pause</button><button className="primary" onClick={() => respond(true)}>Buy 90 days</button></div>
  </Frame>;
}

function Final({ state, seconds, decide }: { state: GameState; seconds: number; decide: (decision: FinalDecision) => void }) {
  return <Frame state={state} eyebrow="Round 5 · August 18 · 9:10 p.m." title="The final authority">
    <div className={`countdown ${seconds <= 10 ? "danger" : ""}`} aria-live="polite"><span>AUTHORITY EXPIRES</span><strong>00:{String(seconds).padStart(2, "0")}</strong></div>
    <div className="assessment"><span>ASSESSMENT — CLERK OF THE PRIVY COUNCIL</span><p>{finalPackageText(state)}</p></div>
    <p className="section-label">No advisers. No new intelligence.</p>
    <div className="final-grid">
      <button onClick={() => decide("accept")}><span>01</span><strong>Accept</strong><small>Take the package as written</small></button>
      <button onClick={() => decide("counter")}><span>02</span><strong>One final counter</strong><small>Spend one day and risk the package</small></button>
      <button onClick={() => decide("let_hit")}><span>03</span><strong>Let it hit</strong><small>Concede nothing else</small></button>
      <button onClick={() => decide("call_bluff")}><span>04</span><strong>Call the bluff</strong><small>Force Washington to choose</small></button>
    </div>
  </Frame>;
}

function Reveal({ state, onReplay, onShare, onFeedback }: { state: GameState; onReplay: () => void; onShare: () => void; onFeedback: (useful: boolean) => void }) {
  const score = scoreGame(state);
  const remi = remiProfile(state);
  const type = archetype(state);
  const truth = postureSpecs[state.posture].values;
  const failed = state.offered.find((chip) => state.delivery[chip] === "failed");
  const exact = CHIP_IDS.filter((chip) => state.playerEstimates[chip] && valueLabel(truth[chip]) === state.playerEstimates[chip]);
  return <Frame state={state} eyebrow="The record · Washington posture declassified" title={type.name}>
    <p className="archetype-copy">{type.copy}</p>
    <div className="posture-stamp"><span>HIDDEN POSTURE</span><strong>{state.posture}</strong></div>
    <section className="reveal-table"><div className="reveal-head"><span>Authority</span><span>Your read</span><span>Actual</span></div>
      {CHIP_IDS.map((chip, index) => <div className="reveal-row" key={chip} style={{ "--delay": `${index * 400}ms` } as React.CSSProperties}><strong>{chipLabel(chip)}</strong><span>{state.playerEstimates[chip] ?? "—"}</span><Redaction revealed text={valueLabel(truth[chip])} /></div>)}
    </section>
    <div className="reveal-notes"><p><strong>What you read:</strong> {exact.length ? `${exact.map(chipLabel).join(", ")} landed where you priced ${exact.length === 1 ? "it" : "them"}.` : "Your estimates never fully matched Washington’s private order."}</p><p><strong>What it cost:</strong> {failed ? `${chipLabel(failed)} failed at delivery after you had already made it negotiable.` : score.spent ? `You surrendered ${score.spent} weighted units of Canadian cost.` : "You surrendered no Canadian authority."}</p></div>
    <section className="score-block"><div className="total-score"><span>REMI STANDARD SCORE</span><strong>{remi.score}</strong><small>/100 · {remi.band}</small></div><div className="dimensions"><div><span>Read · 40%</span><strong>{score.read}</strong></div><div><span>Price · 40%</span><strong>{score.price}</strong></div><div><span>Nerve · 20%</span><strong>{score.nerve}</strong></div></div></section>
    <section className="remi-profile"><p className="section-label">Decision fingerprint</p><h2>{remi.fingerprint}</h2><p>{remi.portrait}</p><div className="trait-grid">{Object.entries(remi.traits).map(([trait, value]) => <div key={trait}><span>{trait}</span><strong>{value}</strong></div>)}</div><ul>{remi.evidence.map((item) => <li key={item}>{item}</li>)}</ul><small>REMI interprets choices made in this scenario. It is not a clinical or employment assessment.</small></section>
    <section className="outcome"><p className="section-label">Outcome · displayed, not scored</p><h2>{state.tariffsLanded ? "The tariffs landed." : "The tariffs did not land."}</h2><p>{state.outcome}</p><ul>{state.won.map((prize) => <li key={prize}>{prizeNames[prize]}</li>)}</ul></section>
    <section className="comparison"><p>{state.offered.includes("DAIRY_TRQ") ? "You surrendered dairy. 71% of seeded baseline players did." : "You held dairy. 29% of seeded baseline players did."}</p><p>{state.won.includes("SA_RELIEF") && !state.offered.includes("AUTO_SURTAX") ? "You held autos and got steel relief. 9% of seeded baseline players did." : "Only 9% of seeded baseline players held autos and still got steel relief."}</p><small>Comparisons use seeded launch baselines, not live player data.</small></section>
    <section className="epilogue"><p className="section-label">What actually happened</p><p>This scenario is frozen at <strong className="data">1:30 p.m. ET on August 11, 2026</strong>. Real events sit outside the score and never change the hidden posture.</p><a href="https://judgethesituation.com" target="_blank" rel="noreferrer">Read the current platform note ↗</a></section>
    <div className="result-actions"><button className="primary" onClick={onShare}>Share this run</button><button className="secondary" onClick={onReplay}>Play another posture</button></div>
    <div className="feedback"><span>Did the reveal change your read?</span><button onClick={() => onFeedback(true)}>Yes</button><button onClick={() => onFeedback(false)}>No</button></div>
  </Frame>;
}

export default function App() {
  const [state, setState] = useState(() => createInitialState(makeSeed()));
  const [seconds, setSeconds] = useState(45);
  const timedOut = useRef(false);
  const trackedResult = useRef(false);
  const elapsedStart = useRef(Date.now());

  useEffect(() => {
    analytics.trackOnce("landing_view", { seed: state.seed });
    analytics.trackOnce("game_impression", { seed: state.seed });
    const onError = () => analytics.track("error", { error_code: "window_error", abandonment_point: state.phase });
    window.addEventListener("error", onError);
    return () => window.removeEventListener("error", onError);
  // One impression per loaded playthrough.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.phase !== "final") return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === "final" && seconds === 0 && !timedOut.current) {
      timedOut.current = true;
      setState((current) => resolve(current, { type: "FINAL_DECISION", decision: "let_hit" }));
      analytics.track("round_complete", { round_number: 5, decision_id: "final_authority", choice_id: "timer_expired", elapsed_ms: 45000 });
      analytics.track("game_complete", { ending: "timer_expired", abandonment_point: "final_decision" });
    }
  }, [seconds, state.phase]);

  useEffect(() => {
    if (state.phase === "reveal" && !trackedResult.current) {
      trackedResult.current = true;
      const score = scoreGame(state);
      const remi = remiProfile(state);
      analytics.track("result_view", { score: score.total, remi_score: remi.score, remi_fingerprint: remi.possibilityKey, ending: archetype(state).name });
    }
  }, [state]);

  const dispatch = (action: GameAction) => setState((current) => resolve(current, action));
  const begin = (willImpose: number, waitingHelps: number) => {
    dispatch({ type: "SET_BELIEFS", willImpose, waitingHelps });
    analytics.track("game_start", { decision_id: "initial_beliefs", will_impose: willImpose, waiting_helps: waitingHelps });
    analytics.track("first_decision", { decision_id: "initial_beliefs", choice_id: `${willImpose}-${waitingHelps}`, elapsed_ms: Date.now() - elapsedStart.current });
    analytics.track("round_complete", { round_number: 0, elapsed_ms: Date.now() - elapsedStart.current });
  };
  const handle = (action: GameAction, round?: number, decisionId?: string, choiceId?: string) => {
    dispatch(action);
    if (round !== undefined) analytics.track("round_complete", { round_number: round, decision_id: decisionId ?? null, choice_id: choiceId ?? null, elapsed_ms: Date.now() - elapsedStart.current });
  };
  const decide = (decision: FinalDecision) => {
    dispatch({ type: "FINAL_DECISION", decision });
    analytics.track("round_complete", { round_number: 5, decision_id: "final_authority", choice_id: decision, elapsed_ms: (45 - seconds) * 1000 });
    analytics.track("game_complete", { ending: decision, elapsed_ms: Date.now() - elapsedStart.current });
  };
  const replay = () => {
    analytics.track("replay_start", { ending: archetype(state).name });
    const campaign = new URLSearchParams(location.search).get("jts_campaign");
    const seed = crypto.randomUUID().slice(0, 8);
    const params = new URLSearchParams({ seed });
    if (campaign) params.set("jts_campaign", campaign);
    history.replaceState(null, "", `?${params}`);
    analytics.newSession();
    elapsedStart.current = Date.now();
    setState(createInitialState(seed)); setSeconds(45); timedOut.current = false; trackedResult.current = false;
    analytics.trackOnce("landing_view", { seed, replay: true }); analytics.trackOnce("game_impression", { seed, replay: true });
    window.scrollTo(0, 0);
  };
  const share = async () => {
    const url = new URL(location.href); url.searchParams.set("seed", state.seed);
    const remi = remiProfile(state);
    analytics.track("share_click", { score: remi.score, remi_fingerprint: remi.possibilityKey, ending: archetype(state).name });
    const shareData = { title: `EIGHT DAYS — ${archetype(state).name}`, text: `My REMI score was ${remi.score}/100: ${remi.fingerprint}.`, url: url.toString() };
    try { if (navigator.share) await navigator.share(shareData); else await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`); } catch (error) { if ((error as Error).name !== "AbortError") analytics.track("error", { error_code: "share_failed" }); }
  };

  if (state.phase === "desk") return <Desk state={state} onBegin={begin} />;
  if (state.phase === "intel") return <Intel state={state} onBuy={(card) => dispatch({ type: "BUY_INTEL", card })} onContinue={() => dispatch({ type: "FINISH_INTEL" })} />;
  if (state.phase === "offer") return <Offer state={state} dispatch={(action) => action.type === "SUBMIT_OFFER" ? handle(action, 1, "opening_package", state.authorizedNothing ? "authorize_nothing" : state.offered.join("+")) : dispatch(action)} />;
  if (state.phase === "counter") return <Counter state={state} next={() => handle({ type: "ACK_COUNTER" }, 2, "counter_read", "acknowledge") } />;
  if (state.phase === "backfire") return <Backfire state={state} choose={(response) => handle({ type: "HANDLE_BACKFIRE", response }, 3, "domestic_response", response)} />;
  if (state.phase === "postponement") return <Postponement state={state} respond={(accept) => handle({ type: "RESPOND_POSTPONEMENT", accept }, 4, "postponement", accept ? "accept" : "refuse")} />;
  if (state.phase === "final") return <Final state={state} seconds={seconds} decide={decide} />;
  return <Reveal state={state} onReplay={replay} onShare={share} onFeedback={(useful) => analytics.track("feedback_submit", { decision_id: "reveal_changed_read", choice_id: useful ? "yes" : "no" })} />;
}
