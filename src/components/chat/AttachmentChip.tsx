'use client';

import { XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AttachmentChipProps = {
  id: string;
  filename: string;
  previewUrl: string;
  sizeBytes: number;
  onRemove: (id: string) => void;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncate(name: string, limit = 22): string {
  if (name.length <= limit) return name;
  const dot = name.lastIndexOf('.');
  if (dot === -1 || dot < limit - 6) return `${name.slice(0, limit - 1)}…`;
  const ext = name.slice(dot);
  return `${name.slice(0, limit - ext.length - 1)}…${ext}`;
}

export function AttachmentChip({ id, filename, previewUrl, sizeBytes, onRemove }: AttachmentChipProps) {
  return (
    <div
      className={cn(
        'animate-in fade-in slide-in-from-bottom-1 duration-150 motion-reduce:animate-none',
        'flex items-center gap-2 rounded-lg bg-card ring-1 ring-white/15 px-1.5 py-1 text-xs text-zinc-200',
      )}
      data-slot="attachment-chip"
    >
      {/* next/image cannot optimize runtime blob: URLs from canvas re-encode. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt=""
        className="size-8 shrink-0 rounded object-cover"
        aria-hidden
      />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-medium" title={filename}>
          {truncate(filename)}
        </span>
        <span className="text-[0.65rem] text-zinc-400">{formatSize(sizeBytes)}</span>
      </div>
      <button
        type="button"
        onClick={() => onRemove(id)}
        aria-label={`Remove attachment ${filename}`}
        className="ml-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
        data-slot="attachment-remove"
      >
        <XIcon className="size-3" aria-hidden />
      </button>
    </div>
  );
}
