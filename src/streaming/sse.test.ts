import { describe, expect, it } from 'vitest';
import { parseEvent } from './parser';
import { replayEvents, streamResponse } from './sse';
import type { StreamEvent } from './types';

async function consume(response: Response): Promise<StreamEvent[]> {
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')?.includes('text/event-stream')).toBe(true);
  const text = await response.text();
  return text
    .split(/\n\n/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => parseEvent(chunk + '\n\n'));
}

describe('streamResponse', () => {
  it('emits handler events plus a terminal done', async () => {
    const res = streamResponse(async (ctx) => {
      ctx.emit({ type: 'text_delta', delta: 'hi' });
    });
    const events = await consume(res);
    expect(events).toEqual([
      { type: 'text_delta', delta: 'hi' },
      { type: 'done' },
    ]);
  });

  it('catches handler rejection and emits error + done', async () => {
    const res = streamResponse(async () => {
      throw new Error('boom');
    });
    const events = await consume(res);
    expect(events).toEqual([
      { type: 'error', message: 'boom' },
      { type: 'done' },
    ]);
  });

  it('translates citePage into a citation event', async () => {
    const res = streamResponse(async (ctx) => {
      ctx.citePage(7, 'owner-manual');
    });
    const events = await consume(res);
    expect(events[0]).toEqual({ type: 'citation', page: 7, source: 'owner-manual' });
  });

  it('replayEvents passes through everything except done and appends a fresh done', async () => {
    const captured: StreamEvent[] = [
      { type: 'text_delta', delta: 'hi' },
      { type: 'citation', page: 7, source: 'owner-manual' },
      { type: 'done' },
    ];
    const res = replayEvents(captured);
    const events = await consume(res);
    expect(events).toEqual([
      { type: 'text_delta', delta: 'hi' },
      { type: 'citation', page: 7, source: 'owner-manual' },
      { type: 'done' },
    ]);
  });

  it('invokes onComplete with the captured event sequence', async () => {
    let captured: StreamEvent[] | undefined;
    const res = streamResponse(
      async (ctx) => {
        ctx.emit({ type: 'text_delta', delta: 'cached' });
      },
      {
        onComplete: (events) => {
          captured = events;
        },
      },
    );
    await consume(res);
    expect(captured).toBeDefined();
    expect(captured?.some((e) => e.type === 'text_delta' && e.delta === 'cached')).toBe(true);
    expect(captured?.[captured.length - 1]?.type).toBe('done');
  });
});
