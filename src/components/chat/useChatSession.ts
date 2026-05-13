'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import type { ChatMessage, StreamEvent } from '@/streaming';
import { streamChat } from '@/streaming';

import type {
  AssistantMessage,
  ChatMessageRecord,
  ToolCallRecord,
  UserMessage,
} from './types';


let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${++idCounter}`;

const CLARIFICATION_PATTERN = /\?\s*$/;

export type ChatSource =
  | { kind: 'endpoint'; endpoint?: string }
  | { kind: 'generator'; events: () => AsyncIterable<StreamEvent> };

export type UseChatSessionOptions = {
  source?: ChatSource;
  sessionId?: string;
};

export type UseChatSession = {
  messages: ChatMessageRecord[];
  isStreaming: boolean;
  send: (text: string) => Promise<void>;
  cancel: () => void;
};

export function useChatSession(options: UseChatSessionOptions = {}): UseChatSession {
  const { source = { kind: 'endpoint' }, sessionId } = options;
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const updateAssistant = useCallback(
    (id: string, recipe: (draft: AssistantMessage) => AssistantMessage) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id && m.role === 'assistant' ? recipe(m) : m)),
      );
    },
    [],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0 || isStreaming) return;

      const userMsg: UserMessage = { id: nextId('u'), role: 'user', content: trimmed };
      const assistantId = nextId('a');
      const assistantMsg: AssistantMessage = {
        id: assistantId,
        role: 'assistant',
        kind: 'answer',
        content: '',
        toolCalls: [],
        citations: [],
        artifacts: [],
        errors: [],
        done: false,
      };

      const priorMessages = messages;
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const wireMessages: ChatMessage[] = [
        ...priorMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: trimmed },
      ];

      let stream: AsyncIterable<StreamEvent>;
      if (source.kind === 'generator') {
        stream = source.events();
      } else {
        stream = streamChat(
          { messages: wireMessages, session_id: sessionId },
          { signal: controller.signal, endpoint: source.endpoint },
        );
      }

      try {
        for await (const event of stream) {
          applyEvent(updateAssistant, assistantId, event);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        updateAssistant(assistantId, (draft) => ({
          ...draft,
          errors: [...draft.errors, message],
        }));
      } finally {
        updateAssistant(assistantId, (draft) => ({ ...draft, done: true }));
        if (abortRef.current === controller) abortRef.current = null;
        setIsStreaming(false);
      }
    },
    [isStreaming, messages, sessionId, source, updateAssistant],
  );

  return useMemo(
    () => ({ messages, isStreaming, send, cancel }),
    [messages, isStreaming, send, cancel],
  );
}

function applyEvent(
  update: (id: string, recipe: (draft: AssistantMessage) => AssistantMessage) => void,
  id: string,
  event: StreamEvent,
): void {
  switch (event.type) {
    case 'text_delta':
      update(id, (draft) => {
        const content = draft.content + event.delta;
        const kind = CLARIFICATION_PATTERN.test(content) && content.length < 240
          ? 'clarification'
          : 'answer';
        return { ...draft, content, kind };
      });
      return;
    case 'tool_call_start':
      update(id, (draft) => {
        const existingIdx = draft.toolCalls.findIndex(
          (c) => c.tool === event.tool && c.status === 'pending',
        );
        if (existingIdx !== -1) {
          const calls = [...draft.toolCalls];
          const existing = calls[existingIdx]!;
          calls[existingIdx] = {
            ...existing,
            argsPreview: event.args_preview ?? existing.argsPreview,
          };
          return { ...draft, toolCalls: calls };
        }
        const record: ToolCallRecord = {
          id: nextId('t'),
          tool: event.tool,
          argsPreview: event.args_preview,
          status: 'pending',
        };
        return { ...draft, toolCalls: [...draft.toolCalls, record] };
      });
      return;
    case 'tool_call_end':
      update(id, (draft) => {
        const calls = [...draft.toolCalls];
        const targetIdx = [...calls]
          .reverse()
          .findIndex((c) => c.tool === event.tool && c.status === 'pending');
        if (targetIdx === -1) return draft;
        const realIdx = calls.length - 1 - targetIdx;
        const existing = calls[realIdx]!;
        calls[realIdx] = { ...existing, status: event.ok ? 'ok' : 'error' };
        return { ...draft, toolCalls: calls };
      });
      return;
    case 'citation':
      update(id, (draft) => ({
        ...draft,
        citations: [...draft.citations, { page: event.page, source: event.source }],
      }));
      return;
    case 'artifact':
      update(id, (draft) => ({
        ...draft,
        artifacts: [...draft.artifacts, event.artifact],
      }));
      return;
    case 'error':
      update(id, (draft) => ({ ...draft, errors: [...draft.errors, event.message] }));
      return;
    case 'done':
      update(id, (draft) => ({ ...draft, done: true }));
      return;
  }
}
