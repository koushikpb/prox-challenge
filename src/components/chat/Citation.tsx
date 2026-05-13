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
        'inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[0.7rem] font-medium text-zinc-300 transition-colors',
        'hover:border-white/20 hover:bg-white/[0.07] hover:text-white',
      )}
      data-slot="citation-card"
      data-source={source}
      data-page={page}
    >
      <span>{label}</span>
      <span className="text-zinc-600">·</span>
      <span className="font-mono">p. {page}</span>
    </button>
  );
}
