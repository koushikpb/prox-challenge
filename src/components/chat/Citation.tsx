import type { ManualSource } from '@/streaming';
import { cn } from '@/lib/utils';

const SOURCE_LABEL: Record<ManualSource, string> = {
  'owner-manual': 'Owner manual',
  'quick-start': 'Quick-start guide',
  'selection-chart': 'Selection chart',
};

type CitationProps = {
  index: number;
  page: number;
  source: ManualSource;
  onOpen: (page: number, source: ManualSource) => void;
};

export function Citation({ index, page, source, onOpen }: CitationProps) {
  const label = SOURCE_LABEL[source];
  return (
    <button
      type="button"
      onClick={() => onOpen(page, source)}
      title={`${label} — page ${page}`}
      className={cn(
        'inline-flex items-center justify-center rounded-sm bg-secondary/60 px-1 text-[0.65rem] font-medium leading-none text-secondary-foreground transition-colors hover:bg-secondary',
      )}
      data-slot="citation"
      data-source={source}
      data-page={page}
    >
      <sup className="text-[0.65rem]">
        {index}
        <span className="sr-only">
          {label} page {page}
        </span>
      </sup>
    </button>
  );
}
