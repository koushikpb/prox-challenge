'use client';

import Image from 'next/image';

import type { ManualSource } from '@/streaming';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const SOURCE_LABEL: Record<ManualSource, string> = {
  'owner-manual': 'Owner manual',
  'quick-start': 'Quick-start guide',
  'selection-chart': 'Selection chart',
};

type ManualViewerProps = {
  open: boolean;
  page: number | null;
  source: ManualSource | null;
  onOpenChange: (open: boolean) => void;
};

export function ManualViewer({ open, page, source, onOpenChange }: ManualViewerProps) {
  const ready = page !== null && source !== null;
  const imgSrc = ready ? buildImageSrc(source, page) : null;
  const label = source ? SOURCE_LABEL[source] : '';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{ready ? `${label} — page ${page}` : 'Manual viewer'}</SheetTitle>
          <SheetDescription>
            Reference image surfaced from the cited source.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-auto px-4 pb-4">
          {imgSrc ? (
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md border bg-muted">
              <Image
                src={imgSrc}
                alt={`${label} page ${page}`}
                fill
                sizes="(max-width: 640px) 100vw, 36rem"
                className="object-contain"
                unoptimized
                priority={false}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No page selected.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function buildImageSrc(source: ManualSource, page: number): string {
  const padded = String(page).padStart(3, '0');
  return `/data/pages/${source}-${padded}.png`;
}
