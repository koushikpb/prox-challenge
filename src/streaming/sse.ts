import type { ManualSource, StreamEvent } from './types';
import { serializeEvent } from './parser';

export type StreamContext = {
  emit: (event: StreamEvent) => void;
  citePage: (page: number, source: ManualSource) => void;
  signal?: AbortSignal;
};

export type StreamHandler = (ctx: StreamContext) => Promise<void>;

export type StreamResponseOptions = {
  signal?: AbortSignal;
  onComplete?: (events: StreamEvent[]) => void;
};

const SSE_HEADERS: HeadersInit = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

export function streamResponse(handler: StreamHandler, opts: StreamResponseOptions = {}): Response {
  const encoder = new TextEncoder();
  const captured: StreamEvent[] = [];

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let doneEmitted = false;

      const safeClose = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const enqueue = (event: StreamEvent) => {
        if (closed) return;
        captured.push(event);
        try {
          controller.enqueue(encoder.encode(serializeEvent(event)));
        } catch {
          closed = true;
        }
      };

      const emit = (event: StreamEvent) => {
        if (event.type === 'done') {
          if (doneEmitted) return;
          doneEmitted = true;
        }
        enqueue(event);
      };

      const citePage: StreamContext['citePage'] = (page, source) => {
        emit({ type: 'citation', page, source });
      };

      const onAbort = () => {
        emit({ type: 'done' });
        safeClose();
      };
      if (opts.signal) {
        if (opts.signal.aborted) {
          onAbort();
          return;
        }
        opts.signal.addEventListener('abort', onAbort, { once: true });
      }

      try {
        await handler({ emit, citePage, signal: opts.signal });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        emit({ type: 'error', message });
      } finally {
        if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
        emit({ type: 'done' });
        safeClose();
        opts.onComplete?.(captured);
      }
    },
    cancel() {
      /* consumer disconnected */
    },
  });

  return new Response(body, { status: 200, headers: SSE_HEADERS });
}

export function replayEvents(events: StreamEvent[], opts: StreamResponseOptions = {}): Response {
  return streamResponse(async (ctx) => {
    for (const event of events) {
      if (event.type === 'done') continue;
      ctx.emit(event);
    }
  }, opts);
}
