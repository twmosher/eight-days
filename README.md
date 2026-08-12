# EIGHT DAYS

A single-session, replayable negotiation game for [Judge the Situation](https://judgethesituation.com). You are the Canadian prime minister with eight days to price five concessions against one of four hidden Washington postures before a Section 338 tariff deadline.

## Local development

Requires Node.js 22 or later.

```bash
npm install
npm run dev
```

Use `?seed=example` for a deterministic posture. Incoming `jts_campaign` attribution is preserved when a player replays.

## Verification

```bash
npm run lint
npm test
npm run build
```

## Analytics

The client uses version `0.1.1` of the shared Judge the Situation analytics SDK and sends standardized events to `https://judgethesituation.com/api/events`. The release tarball is committed under `vendor/` so this repository remains independently installable. It does not contain Supabase credentials or collect names, email addresses, or raw IP addresses.

- Game slug: `eight-days`
- Game version: `1.0.0`
- Production origin: `https://eight-days.judgethesituation.com`

## Deployment

This is an independent Vite application. Vercel builds it with `npm run build` and serves `dist/`.
