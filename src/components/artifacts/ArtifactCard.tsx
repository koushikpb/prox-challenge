'use client';

import type { ComponentType, ReactNode, SVGProps } from 'react';
import { MaximizeIcon } from 'lucide-react';

import type { ManualSource } from '@/streaming';
import { cn } from '@/lib/utils';

const SOURCE_LABEL: Record<ManualSource, string> = {
  'owner-manual': 'Owner manual',
  'quick-start': 'Quick-start guide',
  'selection-chart': 'Selection chart',
};

type ArtifactCardProps = {
  type: string;
  tagLabel: string;
  tagIcon: ComponentType<SVGProps<SVGSVGElement>>;
  pageBadge?: string;
  hero?: { src: string; alt: string };
  heroSlot?: ReactNode;
  title: string;
  subtitle?: string;
  safetyNote?: string;
  children?: ReactNode;
  footer: {
    source: ManualSource;
    page: number;
    onOpenPage?: (page: number, source: ManualSource) => void;
  };
};

export function ArtifactCard({
  type,
  tagLabel,
  tagIcon: TagIcon,
  pageBadge,
  hero,
  heroSlot,
  title,
  subtitle,
  safetyNote,
  children,
  footer,
}: ArtifactCardProps) {
  const sourceLabel = SOURCE_LABEL[footer.source];
  const openPage = () => footer.onOpenPage?.(footer.page, footer.source);

  return (
    <section
      className={cn(
        'animate-artifact-enter overflow-hidden rounded-2xl border border-white/[0.09] bg-panel-strong',
        'shadow-[inset_0_1px_0_oklch(1_0_0/0.06)]',
      )}
      data-slot="artifact"
      data-artifact-type={type}
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.16em] text-zinc-300"
          data-slot="artifact-tag"
        >
          <TagIcon className="size-3" aria-hidden />
          <span>{tagLabel}</span>
        </span>
        {pageBadge && (
          <span
            className="font-mono text-[0.7rem] text-zinc-500"
            data-slot="artifact-page-badge"
          >
            {pageBadge}
          </span>
        )}
      </div>

      {safetyNote && (
        <p
          className="mx-4 mt-3 rounded-lg border border-amber-400/30 bg-amber-400/[0.06] px-3 py-1.5 text-[0.7rem] text-amber-200"
          data-slot="artifact-safety"
        >
          {safetyNote}
        </p>
      )}

      {(hero || heroSlot) && (
        <HeroSlot
          hero={hero}
          heroSlot={heroSlot}
          enlargeLabel={`Open ${sourceLabel} page ${footer.page}`}
          onClick={footer.onOpenPage ? openPage : undefined}
        />
      )}

      <div className="px-4 pt-3 pb-1">
        <h3 className="font-heading text-base font-semibold text-white" data-slot="artifact-title">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-zinc-400" data-slot="artifact-subtitle">
            {subtitle}
          </p>
        )}
      </div>

      {children && <div className="px-4 pb-1">{children}</div>}

      <footer
        className="mt-3 flex items-center justify-end border-t border-white/[0.06] px-4 py-2.5"
        data-slot="artifact-footer"
      >
        <SourcePill
          label={sourceLabel}
          page={footer.page}
          onClick={footer.onOpenPage ? openPage : undefined}
        />
      </footer>
    </section>
  );
}

function HeroSlot({
  hero,
  heroSlot,
  enlargeLabel,
  onClick,
}: {
  hero?: { src: string; alt: string };
  heroSlot?: ReactNode;
  enlargeLabel: string;
  onClick?: () => void;
}) {
  const interactive = Boolean(onClick);
  const baseClass =
    'group/hero relative mx-4 mt-3 block w-[calc(100%-2rem)] overflow-hidden rounded-xl bg-zinc-100 text-left ring-1 ring-white/15 shadow-[inset_0_1px_0_oklch(0_0_0/0.1),0_1px_0_oklch(0_0_0/0.25)]';
  const interactiveClass =
    'cursor-zoom-in transition-[box-shadow,outline-color] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 hover:ring-white/30';

  const content = (
    <>
      <div className="flex items-center justify-center">
        {heroSlot ?? (
          hero ? (
            // eslint-disable-next-line @next/next/no-img-element -- local /data asset, sizing controlled
            <img
              src={hero.src}
              alt={hero.alt}
              className="h-auto max-h-72 w-full object-contain transition-transform duration-300 ease-out group-hover/hero:scale-[1.01]"
              loading="lazy"
            />
          ) : null
        )}
      </div>
      {interactive && (
        <span
          aria-hidden
          className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-zinc-900/70 text-white opacity-0 backdrop-blur transition-opacity group-hover/hero:opacity-100 group-focus-visible/hero:opacity-100"
        >
          <MaximizeIcon className="size-3.5" />
        </span>
      )}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={enlargeLabel}
        className={cn(baseClass, interactiveClass)}
        data-slot="artifact-hero"
        data-interactive
      >
        {content}
      </button>
    );
  }

  return (
    <div className={baseClass} data-slot="artifact-hero">
      {content}
    </div>
  );
}

function SourcePill({
  label,
  page,
  onClick,
}: {
  label: string;
  page: number;
  onClick?: () => void;
}) {
  const className = cn(
    'inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[0.7rem] font-medium text-zinc-300 transition-colors duration-150 ease-out',
    onClick && 'hover:border-white/20 hover:bg-white/[0.07] hover:text-white',
  );
  const inner = (
    <>
      <span>{label}</span>
      <span className="text-zinc-600">·</span>
      <span className="font-mono">p. {page}</span>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`Open ${label} — page ${page}`}
        className={className}
        data-slot="artifact-source-pill"
        data-page={page}
      >
        {inner}
      </button>
    );
  }
  return (
    <span
      className={className}
      data-slot="artifact-source-pill"
      data-page={page}
    >
      {inner}
    </span>
  );
}

type ArtifactRowsProps = {
  rows: Array<{ label: string; value: ReactNode }>;
};

export function ArtifactRows({ rows }: ArtifactRowsProps) {
  return (
    <dl className="mt-2 divide-y divide-white/[0.05]" data-slot="artifact-rows">
      {rows.map((row, idx) => (
        <div
          key={`${row.label}-${idx}`}
          className="flex items-center justify-between gap-3 py-1.5"
        >
          <dt className="text-[0.7rem] uppercase tracking-[0.14em] text-zinc-500">{row.label}</dt>
          <dd className="text-right text-sm text-zinc-100">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
