'use client';

import { ChatShell } from '@/components/chat/ChatShell';

import { mockStream } from './mockStream';

export default function ChatMockPage() {
  return (
    <main className="flex flex-1 flex-col">
      <ChatShell source={{ kind: 'generator', events: mockStream }} />
    </main>
  );
}
