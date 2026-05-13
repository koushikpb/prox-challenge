'use client';

import { ScanIcon } from 'lucide-react';

import type { ManualSource, RegionArtifactPayload } from '@/streaming';

import { ArtifactCard } from './ArtifactCard';

type RegionArtifactProps = {
  payload: RegionArtifactPayload;
  onOpenPage?: (page: number, source: ManualSource) => void;
};

function humanize(id: string): string {
  const words = id.replace(/_/g, ' ').trim();
  if (words.length === 0) return id;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function tagLabel(regionId: string): string {
  return regionId.replace(/_/g, ' ').toUpperCase();
}

function safetyNote(regionId: string): string | undefined {
  if (regionId === 'wiring_schematic') {
    return 'Unplug the welder and let the capacitors discharge before opening any internal panel.';
  }
  if (regionId.startsWith('polarity_')) {
    return 'Unplug the welder before changing cable polarity.';
  }
  return undefined;
}

export function RegionArtifact({ payload, onOpenPage }: RegionArtifactProps) {
  const title = payload.title ?? humanize(payload.region_id);
  const note = safetyNote(payload.region_id);

  return (
    <ArtifactCard
      type="region"
      tagLabel={tagLabel(payload.region_id)}
      tagIcon={ScanIcon}
      pageBadge={`page ${payload.page}`}
      hero={{ src: payload.image_url, alt: title }}
      title={title}
      safetyNote={note}
      footer={{ source: payload.source, page: payload.page, onOpenPage }}
    >
      <p className="mt-3 text-xs leading-relaxed text-zinc-400" data-slot="region-caption">
        {payload.caption}
      </p>
    </ArtifactCard>
  );
}
