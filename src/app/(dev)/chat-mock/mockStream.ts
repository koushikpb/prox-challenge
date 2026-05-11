import type { StreamEvent } from '@/streaming';

const SCRIPT: ReadonlyArray<{ delayMs: number; event: StreamEvent }> = [
  { delayMs: 120, event: { type: 'tool_call_start', tool: 'lookup_duty_cycle', args_preview: '{"process":"MIG","input_voltage":240,"amperage":200}' } },
  { delayMs: 320, event: { type: 'text_delta', delta: 'Safety: keep your gas cylinder upright and capped while you adjust settings.\n\n' } },
  { delayMs: 220, event: { type: 'tool_call_end', tool: 'lookup_duty_cycle', ok: true } },
  { delayMs: 220, event: { type: 'text_delta', delta: 'At 200 A on 240 VAC the OmniPro 220 runs MIG at a 25% duty cycle — that\'s about 2.5 minutes of arc time per 10-minute window' } },
  { delayMs: 240, event: { type: 'citation', page: 7, source: 'owner-manual' } },
  { delayMs: 220, event: { type: 'text_delta', delta: ', then 7.5 minutes of rest before you go again. For continuous work, drop to 115 A and you can run the full 10 minutes.' } },
  { delayMs: 200, event: { type: 'done' } },
];

export async function* mockStream(): AsyncGenerator<StreamEvent, void, void> {
  for (const step of SCRIPT) {
    await new Promise((resolve) => setTimeout(resolve, step.delayMs));
    yield step.event;
  }
}
