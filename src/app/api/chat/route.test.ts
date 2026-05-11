import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamContext } from '@/streaming/sse';
import { parseEvent } from '@/streaming/parser';
import { cacheReset } from '@/streaming/cache';
import { resetRateLimit, RATE_LIMIT_MAX_REQUESTS } from '@/streaming/rate-limit';
import type { StreamEvent } from '@/streaming/types';

const runtimeMock = vi.hoisted(() => ({
  streamAgentTurn: vi.fn(),
}));

vi.mock('@/agent/runtime', () => ({
  streamAgentTurn: runtimeMock.streamAgentTurn,
}));

import { POST } from './route';

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function collect(response: Response): Promise<StreamEvent[]> {
  const text = await response.text();
  return text
    .split(/\n\n/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => parseEvent(chunk + '\n\n'));
}

beforeEach(() => {
  cacheReset();
  resetRateLimit();
  runtimeMock.streamAgentTurn.mockReset();
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

describe('POST /api/chat', () => {
  it('returns error + done when ANTHROPIC_API_KEY is missing', async () => {
    const req = makeRequest({ messages: [{ role: 'user', content: 'hi' }] });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const events = await collect(res);
    expect(events[0]?.type).toBe('error');
    expect((events[0] as { message: string }).message).toMatch(/ANTHROPIC_API_KEY/i);
    expect(events.at(-1)?.type).toBe('done');
    expect(runtimeMock.streamAgentTurn).not.toHaveBeenCalled();
  });

  it('returns error + done when the body fails schema validation', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const req = makeRequest({ messages: [] });
    const events = await collect(await POST(req));
    expect(events[0]?.type).toBe('error');
    expect(events.at(-1)?.type).toBe('done');
  });

  it('calls the runtime and streams the captured events on a cache miss', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    runtimeMock.streamAgentTurn.mockImplementation(
      async (_req: unknown, ctx: StreamContext) => {
        ctx.emit({ type: 'tool_call_start', tool: 'lookup_duty_cycle' });
        ctx.emit({ type: 'tool_call_end', tool: 'lookup_duty_cycle', ok: true });
        ctx.emit({ type: 'text_delta', delta: 'MIG / 240V / 200A → 25% (p. 7).' });
        ctx.citePage(7, 'owner-manual');
      },
    );

    const req = makeRequest({ messages: [{ role: 'user', content: 'duty cycle?' }] });
    const events = await collect(await POST(req));
    expect(events.some((e) => e.type === 'tool_call_start')).toBe(true);
    expect(events.some((e) => e.type === 'citation' && e.page === 7)).toBe(true);
    expect(events.at(-1)?.type).toBe('done');
    expect(runtimeMock.streamAgentTurn).toHaveBeenCalledTimes(1);
  });

  it('replays the cache on a duplicate identical-tail request', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    runtimeMock.streamAgentTurn.mockImplementation(
      async (_req: unknown, ctx: StreamContext) => {
        ctx.emit({ type: 'tool_call_start', tool: 'lookup_polarity' });
        ctx.emit({ type: 'tool_call_end', tool: 'lookup_polarity', ok: true });
        ctx.emit({ type: 'text_delta', delta: 'TIG runs DCEN (p. 24).' });
      },
    );

    const body = { messages: [{ role: 'user', content: 'TIG polarity?' }] };
    await collect(await POST(makeRequest(body)));
    await collect(await POST(makeRequest(body)));

    expect(runtimeMock.streamAgentTurn).toHaveBeenCalledTimes(1);
  });

  it('emits error + done when the rate limit fires (no HTTP 429)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    runtimeMock.streamAgentTurn.mockImplementation(
      async (_req: unknown, ctx: StreamContext) => {
        ctx.emit({ type: 'text_delta', delta: `x${Math.random()}` });
      },
    );
    const headers = { 'x-forwarded-for': '9.9.9.9' };
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      const res = await POST(makeRequest({ messages: [{ role: 'user', content: `q${i}` }] }, headers));
      await res.text();
    }
    const blocked = await POST(makeRequest({ messages: [{ role: 'user', content: 'over' }] }, headers));
    expect(blocked.status).toBe(200);
    const events = await collect(blocked);
    expect((events[0] as { message: string }).message).toMatch(/Rate limit/i);
    expect(events.at(-1)?.type).toBe('done');
  });

  it('does not cache a turn that emitted an error', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    runtimeMock.streamAgentTurn.mockImplementation(
      async (_req: unknown, ctx: StreamContext) => {
        ctx.emit({ type: 'tool_call_start', tool: 'lookup_duty_cycle' });
        ctx.emit({ type: 'tool_call_end', tool: 'lookup_duty_cycle', ok: false });
        ctx.emit({ type: 'error', message: 'tool blew up' });
      },
    );
    const body = { messages: [{ role: 'user', content: 'duty cycle?' }] };
    await collect(await POST(makeRequest(body)));
    await collect(await POST(makeRequest(body)));
    expect(runtimeMock.streamAgentTurn).toHaveBeenCalledTimes(2);
  });
});
