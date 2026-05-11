'use client';

import { ChatShell } from '@/components/chat/ChatShell';

import { mockStream } from './mockStream';

export default function ChatMockPage() {
  return (
    <main className="flex flex-1 flex-col">
      <ChatShell
        title="Dev mock — scripted SSE stream"
        subtitle="Submit anything to drive the canned event sequence."
        source={{ kind: 'generator', events: mockStream }}
      />
    </main>
  );
}
