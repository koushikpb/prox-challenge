import type { ManualSource } from '@/streaming';
import { cn } from '@/lib/utils';

const SOURCE_LABEL: Record<ManualSource, string> = {
  'owner-manual': 'Owner manual',
  'quick-start': 'Quick-start guide',
  'selection-chart': 'Selection chart',
};

type CitationCardProps = {
  page: number;
  source: ManualSource;
  onOpen: (page: number, source: ManualSource) => void;
};

export function CitationCard({ page, source, onOpen }: CitationCardProps) {
  const label = SOURCE_LABEL[source];
  return (
    <button
      type="button"
      onClick={() => onOpen(page, source)}
      title={`${label} — page ${page}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary',
      )}
      data-slot="citation-card"
      data-source={source}
      data-page={page}
    >
      <span>{label}</span>
      <span className="text-muted-foreground">·</span>
      <span>p. {page}</span>
    </button>
  );
}
