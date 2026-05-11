import { NextRequest } from 'next/server';
import { z } from 'zod';
import { streamAgentTurn } from '@/agent/runtime';
import { cacheGet, cacheKey, cacheSet, isCacheable } from '@/streaming/cache';
import { checkRateLimit } from '@/streaming/rate-limit';
import { replayEvents, streamResponse } from '@/streaming/sse';
import type { StreamEvent } from '@/streaming/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1),
      }),
    )
    .min(1),
  session_id: z.string().optional(),
});

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip') ?? 'unknown';
}

function streamSingleError(message: string): Response {
  return streamResponse(async (ctx) => {
    ctx.emit({ type: 'error', message });
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return streamSingleError('Request body was not valid JSON.');
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    return streamSingleError(`Request shape invalid — ${detail}.`);
  }

  const limit = checkRateLimit(clientIp(req));
  if (!limit.allowed) {
    return streamSingleError(
      `Rate limit exceeded — try again in ~${limit.retry_after_seconds ?? 60} seconds.`,
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return streamSingleError(
      'ANTHROPIC_API_KEY missing — set it in `.env` (or your Vercel project settings) to run the agent.',
    );
  }

  const key = cacheKey({ messages: parsed.data.messages });
  const hit = cacheGet(key);
  if (hit) return replayEvents(hit);

  return streamResponse(
    async (ctx) => {
      await streamAgentTurn(
        { messages: parsed.data.messages, ...(parsed.data.session_id ? { sessionId: parsed.data.session_id } : {}) },
        ctx,
      );
    },
    {
      signal: req.signal,
      onComplete: (events: StreamEvent[]) => {
        if (isCacheable(events)) cacheSet(key, events);
      },
    },
  );
}
