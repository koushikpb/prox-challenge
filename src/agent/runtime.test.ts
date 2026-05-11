import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { parseEvent, serializeEvent } from '@/streaming/parser';
import type { StreamEvent } from '@/streaming/types';
import type { StreamContext } from '@/streaming/sse';
import { streamAgentTurn, type AgentClient } from './runtime';

type ScriptedScenario =
  | { kind: 'text'; text: string; stopReason?: Anthropic.StopReason }
  | { kind: 'tool_use'; tool: string; input: Record<string, unknown>; text?: string };

function buildStreamEvents(scenario: ScriptedScenario): Anthropic.RawMessageStreamEvent[] {
  if (scenario.kind === 'text') {
    return [
      {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '', citations: [] },
      } as unknown as Anthropic.RawMessageStreamEvent,
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: scenario.text },
      } as unknown as Anthropic.RawMessageStreamEvent,
      {
        type: 'content_block_stop',
        index: 0,
      } as unknown as Anthropic.RawMessageStreamEvent,
      {
        type: 'message_delta',
        delta: { stop_reason: scenario.stopReason ?? 'end_turn', stop_sequence: null },
        usage: { output_tokens: 1 },
      } as unknown as Anthropic.RawMessageStreamEvent,
    ];
  }
  const events: Anthropic.RawMessageStreamEvent[] = [];
  let index = 0;
  if (scenario.text) {
    events.push(
      {
        type: 'content_block_start',
        index,
        content_block: { type: 'text', text: '', citations: [] },
      } as unknown as Anthropic.RawMessageStreamEvent,
      {
        type: 'content_block_delta',
        index,
        delta: { type: 'text_delta', text: scenario.text },
      } as unknown as Anthropic.RawMessageStreamEvent,
      {
        type: 'content_block_stop',
        index,
      } as unknown as Anthropic.RawMessageStreamEvent,
    );
    index++;
  }
  events.push(
    {
      type: 'content_block_start',
      index,
      content_block: { type: 'tool_use', id: `toolu_${index}`, name: scenario.tool, input: {} },
    } as unknown as Anthropic.RawMessageStreamEvent,
    {
      type: 'content_block_delta',
      index,
      delta: { type: 'input_json_delta', partial_json: JSON.stringify(scenario.input) },
    } as unknown as Anthropic.RawMessageStreamEvent,
    {
      type: 'content_block_stop',
      index,
    } as unknown as Anthropic.RawMessageStreamEvent,
    {
      type: 'message_delta',
      delta: { stop_reason: 'tool_use', stop_sequence: null },
      usage: { output_tokens: 1 },
    } as unknown as Anthropic.RawMessageStreamEvent,
  );
  return events;
}

type MockStream = AsyncIterable<Anthropic.RawMessageStreamEvent> & {
  controller: AbortController;
};

function makeStream(events: Anthropic.RawMessageStreamEvent[]): MockStream {
  return {
    controller: new AbortController(),
    async *[Symbol.asyncIterator]() {
      for (const event of events) yield event;
    },
  };
}

type ClientCall = {
  body: Anthropic.MessageStreamParams;
};

function makeMockClient(turns: ScriptedScenario[]): {
  client: AgentClient;
  calls: ClientCall[];
} {
  const calls: ClientCall[] = [];
  let i = 0;
  const stream = (body: Anthropic.MessageStreamParams) => {
    calls.push({ body });
    const scenario = turns[i++];
    if (!scenario) throw new Error('No more scripted turns');
    return makeStream(buildStreamEvents(scenario));
  };
  return {
    client: {
      messages: {
        stream,
      } as unknown as AgentClient['messages'],
    },
    calls,
  };
}

function collectCtx(): { ctx: StreamContext; events: StreamEvent[] } {
  const events: StreamEvent[] = [];
  const ctx: StreamContext = {
    emit: (event) => events.push(event),
    citePage: (page, source) => events.push({ type: 'citation', page, source }),
  };
  return { ctx, events };
}

describe('streamAgentTurn', () => {
  it('emits tool_call_start + tool_call_end when the model calls a strict-lookup tool', async () => {
    const { client } = makeMockClient([
      {
        kind: 'tool_use',
        tool: 'lookup_duty_cycle',
        input: { process: 'MIG', input_voltage: 240, amperage: 200 },
      },
      { kind: 'text', text: 'MIG at 240V / 200A runs 25% duty cycle (p. 7).' },
    ]);
    const { ctx, events } = collectCtx();

    await streamAgentTurn(
      { messages: [{ role: 'user', content: 'Duty cycle for MIG 240V 200A?' }] },
      ctx,
      { client },
    );

    const toolStart = events.find(
      (e) => e.type === 'tool_call_start' && e.tool === 'lookup_duty_cycle',
    );
    const toolEnd = events.find(
      (e) => e.type === 'tool_call_end' && e.tool === 'lookup_duty_cycle',
    );
    expect(toolStart).toBeDefined();
    expect(toolEnd).toBeDefined();
    expect((toolEnd as { ok: boolean }).ok).toBe(true);
    expect(events.some((e) => e.type === 'citation' && e.page === 7)).toBe(true);
  });

  it('streams a clarifying-question text turn without calling lookup tools', async () => {
    const { client, calls } = makeMockClient([
      {
        kind: 'text',
        text: 'Which welding process — MIG solid-core, flux-cored, TIG, or Stick?',
      },
    ]);
    const { ctx, events } = collectCtx();

    await streamAgentTurn(
      { messages: [{ role: 'user', content: 'What polarity?' }] },
      ctx,
      { client },
    );

    expect(events.some((e) => e.type === 'tool_call_start')).toBe(false);
    const finalText = events
      .filter((e): e is { type: 'text_delta'; delta: string } => e.type === 'text_delta')
      .map((e) => e.delta)
      .join('');
    expect(finalText.endsWith('?')).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('rejects a bad render_artifact payload at the input schema and continues without aborting', async () => {
    const { client } = makeMockClient([
      {
        kind: 'tool_use',
        tool: 'render_artifact',
        input: {
          type: 'polarity',
          process: 'TIG',
          ground_socket: 'Positive',
          electrode_socket: 'Negative',
          polarity_name: 'DCXY',
          source_page: 24,
        },
      },
      { kind: 'text', text: 'Sorry, I had a render hiccup. The TIG polarity is DCEN (p. 24).' },
    ]);
    const { ctx, events } = collectCtx();

    await streamAgentTurn(
      { messages: [{ role: 'user', content: 'Show me TIG polarity' }] },
      ctx,
      { client },
    );

    const end = events.find(
      (e) => e.type === 'tool_call_end' && e.tool === 'render_artifact',
    );
    expect(end).toBeDefined();
    expect((end as { ok: boolean }).ok).toBe(false);
    expect(events.some((e) => e.type === 'artifact')).toBe(false);
    expect(events.some((e) => e.type === 'text_delta' && e.delta.includes('hiccup'))).toBe(true);
  });

  it('emits an artifact event when render_artifact succeeds', async () => {
    const { client } = makeMockClient([
      {
        kind: 'tool_use',
        tool: 'render_artifact',
        input: {
          type: 'polarity',
          process: 'TIG',
          ground_socket: 'Positive',
          electrode_socket: 'Negative',
          polarity_name: 'DCEN',
          source_page: 24,
        },
      },
      { kind: 'text', text: 'TIG runs DCEN (p. 24).' },
    ]);
    const { ctx, events } = collectCtx();

    await streamAgentTurn(
      { messages: [{ role: 'user', content: 'TIG polarity?' }] },
      ctx,
      { client },
    );

    const artifact = events.find((e) => e.type === 'artifact');
    expect(artifact).toBeDefined();
    expect((artifact as { artifact: { type: string } }).artifact.type).toBe('polarity');
  });

  it('rejects bad tool input through zod validation and still returns a tool_result', async () => {
    const { client } = makeMockClient([
      {
        kind: 'tool_use',
        tool: 'lookup_duty_cycle',
        input: { process: 'MIG', input_voltage: 480, amperage: 200 },
      },
      { kind: 'text', text: 'Apologies — the welder is 120V or 240V only (p. 7).' },
    ]);
    const { ctx, events } = collectCtx();
    await streamAgentTurn(
      { messages: [{ role: 'user', content: 'MIG 480V 200A?' }] },
      ctx,
      { client },
    );
    const end = events.find((e) => e.type === 'tool_call_end' && e.tool === 'lookup_duty_cycle');
    expect((end as { ok: boolean }).ok).toBe(false);
  });

  it('every emitted event round-trips through serializeEvent → parseEvent', async () => {
    const { client } = makeMockClient([
      {
        kind: 'tool_use',
        tool: 'lookup_polarity',
        input: { process: 'TIG' },
      },
      { kind: 'text', text: 'TIG runs DCEN (p. 24).' },
    ]);
    const { ctx, events } = collectCtx();
    await streamAgentTurn(
      { messages: [{ role: 'user', content: 'TIG polarity?' }] },
      ctx,
      { client },
    );
    for (const event of events) {
      const wire = serializeEvent(event);
      const back = parseEvent(wire);
      expect(back).toEqual(event);
    }
  });

  it('honors AbortSignal mid-stream', async () => {
    const controller = new AbortController();
    const { client } = makeMockClient([{ kind: 'text', text: 'unused' }]);
    const events: StreamEvent[] = [];
    const ctx: StreamContext = {
      emit: (event) => events.push(event),
      citePage: () => undefined,
      signal: controller.signal,
    };
    controller.abort();
    await streamAgentTurn(
      { messages: [{ role: 'user', content: 'hello' }] },
      ctx,
      { client },
    );
    expect(events.length).toBe(0);
  });
});

describe('runtime mock helpers', () => {
  it('vi.mock is wired (sanity test for downstream route tests)', () => {
    expect(typeof vi.mock).toBe('function');
  });
});
