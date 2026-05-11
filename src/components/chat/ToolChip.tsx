import { CheckIcon, Loader2Icon, XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { ToolCallRecord } from './types';

type ToolChipProps = {
  call: ToolCallRecord;
};

export function ToolChip({ call }: ToolChipProps) {
  const { tool, status, argsPreview } = call;
  const label = humanize(tool);
  return (
    <span
      data-slot="tool-chip"
      data-status={status}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        status === 'pending' && 'border-border bg-muted text-muted-foreground',
        status === 'ok' && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
        status === 'error' && 'border-destructive/40 bg-destructive/10 text-destructive',
      )}
      title={argsPreview ?? tool}
    >
      {status === 'pending' && <Loader2Icon className="size-3 animate-spin" aria-hidden />}
      {status === 'ok' && <CheckIcon className="size-3" aria-hidden />}
      {status === 'error' && <XIcon className="size-3" aria-hidden />}
      <span>{label}</span>
    </span>
  );
}

function humanize(tool: string): string {
  return tool.replace(/^lookup_/, '').replace(/_/g, ' ');
}
