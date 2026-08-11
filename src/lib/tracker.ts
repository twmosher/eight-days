type TrackOptions = { gameSlug: string; gameVersion: string; campaignCode?: string; endpoint?: string };

export function createTracker(options: TrackOptions) {
  const sessionKey = `jts_session_${options.gameSlug}`;
  const id = () => crypto.randomUUID();
  const get = (key: string) => localStorage.getItem(key) ?? "";
  const ensure = (key: string) => { const existing = get(key); if (existing) return existing; const value = id(); localStorage.setItem(key, value); return value; };
  const visitorId = () => {
    const existing = document.cookie.split("; ").find((item) => item.startsWith("jts_visitor_id="))?.split("=")[1];
    if (existing) return existing;
    const value = id();
    document.cookie = `jts_visitor_id=${value}; Domain=.judgethesituation.com; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
    return value;
  };
  let sequence = 0;
  return function track(eventName: string, properties: Record<string, unknown> = {}) {
    sequence += 1;
    const payload = { eventId: id(), eventName, visitorId: visitorId(), sessionId: ensure(sessionKey), gameSlug: options.gameSlug, gameVersion: options.gameVersion, campaignCode: options.campaignCode ?? new URLSearchParams(location.search).get("jts_campaign") ?? undefined, occurredAt: new Date().toISOString(), sequenceNumber: sequence, properties };
    const endpoint = options.endpoint ?? "https://judgethesituation.com/api/events";
    const body = JSON.stringify(payload);
    if (!navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }))) void fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
  };
}
