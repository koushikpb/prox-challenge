'use client';

import { useCallback, useState } from 'react';
import { BookOpenIcon, SparklesIcon } from 'lucide-react';

import type { GeneratedDiagramArtifactPayload, ManualSource } from '@/streaming';
import { TooltipProvider } from '@/components/ui/tooltip';

import { Composer } from './Composer';
import { ManualViewer, type ManualViewerItem } from './ManualViewer';
import { MessageList } from './MessageList';
import { useChatSession, type ChatSource } from './useChatSession';

type ChatShellProps = {
  source?: ChatSource;
};

export function ChatShell({ source }: ChatShellProps) {
  const { messages, isStreaming, send } = useChatSession({ source });

  const [viewer, setViewer] = useState<{
    open: boolean;
    item: ManualViewerItem | null;
  }>({ open: false, item: null });

  const openCitation = useCallback((page: number, source: ManualSource) => {
    setViewer({ open: true, item: { kind: 'page', page, source } });
  }, []);

  const openManualHome = useCallback(() => {
    setViewer({
      open: true,
      item: { kind: 'page', page: 1, source: 'owner-manual' },
    });
  }, []);

  const openDiagram = useCallback(
    ({
      payload,
      title,
      subtitle,
    }: {
      payload: GeneratedDiagramArtifactPayload;
      title: string;
      subtitle?: string;
    }) => {
      setViewer({
        open: true,
        item: { kind: 'diagram', payload, title, subtitle },
      });
    },
    [],
  );

  const handleViewerChange = useCallback((open: boolean) => {
    setViewer((prev) => ({ ...prev, open }));
  }, []);

  return (
    <TooltipProvider>
      <div
        className="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col px-3 sm:px-6"
        data-slot="chat-shell"
      >
        <header
          className="flex items-center justify-between gap-3 px-1 pt-4 pb-3 sm:pt-6"
          data-slot="chat-header"
        >
          <div className="flex items-center gap-2 text-sm text-zinc-200">
            <span className="inline-flex size-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
              <SparklesIcon className="size-3.5 text-zinc-300" aria-hidden />
            </span>
            <span className="font-medium">Vulcan Omnipro 220 Agent</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openManualHome}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-zinc-300 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
              data-slot="manual-trigger"
            >
              <BookOpenIcon className="size-3.5" aria-hidden />
              Manual
            </button>
          </div>
        </header>

        <MessageList
          messages={messages}
          onOpenCitation={openCitation}
          onOpenDiagram={openDiagram}
        />
        <Composer disabled={isStreaming} onSubmit={(text) => void send(text)} />
        <ManualViewer open={viewer.open} item={viewer.item} onOpenChange={handleViewerChange} />
      </div>
    </TooltipProvider>
  );
}
