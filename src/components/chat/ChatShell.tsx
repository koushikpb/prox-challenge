'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ManualSource } from '@/streaming';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useSpeech } from '@/components/voice/useSpeech';

import { Composer } from './Composer';
import { ManualViewer } from './ManualViewer';
import { MessageList } from './MessageList';
import { useChatSession, type ChatSource } from './useChatSession';
import { stripCitationMarkers } from './utils';

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
  const speech = useSpeech();
  const [speakerOn, setSpeakerOn] = useState(false);
  const spokenIdsRef = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    if (!speakerOn) return;
    if (!speech.supported.synthesis) return;
    for (const message of messages) {
      if (message.role !== 'assistant') continue;
      if (!message.done) continue;
      if (spokenIdsRef.current.has(message.id)) continue;
      spokenIdsRef.current.add(message.id);
      const text = stripCitationMarkers(message.content);
      if (text.length === 0) continue;
      speech.speak(text);
    }
  }, [messages, speakerOn, speech]);

  return (
    <TooltipProvider>
      <div className="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col" data-slot="chat-shell">
        <header className="border-b px-4 py-3">
          <h1 className="font-heading text-base font-semibold">{title}</h1>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </header>
        <MessageList messages={messages} onOpenCitation={openCitation} />
        <Composer
          disabled={isStreaming}
          onSubmit={(text) => void send(text)}
          speech={speech}
          speakerOn={speakerOn}
          onSpeakerToggle={setSpeakerOn}
        />
        <ManualViewer
          open={viewer.open}
          page={viewer.page}
          source={viewer.source}
          onOpenChange={handleViewerChange}
        />
      </div>
    </TooltipProvider>
  );
}
