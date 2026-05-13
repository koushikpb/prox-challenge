'use client';

import type { ManualSource } from '@/streaming';
import { cn } from '@/lib/utils';

import { RenderArtifact } from '@/components/artifacts';

import { MarkdownContent } from './MarkdownContent';
import { ToolChip } from './ToolChip';
import type { AssistantMessage, ChatMessageRecord } from './types';
import { stripCitationMarkers } from './utils';

type MessageProps = {
  message: ChatMessageRecord;
  onOpenCitation: (page: number, source: ManualSource) => void;
  showSteps?: boolean;
};

export function Message({ message, onOpenCitation, showSteps = true }: MessageProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end" data-slot="message" data-role="user">
        <div className="max-w-[85%] rounded-3xl bg-zinc-800/60 px-4 py-2.5 text-sm text-white shadow-[inset_0_1px_0_oklch(1_0_0/0.04)]">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <AssistantBubble
      message={message}
      onOpenCitation={onOpenCitation}
      showSteps={showSteps}
    />
  );
}

function AssistantBubble({
  message,
  onOpenCitation,
  showSteps,
}: {
  message: AssistantMessage;
  onOpenCitation: (page: number, source: ManualSource) => void;
  showSteps: boolean;
}) {
  const isClarification = message.kind === 'clarification';
  const hasChips = message.toolCalls.length > 0;
  const displayContent = stripCitationMarkers(message.content);
  return (
    <div data-slot="message" data-role="assistant" data-kind={message.kind}>
      <div
        className={cn(
          'rounded-3xl border bg-panel px-5 py-4 text-sm text-zinc-200 shadow-[inset_0_1px_0_oklch(1_0_0/0.05)] backdrop-blur',
          'border-white/[0.07]',
          isClarification && 'border-amber-500/30 bg-amber-500/[0.04] text-amber-50',
        )}
        data-slot="assistant-panel"
      >
        <div className="space-y-3">
          {showSteps && hasChips && !message.done && (
            <div className="flex flex-wrap gap-1.5" data-slot="tool-chips-live">
              {message.toolCalls.map((call) => (
                <ToolChip key={call.id} call={call} />
              ))}
            </div>
          )}

          {(displayContent.length > 0 || message.done) && (
            <div data-slot="assistant-prose">
              {displayContent.length > 0 ? (
                <MarkdownContent text={displayContent} />
              ) : (
                <p className="leading-relaxed text-zinc-500">…</p>
              )}
            </div>
          )}

          {message.artifacts.length > 0 && (
            <div className="space-y-3 pt-1">
              {message.artifacts.map((artifact, idx) => (
                <RenderArtifact
                  key={`${artifact.type}-${idx}`}
                  payload={artifact}
                  onOpenPage={onOpenCitation}
                />
              ))}
            </div>
          )}

          {message.errors.map((err, idx) => (
            <div
              key={`err-${idx}`}
              className="rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-xs text-red-300"
              role="alert"
            >
              {err}
            </div>
          ))}

          {!message.done && message.content.length === 0 && message.toolCalls.length === 0 && (
            <p className="text-xs text-zinc-500">Thinking…</p>
          )}
        </div>
      </div>
    </div>
  );
}

