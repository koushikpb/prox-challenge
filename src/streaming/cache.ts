import { createHash } from 'node:crypto';
import type { ChatMessage } from './client';
import type { StreamEvent } from './types';

export const RESPONSE_CACHE_TTL_MS = 60 * 60 * 1000;
const MESSAGES_TAIL_LEN = 4;
const TOOL_ARGS_KEY_MAX = 8;

type Entry = {
  events: StreamEvent[];
  expiresAt: number;
};

const cache = new Map<string, Entry>();

export type CacheKeyInput = {
  messages: ChatMessage[];
  toolArgs?: unknown;
};

export function cacheKey({ messages, toolArgs }: CacheKeyInput): string {
  const tail = messages.slice(-MESSAGES_TAIL_LEN).map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const payload = JSON.stringify({ messages_tail: tail, tool_args: toolArgs ?? null });
  return createHash('sha256').update(payload).digest('hex');
}

export function cacheGet(key: string, now: number = Date.now()): StreamEvent[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < now) {
    cache.delete(key);
    return null;
  }
  return entry.events;
}

export function cacheSet(
  key: string,
  events: StreamEvent[],
  ttlMs: number = RESPONSE_CACHE_TTL_MS,
  now: number = Date.now(),
): void {
  if (cache.size > 256) {
    for (const [k, e] of cache) {
      if (e.expiresAt < now) cache.delete(k);
    }
  }
  cache.set(key, { events, expiresAt: now + ttlMs });
}

export function cacheReset(): void {
  cache.clear();
}

export function isCacheable(events: StreamEvent[]): boolean {
  let strictLookups = 0;
  let endedWithError = false;
  let textContent = '';

  for (const event of events) {
    if (event.type === 'tool_call_end' && isStrictLookup(event.tool)) {
      if (event.ok) strictLookups++;
    } else if (event.type === 'text_delta') {
      textContent += event.delta;
    } else if (event.type === 'error') {
      endedWithError = true;
    }
  }

  if (endedWithError) return false;
  if (strictLookups < 1) return false;
  if (countClarifications(textContent) > 1) return false;
  return true;
}

function isStrictLookup(name: string): boolean {
  return name === 'lookup_duty_cycle' || name === 'lookup_polarity' || name === 'lookup_settings';
}

function countClarifications(text: string): number {
  // A clarification turn ends with a single question mark and is short.
  // We count message-final question marks within the first 240 chars.
  const head = text.slice(0, 240);
  return /\?\s*$/.test(head) ? 1 : 0;
}

export function truncateArgsPreview(args: unknown, max = 120): string {
  let s: string;
  try {
    s = JSON.stringify(args);
  } catch {
    s = String(args);
  }
  if (s.length > TOOL_ARGS_KEY_MAX * 32 && s.length > max) {
    return s.slice(0, max - 1) + '…';
  }
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
