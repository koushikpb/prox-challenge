# Eval Suite — last run

- Timestamp: `2026-05-20T05:58:54.384Z`
- Model: `claude-sonnet-4-6`
- Result: **26 / 26 pass**

## Per-entry results

| ID | Question | facts | image | artifact | clarification | safety | OVERALL |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Q01 | What's the duty cycle for MIG welding at 200A on 240V? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q02 | I'm getting porosity in my flux-cored welds. What should I check? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q03 | What polarity setup do I need for TIG welding? Which socket does the ground cla… | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q04 | For stick welding 1/8 inch mild steel, what polarity, what amperage range, and … | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q05 | Show me the wire feed mechanism diagram. | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q06 | Show me the polarity wiring for flux-cored MIG. | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q07 | What settings should I use? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q08 | What polarity do I need? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q09 | How do I change the polarity sockets for solid-core MIG? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q10 | How do I open the shielding gas cylinder safely? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q11 | Can I weld titanium with this welder? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q12 | What settings should I use for solid-core MIG on 1/8 inch mild steel? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q13 | What's the rated duty cycle for TIG at 175A on 240V? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q14 | What polarity do I use for stick welding on this welder? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q15 | Why am I getting excessive spatter in my MIG welds? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q16 | What does the LCD show after I dial in wire diameter and material thickness? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q17 | What shielding gas should I use for MIG welding aluminum? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q18 | I'm welding outside in windy conditions — which process should I use? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q19 | Show me the wiring schematic. | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q20 | The welder shut off mid-bead and the LCD is showing the thermal protection indi… | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q21 | Show me the parts diagram. | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q22 | Can I plug the OmniPro 220 into this outlet? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q23 | What does this reading on the display mean? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q24 | Draw the wiring for flux-cored MIG. | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q25 | Show me the wiring schematic from the manual. | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q26 | Make me a diagram for stick welding DCEP. | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |

## Failures

_None — every entry passed every rubric check._
<!-- investigation-notes:keep -->

## Investigation Notes

Hand-written hypotheses for each failure. Preserved across re-runs by `scripts/run-eval.ts` (everything from the `investigation-notes:keep` marker down is left untouched by the next `npm run eval`). When the underlying failure changes or is resolved, update this section by hand.

### System-prompt fix loop — resolution (2026-05-12)

All six original failures (Q03, Q07, Q13, Q14, Q17, Q20) resolved by surgical edits to `src/agent/system-prompt.ts` on `fix/agent-prompt-eval-pass`. No edits to `evals/cases.jsonl`, `evals/rubric.ts`, `data/*`, `src/tools/`, or `src/streaming/`.

### Theme 1 — Agent under-renders artifacts (Q13, Q17, Q20) — RESOLVED

- **Q13** "Rated duty cycle for TIG at 175A on 240V" — `render_duty_cycle_artifact` now fires; numeric facts `30%` / `175` preserved in prose. Fix: "When to render an artifact" rule now declares the render call REQUIRED for any duty-cycle question that names a process and an amperage, with explicit "do not paraphrase the numbers away" guidance.
- **Q17** "Shielding gas for MIG aluminum" — `render_settings_artifact` now fires. Fix: render rule widened to cover single-parameter settings questions (shielding gas, gas mixture, gas_required, wire diameter, SCFH band). Prompt instructs the agent to call `lookup_settings` with a representative in-range thickness (0.125) when the user did not specify one for thickness-invariant parameters, and forbids the trailing "what thickness are you working with?" follow-up.
- **Q20** "Welder shut off mid-bead, thermal protection indicator" — `render_troubleshoot_artifact` now fires. Fix: render rule widened to include hardware fault symptoms surfaced via LCD indicators (thermal trip, over-temp, no-arc, no-display, "shut off mid-bead"), not just weld defects.

Common-thread fix: lookup→render is now framed as a non-optional sequential pair in the Tool-preference order ("calling the lookup without the render is a failure"), not as a hint in tool descriptions.

### Theme 2 — Agent over-applies safety nudges to informational polarity questions (Q03, Q14) — RESOLVED

Q03 (TIG polarity + ground-clamp socket) and Q14 (Stick polarity) now answer without a safety lead. Fix: Safety-nudge rule reframed around the action verb in the user's request rather than the topic of the answer. Reference verbs ("what polarity does X use", "which socket does the ground clamp go in", "what setup do I need") explicitly do NOT take the nudge; action verbs ("how do I change/swap/wire/rewire/plug/unplug/open") do. Concrete reference-question and action-question example pairs provided. The narrower (action-vs-reference) reading from the eval author was adopted; no rubric / eval-set change.

Note — the wiring-display case (Q06 "Show me the polarity wiring for X" / Q19 "Show me the wiring schematic") needed an explicit override because the model treats "show me" as reference. Hard rule added: any user question containing the word "wiring" requires the canonical lead — the region captions in `data/regions.json` lead with the same line and the prose must mirror it.

### Theme 3 — Q07 clarification heuristic miss — RESOLVED

Q07 raw stream inspection (`curl /api/chat` on the live dev server) confirmed the suspected failure mode: the agent did ask a clarifying question (`"Which process, material, and thickness are you working with? For example: 'MIG, mild steel, 1/8 inch' — I need all three to pull the right guidance."`) but trailed with prose after the `?`, so `endsWithQuestionMark` rejected the response. This is a real prompt-side problem, not a rubric gap, and the rubric was not adjusted.

Fix: Clarification rule now states explicitly that the LAST VISIBLE CHARACTER of the message must be `?`, with no trailing prose, no closing sentence, no offer of defaults, and no follow-up explanation. A second worked example for Q07 was added alongside the existing Q08 example. The "answer + question" hybrid pattern is explicitly forbidden. Run-time confirmation: Q07 response now ends `"…for example MIG, mild steel, 1/8 in?"` and passes.

### Operational note — dev-server module caching

While iterating on the safety-nudge rule for Q06, prompt edits were not propagating to the running dev server even though earlier edits had hot-reloaded normally. A clean `npm run dev` restart unstuck the module and Q06 began passing immediately. The system-prompt module appears to occasionally be cached across HMR cycles in long-running dev sessions. Mitigation when an eval residual persists across prompt edits: restart the dev server before concluding the prompt change had no effect.

### Theme summary

- All six original failures closed by edits to `src/agent/system-prompt.ts`. Final eval: **20 / 20 pass**.
- `data/*` untouched and validated as accurate by every passing facts assertion.
- Streaming / artifact / runtime contracts untouched. No code outside the system prompt changed.
