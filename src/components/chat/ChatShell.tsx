'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpenIcon, EyeIcon, EyeOffIcon, SparklesIcon } from 'lucide-react';

import type { ManualSource } from '@/streaming';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useSpeech } from '@/components/voice/useSpeech';
import { cn } from '@/lib/utils';

import { Composer } from './Composer';
import { ManualViewer } from './ManualViewer';
import { MessageList } from './MessageList';
import { useChatSession, type ChatSource } from './useChatSession';
import { stripCitationMarkers } from './utils';

const SHOW_STEPS_STORAGE_KEY = 'prox.chat.showSteps';

type ChatShellProps = {
  source?: ChatSource;
  modelLabel?: string;
};

export function ChatShell({ source, modelLabel = 'vulcan-omnipro-220' }: ChatShellProps) {
  const { messages, isStreaming, send } = useChatSession({ source });
  const speech = useSpeech();
  const [speakerOn, setSpeakerOn] = useState(false);
  const spokenIdsRef = useRef<Set<string>>(new Set());

  const [showSteps, setShowSteps] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      return window.localStorage.getItem(SHOW_STEPS_STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(SHOW_STEPS_STORAGE_KEY, String(showSteps));
    } catch {
      // storage unavailable — non-fatal
    }
  }, [showSteps]);

  const [viewer, setViewer] = useState<{
    open: boolean;
    page: number | null;
    source: ManualSource | null;
  }>({ open: false, page: null, source: null });

  const openCitation = useCallback((page: number, source: ManualSource) => {
    setViewer({ open: true, page, source });
  }, []);

  const openManualHome = useCallback(() => {
    setViewer({ open: true, page: 1, source: 'owner-manual' });
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
            <span className="font-medium">Prox Coding Challenge Agent</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="hidden font-mono text-[0.7rem] tracking-tight text-zinc-500 sm:inline"
              aria-hidden
            >
              {modelLabel}
            </span>
            <button
              type="button"
              onClick={() => setShowSteps((prev) => !prev)}
              aria-pressed={showSteps}
              aria-label={showSteps ? 'Hide live steps' : 'Show live steps'}
              title={showSteps ? 'Hide live steps' : 'Show live steps'}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                showSteps
                  ? 'border-white/20 bg-white/[0.06] text-zinc-100 hover:bg-white/[0.1]'
                  : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-zinc-200',
              )}
              data-slot="show-steps-toggle"
              data-active={showSteps}
            >
              {showSteps ? (
                <EyeIcon className="size-3.5" aria-hidden />
              ) : (
                <EyeOffIcon className="size-3.5" aria-hidden />
              )}
              Steps
            </button>
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
          showSteps={showSteps}
        />
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
