# Vulcan OmniPro 220 Multimodal Welding Agent — Submission

## Live demo

- **Deployed app:** <https://prox-challenge-livid.vercel.app>
- **Repository:** <https://github.com/koushikpb/prox-challenge>
- **Submission commit:** _<<USER FILL: paste the SHA of the commit you submitted on>>_
- **Demo video:** _<<USER FILL: link to recorded walkthrough (Loom / YouTube / etc.)>>_

## What's in scope

An in-app assistant for the Harbor Freight Vulcan OmniPro 220 multiprocess welder, built on the Anthropic Claude Agent SDK in TypeScript and shipped as a single Next.js (App Router) app on Vercel. The agent answers grounded technical questions — duty cycle, polarity setup, process selection, troubleshooting, parts — by routing through 12 server-only tools (strict JSON lookups, manual search, page and region image surfaces, typed artifact renderers, and a generative wiring-diagram tool) and streams the response as prose + inline typed React artifacts, with every factual claim citing an owner-manual page. Users can attach photos (LCD readouts, outlets, weld defects) and the agent reasons over the image alongside the text query. Generated wiring diagrams are rendered client-side as SVGs from a validated node/edge payload — the model picks the layout, the renderer guarantees the safety of what reaches the DOM.

## How to run locally

```bash
git clone https://github.com/koushikpb/prox-challenge
cd prox-challenge
cp .env.example .env       # then set ANTHROPIC_API_KEY in .env
npm install
npm run dev                # http://localhost:3000
```

## Validation evidence

- Golden eval: 25/26 PASS on `main` (last run: 2026-05-21). Q16 (synergic-LCD reading) intermittently over-renders an artifact; it is on a small documented rotating-flake set (Q02 / Q15 / Q16 / Q18 / Q20) and re-runs typically rescue it. Q15 (the spatter-troubleshoot path) was the only structural regression we caught — fixed in commit `7ed89b7` and passes consistently.
- Vitest: 249/249 PASS.
- Typecheck + lint: 0 errors.
- Bundle hygiene: `ANTHROPIC_API_KEY` and `@anthropic-ai/sdk` both absent from `.next/static/` (server-only).

## Notes for the reviewer

- The three authoritative PDFs in `files/` are the only knowledge source — the agent refuses out-of-corpus questions rather than hallucinate.
- All structured data tables under `data/` are committed; reviewers do **not** re-run the extractor.
- Latency profile is documented in the README **Performance** paragraph — first SSE byte at ~240 ms warm, first text token at ~6.4 s warm uncached, cached replay <300 ms.
- Voice is a skeleton (`NEXT_PUBLIC_VOICE_ENABLED=true` exposes the composer affordance). No production STT/TTS wired.

## Prox form submission

- **Submitted on:** _<<USER FILL: date and time>>_
- **Confirmation reference:** _<<USER FILL: any confirmation ID / screenshot path from the submission form>>_
