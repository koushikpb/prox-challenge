import { afterEach, describe, expect, it } from 'vitest';
import { cacheGet, cacheKey, cacheReset, cacheSet, isCacheable, truncateArgsPreview } from './cache';
import type { StreamEvent } from './types';

afterEach(() => {
  cacheReset();
});

describe('cacheKey', () => {
  it('keys identical message tails to the same hash', () => {
    const a = cacheKey({ messages: [{ role: 'user', content: 'hello' }] });
    const b = cacheKey({ messages: [{ role: 'user', content: 'hello' }] });
    expect(a).toBe(b);
  });

  it('keys distinct message tails to different hashes', () => {
    const a = cacheKey({ messages: [{ role: 'user', content: 'hello' }] });
    const b = cacheKey({ messages: [{ role: 'user', content: 'goodbye' }] });
    expect(a).not.toBe(b);
  });

  it('uses only the last 4 messages', () => {
    const tail = [
      { role: 'user' as const, content: 'one' },
      { role: 'assistant' as const, content: 'two' },
      { role: 'user' as const, content: 'three' },
      { role: 'assistant' as const, content: 'four' },
    ];
    const a = cacheKey({ messages: tail });
    const b = cacheKey({ messages: [{ role: 'user', content: 'old' }, ...tail] });
    expect(a).toBe(b);
  });
});

describe('cacheGet / cacheSet', () => {
  it('replays the stored event sequence', () => {
    const events: StreamEvent[] = [
      { type: 'text_delta', delta: 'cached' },
      { type: 'done' },
    ];
    cacheSet('k1', events);
    expect(cacheGet('k1')).toEqual(events);
  });

  it('expires after TTL', () => {
    const now = 1_000_000;
    cacheSet('k1', [{ type: 'done' }], 1000, now);
    expect(cacheGet('k1', now + 500)).toBeTruthy();
    expect(cacheGet('k1', now + 2000)).toBeNull();
  });

  it('returns null on miss', () => {
    expect(cacheGet('never-written')).toBeNull();
  });
});

describe('isCacheable', () => {
  const okStrictLookup: StreamEvent[] = [
    { type: 'tool_call_start', tool: 'lookup_duty_cycle' },
    { type: 'tool_call_end', tool: 'lookup_duty_cycle', ok: true },
    { type: 'text_delta', delta: 'MIG at 240V / 200A runs 25% duty cycle (p. 7).' },
    { type: 'citation', page: 7, source: 'owner-manual' },
    { type: 'done' },
  ];

  it('caches a deterministic strict-lookup turn', () => {
    expect(isCacheable(okStrictLookup)).toBe(true);
  });

  it('does not cache a turn that ended with an error', () => {
    expect(
      isCacheable([
        ...okStrictLookup.slice(0, -1),
        { type: 'error', message: 'boom' },
        { type: 'done' },
      ]),
    ).toBe(false);
  });

  it('does not cache a turn with no strict lookup', () => {
    expect(
      isCacheable([
        { type: 'text_delta', delta: 'Just chatting.' },
        { type: 'done' },
      ]),
    ).toBe(false);
  });

  it('does not cache a clarifying-question turn', () => {
    expect(
      isCacheable([
        { type: 'text_delta', delta: 'Which welding process — MIG, TIG, or Stick?' },
        { type: 'done' },
      ]),
    ).toBe(false);
  });
});

describe('truncateArgsPreview', () => {
  it('truncates long inputs with an ellipsis', () => {
    const long = { query: 'x'.repeat(500) };
    const out = truncateArgsPreview(long, 80);
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.endsWith('…')).toBe(true);
  });

  it('returns short inputs unchanged', () => {
    const short = { process: 'MIG' };
    const out = truncateArgsPreview(short);
    expect(out).toBe(JSON.stringify(short));
  });
});
