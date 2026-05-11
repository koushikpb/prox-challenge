import { parseEvent, StreamParseError } from './parser';
import type { StreamEvent } from './types';

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatRequest = {
  messages: ChatMessage[];
  session_id?: string;
};

export type StreamChatOptions = {
  signal?: AbortSignal;
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

const DEFAULT_ENDPOINT = '/api/chat';

export async function* streamChat(
  request: ChatRequest,
  opts: StreamChatOptions = {},
): AsyncGenerator<StreamEvent, void, void> {
  const endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
  const fetchImpl = opts.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(request),
      signal: opts.signal,
    });
  } catch (err) {
    if (isAbortError(err)) return;
    yield {
      type: 'error',
      message: `Network error contacting ${endpoint}: ${errorMessage(err)}`,
    };
    return;
  }

  if (!response.ok) {
    yield {
      type: 'error',
      message: `Chat endpoint returned ${response.status} ${response.statusText}`,
    };
    return;
  }

  if (!response.body) {
    yield { type: 'error', message: 'Chat endpoint returned an empty response body' };
    return;
  }

  yield* readEventStream(response.body, opts.signal);
}

export async function* readEventStream(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent, void, void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const onAbort = () => {
    void reader.cancel().catch(() => undefined);
  };
  if (signal) {
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (err) {
        if (isAbortError(err) || signal?.aborted) return;
        yield { type: 'error', message: `Stream read failed: ${errorMessage(err)}` };
        return;
      }
      if (chunk.done) {
        buffer += decoder.decode();
        for (const event of drainBuffer(buffer, true)) yield event;
        return;
      }
      buffer += decoder.decode(chunk.value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const record = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = safeParse(record);
        if (event) yield event;
        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    if (signal) signal.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}

function* drainBuffer(buffer: string, atEnd: boolean): Generator<StreamEvent, void, void> {
  let working = buffer;
  let boundary = working.indexOf('\n\n');
  while (boundary !== -1) {
    const record = working.slice(0, boundary);
    working = working.slice(boundary + 2);
    const event = safeParse(record);
    if (event) yield event;
    boundary = working.indexOf('\n\n');
  }
  if (atEnd) {
    const trailing = working.trim();
    if (trailing.length > 0) {
      const event = safeParse(trailing);
      if (event) yield event;
    }
  }
}

function safeParse(record: string): StreamEvent | null {
  const trimmed = record.trim();
  if (trimmed.length === 0) return null;
  try {
    return parseEvent(trimmed);
  } catch (err) {
    if (err instanceof StreamParseError) {
      return { type: 'error', message: err.message };
    }
    return { type: 'error', message: `Unexpected parser error: ${errorMessage(err)}` };
  }
}

function isAbortError(err: unknown): boolean {
  return (
    err instanceof DOMException && (err.name === 'AbortError' || err.code === DOMException.ABORT_ERR)
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
