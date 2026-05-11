'use client';

import type { ManualSource } from '@/streaming';
import { cn } from '@/lib/utils';

import { RenderArtifact } from '@/components/artifacts';

import { Citation } from './Citation';
import { ToolChip } from './ToolChip';
import type { AssistantMessage, ChatMessageRecord } from './types';

type MessageProps = {
  message: ChatMessageRecord;
  onOpenCitation: (page: number, source: ManualSource) => void;
};

export function Message({ message, onOpenCitation }: MessageProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
          data-slot="message"
          data-role="user"
        >
          {message.content}
        </div>
      </div>
    );
  }
  return <AssistantBubble message={message} onOpenCitation={onOpenCitation} />;
}

function AssistantBubble({
  message,
  onOpenCitation,
}: {
  message: AssistantMessage;
  onOpenCitation: (page: number, source: ManualSource) => void;
}) {
  const isClarification = message.kind === 'clarification';
  return (
    <div className="flex justify-start" data-slot="message" data-role="assistant" data-kind={message.kind}>
      <div
        className={cn(
          'max-w-[85%] space-y-2 rounded-2xl rounded-bl-sm border px-3 py-2 text-sm',
          isClarification
            ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100'
            : 'border-border bg-card text-card-foreground',
        )}
      >
        {message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.toolCalls.map((call) => (
              <ToolChip key={call.id} call={call} />
            ))}
          </div>
        )}

        {(message.content.length > 0 || message.done) && (
          <p className="whitespace-pre-wrap leading-relaxed">
            {message.content || <span className="text-muted-foreground">…</span>}
            {message.citations.length > 0 && (
              <span className="ml-1 inline-flex gap-0.5 align-text-top">
                {message.citations.map((c, i) => (
                  <Citation
                    key={`${c.source}-${c.page}-${i}`}
                    index={i + 1}
                    page={c.page}
                    source={c.source}
                    onOpen={onOpenCitation}
                  />
                ))}
              </span>
            )}
          </p>
        )}

        {message.artifacts.length > 0 && (
          <div className="space-y-2">
            {message.artifacts.map((artifact, idx) => (
              <RenderArtifact key={`${artifact.type}-${idx}`} payload={artifact} />
            ))}
          </div>
        )}

        {message.errors.map((err, idx) => (
          <div
            key={`err-${idx}`}
            className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive"
            role="alert"
          >
            {err}
          </div>
        ))}

        {!message.done && message.content.length === 0 && message.toolCalls.length === 0 && (
          <p className="text-xs text-muted-foreground">Thinking…</p>
        )}
      </div>
    </div>
  );
}
