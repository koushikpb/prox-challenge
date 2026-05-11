'use client';

import { useEffect, useRef } from 'react';

import type { ManualSource } from '@/streaming';

import { Message } from './Message';
import type { ChatMessageRecord } from './types';

type MessageListProps = {
  messages: ChatMessageRecord[];
  onOpenCitation: (page: number, source: ManualSource) => void;
};

export function MessageList({ messages, onOpenCitation }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex flex-1 items-center justify-center px-4 py-8 text-center text-sm text-muted-foreground"
      >
        Ask about MIG, TIG, or Stick setup on the Vulcan OmniPro 220.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
      data-slot="message-list"
    >
      {messages.map((message) => (
        <Message key={message.id} message={message} onOpenCitation={onOpenCitation} />
      ))}
    </div>
  );
}
