'use client';

import { useCallback, useState } from 'react';

import type { ManualSource } from '@/streaming';

import { Composer } from './Composer';
import { ManualViewer } from './ManualViewer';
import { MessageList } from './MessageList';
import { useChatSession, type ChatSource } from './useChatSession';

type ChatShellProps = {
  source?: ChatSource;
  title?: string;
  subtitle?: string;
};

export function ChatShell({
  source,
  title = 'Vulcan OmniPro 220 Assistant',
  subtitle = 'Grounded answers from the Harbor Freight owner manual.',
}: ChatShellProps) {
  const { messages, isStreaming, send } = useChatSession({ source });
  const [viewer, setViewer] = useState<{
    open: boolean;
    page: number | null;
    source: ManualSource | null;
  }>({ open: false, page: null, source: null });

  const openCitation = useCallback((page: number, source: ManualSource) => {
    setViewer({ open: true, page, source });
  }, []);

  const handleViewerChange = useCallback((open: boolean) => {
    setViewer((prev) => ({ ...prev, open }));
  }, []);

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col" data-slot="chat-shell">
      <header className="border-b px-4 py-3">
        <h1 className="font-heading text-base font-semibold">{title}</h1>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </header>
      <MessageList messages={messages} onOpenCitation={openCitation} />
      <Composer disabled={isStreaming} onSubmit={(text) => void send(text)} />
      <ManualViewer
        open={viewer.open}
        page={viewer.page}
        source={viewer.source}
        onOpenChange={handleViewerChange}
      />
    </div>
  );
}
