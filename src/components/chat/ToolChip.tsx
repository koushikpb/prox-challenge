import { CheckIcon, Loader2Icon, SparklesIcon, XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { ToolCallRecord } from './types';

type ToolChipProps = {
  call: ToolCallRecord;
};

export function ToolChip({ call }: ToolChipProps) {
  const { tool, status, argsPreview } = call;
  const label = humanize(tool);
  const isThinking = tool === 'thinking';
  return (
    <span
      data-slot="tool-chip"
      data-status={status}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium tracking-tight',
        status === 'pending' && 'border-white/10 bg-white/[0.04] text-zinc-400',
        status === 'ok' && 'border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-300',
        status === 'error' && 'border-red-400/30 bg-red-400/[0.08] text-red-300',
      )}
      title={argsPreview ?? tool}
    >
      {status === 'pending' &&
        (isThinking ? (
          <SparklesIcon className="size-3 animate-pulse" aria-hidden />
        ) : (
          <Loader2Icon className="size-3 animate-spin" aria-hidden />
        ))}
      {status === 'ok' &&
        (isThinking ? (
          <SparklesIcon className="size-3 animate-check-pop" aria-hidden />
        ) : (
          <CheckIcon className="size-3 animate-check-pop" aria-hidden />
        ))}
      {status === 'error' && <XIcon className="size-3" aria-hidden />}
      <span>{label}</span>
    </span>
  );
}

function humanize(tool: string): string {
  return tool.replace(/^lookup_/, '').replace(/_/g, ' ');
}
