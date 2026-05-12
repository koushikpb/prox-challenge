# Golden Eval — last run

- Timestamp: `2026-05-12T04:03:57.799Z`
- Model: `claude-sonnet-4-6`
- Result: **14 / 20 pass**

## Per-entry results

| ID | Question | facts | image | artifact | clarification | safety | OVERALL |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Q01 | What's the duty cycle for MIG welding at 200A on 240V? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q02 | I'm getting porosity in my flux-cored welds. What should I check? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q03 | What polarity setup do I need for TIG welding? Which socket does the ground cla… | ✓ | ✓ | ✓ | ✓ | ✗ | FAIL |
| Q04 | For stick welding 1/8 inch mild steel, what polarity, what amperage range, and … | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q05 | Show me the wire feed mechanism diagram. | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q06 | Show me the polarity wiring for flux-cored MIG. | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q07 | What settings should I use? | ✓ | ✓ | ✓ | ✗ | ✓ | FAIL |
| Q08 | What polarity do I need? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q09 | How do I change the polarity sockets for solid-core MIG? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q10 | How do I open the shielding gas cylinder safely? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q11 | Can I weld titanium with this welder? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q12 | What settings should I use for solid-core MIG on 1/8 inch mild steel? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q13 | What's the rated duty cycle for TIG at 175A on 240V? | ✗ | ✓ | ✗ | ✓ | ✓ | FAIL |
| Q14 | What polarity do I use for stick welding on this welder? | ✓ | ✓ | ✓ | ✓ | ✗ | FAIL |
| Q15 | Why am I getting excessive spatter in my MIG welds? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q16 | What does the LCD show after I dial in wire diameter and material thickness? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q17 | What shielding gas should I use for MIG welding aluminum? | ✓ | ✓ | ✗ | ✓ | ✓ | FAIL |
| Q18 | I'm welding outside in windy conditions — which process should I use? | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q19 | Show me the wiring schematic. | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Q20 | The welder shut off mid-bead and the LCD is showing the thermal protection indi… | ✓ | ✓ | ✗ | ✓ | ✓ | FAIL |

## Failures

### Q03 — What polarity setup do I need for TIG welding? Which socket does the ground clamp go in?
- Failing checks: safety

### Q07 — What settings should I use?
- Failing checks: clarification

### Q13 — What's the rated duty cycle for TIG at 175A on 240V?
- Failing checks: facts, artifact
- Missing facts: `30%`, `175`

### Q14 — What polarity do I use for stick welding on this welder?
- Failing checks: safety

### Q17 — What shielding gas should I use for MIG welding aluminum?
- Failing checks: artifact

### Q20 — The welder shut off mid-bead and the LCD is showing the thermal protection indicator — what do I do?
- Failing checks: artifact

<!-- investigation-notes:keep -->

## Investigation Notes

Hand-written hypotheses for each failure. Preserved across re-runs by `scripts/run-eval.ts` (everything from the `investigation-notes:keep` marker down is left untouched by the next `npm run eval`). When the underlying failure changes or is resolved, update this section by hand.

### Theme 1 — Agent under-renders artifacts (Q13, Q17, Q20)

Three grounded questions where the agent answered correctly in prose but did **not** call the corresponding `render_*_artifact` tool:

- **Q13** "What's the rated duty cycle for TIG at 175A on 240V?" — facts `30%` and `175` missing, artifact `duty_cycle` not emitted. Suggests the agent paraphrased without surfacing the numeric grounding (e.g., "around 30 percent for three minutes of weld time"). Hypothesis: the system prompt does not require a `render_duty_cycle_artifact` call when a numeric duty-cycle question is in scope.
- **Q17** "What shielding gas should I use for MIG welding aluminum?" — `settings` artifact not emitted. Agent answered in prose ("100% argon, spool gun required"). Hypothesis: gas-only questions don't trip the `render_settings_artifact` trigger in the prompt, even though `data/settings.json` is the canonical source.
- **Q20** "The welder shut off mid-bead … thermal protection indicator" — `troubleshoot` artifact not emitted. Agent likely gave a prose cool-down explanation. Hypothesis: troubleshoot artifact triggering is conditional on a specific failure-symptom keyword set that does not include "thermal protection indicator."

All three point at the same Stage 2 module: **`src/agent/prompts.ts` / `src/agent/runtime.ts`** — the system prompt that decides when to call the per-type render tools. The grounding tools fire correctly (facts present in Q17/Q20); only the render tools are skipped. Manager: candidate Stage 2 fix loop on the system prompt's "when to render an artifact" rule.

### Theme 2 — Agent over-applies safety nudges to informational polarity questions (Q03, Q14)

Q03 (TIG polarity + ground-clamp socket) and Q14 (Stick polarity) are read-only "what polarity do I use" questions. The eval marks them `expects_safety_nudge: false` because no physical action is requested — neither prompt asks the user to plug, unplug, or rewire. The agent nevertheless leads with a "Heads up: unplug …" line.

Hypothesis: the system prompt's safety-nudge instruction over-fires on the keyword `polarity` rather than on whether the user is being told to take a physical action. Defensible behavior — CLAUDE.md asks for safety leads on electrode/wire-contact topics — but the eval entries were written for the narrower "action vs. reference" reading. Two equally valid resolutions:

1. **Tighten the system prompt** so the safety nudge fires only when the answer instructs a physical step (unplug, swap, attach).
2. **Loosen these two eval entries** to `expects_safety_nudge: true`, accepting that any polarity question may surface a wiring nudge.

Recommend resolution (1) — the eval author explicitly described Q14 as "Informational query, no safety nudge required," and the same authorial intent applies to Q03. Manager decides.

### Theme 3 — Q07 clarification heuristic miss

Q07 "What settings should I use?" — `expects_clarification: true`, but the response did not end with `?`. The agent likely returned the clarification *and* a follow-up offer ("…or I can show you all the recommended starting points for mild steel"), or used an em-dash list of options that did not terminate in a question mark.

Hypothesis: the heuristic (`endsWithQuestionMark` after stripping `(p. N)`) is too narrow. The system prompt's example clarification (`Which welding process — MIG solid-core, flux-cored, TIG, or Stick?`) does end with `?` and passes Q08. Q07 is broader ("what settings") and the agent may be enumerating partial defaults. Two paths:

1. Inspect the actual Q07 stream — if the agent did ask a clarifying question but with trailing prose, the heuristic should also match `^(could you|what|which)…\?` near the end (within the last sentence) rather than strictly at the very end.
2. If the agent committed to an answer without asking, that's a real prompt regression — clarification rule failed.

I cannot determine which without the raw response. Recommend the Manager dispatch a short inspection of the Q07 stream before deciding.

### Theme summary

- Stage 2 (`src/agent/`) is the suspected source of all six failures.
- No Stage 1 (`data/*`) bug surfaced — every fact assertion that *did* pass confirms the underlying JSON is accurate.
- The rubric was tightened during this run (`checkImage` is now presence-only per the Task Prompt's "only enforces presence" language) and the test suite was updated to match.
