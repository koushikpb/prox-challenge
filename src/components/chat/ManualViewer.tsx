'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react';

import type { ManualSource } from '@/streaming';
import { cn } from '@/lib/utils';

const SOURCE_LABEL: Record<ManualSource, string> = {
  'owner-manual': 'Owner manual',
  'quick-start': 'Quick-start guide',
  'selection-chart': 'Selection chart',
};

const SOURCE_PAGE_COUNT: Record<ManualSource, number> = {
  'owner-manual': 48,
  'quick-start': 2,
  'selection-chart': 1,
};

type ManualViewerProps = {
  open: boolean;
  page: number | null;
  source: ManualSource | null;
  onOpenChange: (open: boolean) => void;
};

export function ManualViewer({ open, page, source, onOpenChange }: ManualViewerProps) {
  const [currentPage, setCurrentPage] = useState<number | null>(page);
  const [pageInput, setPageInput] = useState<string>(page ? String(page) : '');
  const [prevPage, setPrevPage] = useState<number | null>(page);
  const [prevSource, setPrevSource] = useState<ManualSource | null>(source);
  if (page !== prevPage || source !== prevSource) {
    setPrevPage(page);
    setPrevSource(source);
    setCurrentPage(page);
    setPageInput(page ? String(page) : '');
  }

  const totalPages = source ? SOURCE_PAGE_COUNT[source] : 0;
  const ready = currentPage !== null && source !== null;
  const imgSrc = ready ? buildImageSrc(source, currentPage) : null;
  const label = source ? SOURCE_LABEL[source] : '';

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const goTo = useCallback(
    (next: number) => {
      if (!source) return;
      const clamped = Math.max(1, Math.min(SOURCE_PAGE_COUNT[source], Math.round(next)));
      setCurrentPage(clamped);
      setPageInput(String(clamped));
    },
    [source],
  );

  const goPrev = useCallback(() => {
    if (currentPage === null) return;
    goTo(currentPage - 1);
  }, [currentPage, goTo]);

  const goNext = useCallback(() => {
    if (currentPage === null) return;
    goTo(currentPage + 1);
  }, [currentPage, goTo]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close, goPrev, goNext]);

  if (!open) return null;

  const atStart = currentPage === null || currentPage <= 1;
  const atEnd = currentPage === null || (source !== null && currentPage >= totalPages);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ready ? `${label} — page ${currentPage}` : 'Manual viewer'}
      data-slot="manual-viewer"
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 ease-out"
      onClick={close}
    >
      <header
        className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-medium text-white">{ready ? label : 'Manual viewer'}</span>
        </div>

        {source && currentPage !== null && (
          <div className="flex items-center gap-2" data-slot="manual-viewer-nav">
            <button
              type="button"
              onClick={goPrev}
              disabled={atStart}
              aria-label="Previous page"
              className={cn(
                'inline-flex size-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition-colors',
                'hover:border-white/25 hover:bg-white/[0.08] hover:text-white disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:bg-white/[0.04]',
              )}
            >
              <ChevronLeftIcon className="size-4" aria-hidden />
            </button>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                const parsed = Number.parseInt(pageInput, 10);
                if (Number.isFinite(parsed)) goTo(parsed);
                else setPageInput(String(currentPage));
              }}
              className="flex items-center gap-1.5 text-xs text-zinc-300"
            >
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={totalPages}
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
                onBlur={() => {
                  const parsed = Number.parseInt(pageInput, 10);
                  if (Number.isFinite(parsed)) goTo(parsed);
                  else setPageInput(String(currentPage));
                }}
                aria-label="Jump to page"
                className="w-10 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-center font-mono text-xs text-white focus:border-white/30 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                data-slot="manual-viewer-page-input"
              />
              <span className="text-zinc-500">/</span>
              <span className="font-mono text-xs text-zinc-300">{totalPages}</span>
            </form>

            <button
              type="button"
              onClick={goNext}
              disabled={atEnd}
              aria-label="Next page"
              className={cn(
                'inline-flex size-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition-colors',
                'hover:border-white/25 hover:bg-white/[0.08] hover:text-white disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:bg-white/[0.04]',
              )}
            >
              <ChevronRightIcon className="size-4" aria-hidden />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={close}
          aria-label="Close manual viewer"
          className={cn(
            'inline-flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition-colors',
            'hover:border-white/30 hover:bg-white/[0.08] hover:text-white',
          )}
          data-slot="manual-viewer-close"
        >
          <XIcon className="size-4" aria-hidden />
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center overflow-auto p-6">
        {imgSrc ? (
          <div
            className="relative flex max-h-full w-full max-w-5xl items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              key={imgSrc}
              src={imgSrc}
              alt={`${label} page ${currentPage}`}
              width={1600}
              height={2200}
              sizes="(max-width: 1024px) 100vw, 80vw"
              className="h-auto max-h-[calc(100vh-7rem)] w-auto max-w-full rounded-md bg-white object-contain shadow-2xl"
              unoptimized
              priority={false}
            />
          </div>
        ) : (
          <p className="text-sm text-zinc-400">No page selected.</p>
        )}
      </div>
    </div>
  );
}

function buildImageSrc(source: ManualSource, page: number): string {
  const padded = String(page).padStart(3, '0');
  return `/data/pages/${source}-${padded}.png`;
}
