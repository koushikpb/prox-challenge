'use client';

import type { ManualSource } from '@/streaming';
import { cn } from '@/lib/utils';

import { RenderArtifact } from '@/components/artifacts';

import { CitationCard } from './Citation';
import { MarkdownContent } from './MarkdownContent';
import { ToolChip } from './ToolChip';
import type { AssistantMessage, ChatMessageRecord, CitationRef } from './types';
import { stripCitationMarkers } from './utils';

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
  const hasChips = message.toolCalls.length > 0;
  const displayContent = stripCitationMarkers(message.content);
  const dedupedCitations = dedupeCitations(message.citations);
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
        {hasChips && !message.done && (
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
              <p className="leading-relaxed text-muted-foreground">…</p>
            )}
          </div>
        )}

        {message.artifacts.length > 0 && (
          <div className="space-y-2">
            {message.artifacts.map((artifact, idx) => (
              <RenderArtifact key={`${artifact.type}-${idx}`} payload={artifact} />
            ))}
          </div>
        )}

        {dedupedCitations.length > 0 && message.done && (
          <div
            className="rounded-md border border-border/60 bg-muted/40 px-2 py-1.5"
            data-slot="citations-footer"
          >
            <div className="mb-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Sources
            </div>
            <div className="flex flex-wrap gap-1.5">
              {dedupedCitations.map((c) => (
                <CitationCard
                  key={`${c.source}-${c.page}`}
                  page={c.page}
                  source={c.source}
                  onOpen={onOpenCitation}
                />
              ))}
            </div>
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

        {hasChips && message.done && (
          <details className="group text-xs" data-slot="tool-chips-disclosure">
            <summary className="cursor-pointer list-none text-muted-foreground hover:text-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="transition-transform group-open:rotate-90">▸</span>
                Show steps ({message.toolCalls.length})
              </span>
            </summary>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {message.toolCalls.map((call) => (
                <ToolChip key={call.id} call={call} />
              ))}
            </div>
          </details>
        )}

        {!message.done && message.content.length === 0 && message.toolCalls.length === 0 && (
          <p className="text-xs text-muted-foreground">Thinking…</p>
        )}
      </div>
    </div>
  );
}

function dedupeCitations(citations: CitationRef[]): CitationRef[] {
  const seen = new Set<string>();
  const out: CitationRef[] = [];
  for (const c of citations) {
    const key = `${c.source}::${c.page}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}
