import { describe, expect, it } from 'vitest';

import { readEventStream, streamChat } from './client';
import { serializeEvent } from './parser';
import type { StreamEvent } from './types';

function streamFrom(parts: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part));
      controller.close();
    },
  });
}

async function collect(gen: AsyncGenerator<StreamEvent>): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const ev of gen) out.push(ev);
  return out;
}

describe('readEventStream', () => {
  it('parses well-formed SSE records into typed events', async () => {
    const events: StreamEvent[] = [
      { type: 'text_delta', delta: 'Hello, ' },
      { type: 'text_delta', delta: 'world.' },
      { type: 'citation', page: 7, source: 'owner-manual' },
      { type: 'done' },
    ];
    const stream = streamFrom(events.map(serializeEvent));
    const collected = await collect(readEventStream(stream));
    expect(collected).toEqual(events);
  });

  it('reassembles records split across chunk boundaries', async () => {
    const wire = serializeEvent({ type: 'text_delta', delta: 'split' });
    const halfway = Math.floor(wire.length / 2);
    const stream = streamFrom([wire.slice(0, halfway), wire.slice(halfway)]);
    const collected = await collect(readEventStream(stream));
    expect(collected).toEqual([{ type: 'text_delta', delta: 'split' }]);
  });

  it('surfaces StreamParseError records as synthetic error events', async () => {
    const stream = streamFrom([
      'data: {"type":"text_delta","delta":"ok"}\n\n',
      'data: not-json\n\n',
      serializeEvent({ type: 'done' }),
    ]);
    const collected = await collect(readEventStream(stream));
    expect(collected).toHaveLength(3);
    expect(collected[0]).toEqual({ type: 'text_delta', delta: 'ok' });
    expect(collected[1]?.type).toBe('error');
    expect(collected[2]).toEqual({ type: 'done' });
  });

  it('drops empty records and flushes a final un-terminated record on end', async () => {
    const stream = streamFrom(['\n\n', 'data: {"type":"done"}']);
    const collected = await collect(readEventStream(stream));
    expect(collected).toEqual([{ type: 'done' }]);
  });
});

describe('streamChat', () => {
  it('emits an error event when fetch rejects', async () => {
    const fetchImpl = (() =>
      Promise.reject(new Error('boom'))) as unknown as typeof fetch;
    const collected = await collect(
      streamChat({ messages: [{ role: 'user', content: 'hi' }] }, { fetchImpl }),
    );
    expect(collected).toHaveLength(1);
    expect(collected[0]?.type).toBe('error');
    if (collected[0]?.type === 'error') {
      expect(collected[0].message).toContain('boom');
    }
  });

  it('emits an error event when the endpoint returns non-OK', async () => {
    const fetchImpl = (() =>
      Promise.resolve(
        new Response('nope', { status: 500, statusText: 'Internal Server Error' }),
      )) as unknown as typeof fetch;
    const collected = await collect(
      streamChat({ messages: [{ role: 'user', content: 'hi' }] }, { fetchImpl }),
    );
    expect(collected).toHaveLength(1);
    expect(collected[0]?.type).toBe('error');
    if (collected[0]?.type === 'error') {
      expect(collected[0].message).toContain('500');
    }
  });

  it('streams typed events from a streaming Response body', async () => {
    const events: StreamEvent[] = [
      { type: 'tool_call_start', tool: 'lookup_duty_cycle' },
      { type: 'tool_call_end', tool: 'lookup_duty_cycle', ok: true },
      { type: 'text_delta', delta: 'answer' },
      { type: 'done' },
    ];
    const body = streamFrom(events.map(serializeEvent));
    const fetchImpl = (() =>
      Promise.resolve(new Response(body, { status: 200 }))) as unknown as typeof fetch;
    const collected = await collect(
      streamChat({ messages: [{ role: 'user', content: 'hi' }] }, { fetchImpl }),
    );
    expect(collected).toEqual(events);
  });
});
