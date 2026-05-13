'use client';

import { useMemo, useState } from 'react';
import { ZapIcon } from 'lucide-react';

import type { ManualSource, PolarityArtifactPayload } from '@/streaming';
import { cn } from '@/lib/utils';

import { ArtifactCard, ArtifactRows } from './ArtifactCard';

type PolarityProcess = PolarityArtifactPayload['process'];

type PolarityModel = {
  process: PolarityProcess;
  label: string;
  tabLabel: string;
  electrode_label: string;
  ground_socket: 'Positive' | 'Negative';
  electrode_socket: 'Positive' | 'Negative';
  polarity_name: 'DCEP' | 'DCEN';
  source_page: number;
  hint: string;
  region_image: string;
  caption: string;
};

const MODEL: ReadonlyArray<PolarityModel> = [
  {
    process: 'Stick',
    label: 'Stick (SMAW)',
    tabLabel: 'Stick',
    electrode_label: 'Electrode holder cable',
    ground_socket: 'Negative',
    electrode_socket: 'Positive',
    polarity_name: 'DCEP',
    source_page: 27,
    hint: 'Most rods run DCEP — always check the electrode spec.',
    region_image: '/data/regions/polarity_Stick.png',
    caption:
      'Stick (SMAW) is set up DCEP per the manual: ground clamp into Negative (−), electrode holder into Positive (+). (p. 27)',
  },
  {
    process: 'TIG',
    label: 'TIG',
    tabLabel: 'TIG',
    electrode_label: 'TIG torch cable',
    ground_socket: 'Positive',
    electrode_socket: 'Negative',
    polarity_name: 'DCEN',
    source_page: 24,
    hint: 'Steel / stainless / chrome-moly — TIG runs DCEN.',
    region_image: '/data/regions/polarity_TIG.png',
    caption:
      'TIG runs DCEN: ground clamp into Positive (+), TIG torch into Negative (−). (p. 24)',
  },
  {
    process: 'MIG_solid',
    label: 'MIG · solid-core (gas-shielded)',
    tabLabel: 'Solid-core MIG',
    electrode_label: 'Wire-feed cable',
    ground_socket: 'Negative',
    electrode_socket: 'Positive',
    polarity_name: 'DCEP',
    source_page: 14,
    hint: 'Gas-shielded solid wire — DCEP.',
    region_image: '/data/regions/polarity_DCEP_solid_core.png',
    caption:
      'Solid-core (gas-shielded) MIG runs DCEP: ground into Negative (−), wire-feed into Positive (+). (p. 14)',
  },
  {
    process: 'MIG_flux',
    label: 'MIG · flux-cored (gasless)',
    tabLabel: 'Flux-cored MIG',
    electrode_label: 'Wire-feed cable',
    ground_socket: 'Positive',
    electrode_socket: 'Negative',
    polarity_name: 'DCEN',
    source_page: 13,
    hint: 'Self-shielded flux-cored wire — DCEN.',
    region_image: '/data/regions/polarity_DCEN_flux_cored.png',
    caption:
      'Flux-cored (gasless) MIG runs DCEN: ground into Positive (+), wire-feed into Negative (−). (p. 13)',
  },
];

type PolarityArtifactProps = {
  payload: PolarityArtifactPayload;
  onOpenPage?: (page: number, source: ManualSource) => void;
};

export function PolarityArtifact({ payload, onOpenPage }: PolarityArtifactProps) {
  const [process, setProcess] = useState<PolarityProcess>(payload.process);

  const current = useMemo<PolarityModel>(() => {
    const fromModel = MODEL.find((m) => m.process === process);
    if (fromModel) return fromModel;
    return {
      process: payload.process,
      label: payload.process,
      tabLabel: payload.process,
      electrode_label: 'Electrode cable',
      ground_socket: payload.ground_socket,
      electrode_socket: payload.electrode_socket,
      polarity_name: payload.polarity_name,
      source_page: payload.source_page,
      hint: '',
      region_image: '/data/regions/polarity_DCEP_solid_core.png',
      caption: '',
    };
  }, [process, payload]);

  return (
    <ArtifactCard
      type="polarity"
      tagLabel="Polarity"
      tagIcon={ZapIcon}
      pageBadge={`page ${current.source_page}`}
      hero={{ src: current.region_image, alt: `${current.label} polarity diagram` }}
      title={current.label}
      subtitle={current.hint}
      safetyNote="Unplug the welder before changing cable polarity."
      footer={{ source: 'owner-manual', page: current.source_page, onOpenPage }}
    >
      <div
        role="tablist"
        aria-label="Process"
        className="-mx-1 mt-3 flex flex-wrap gap-1.5"
        data-slot="polarity-tabs"
      >
        {MODEL.map((m) => {
          const active = process === m.process;
          return (
            <button
              key={m.process}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setProcess(m.process)}
              className={cn(
                'rounded-full border px-3 py-1 text-[0.7rem] font-medium transition-colors',
                active
                  ? 'border-white/30 bg-white text-zinc-900'
                  : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/20 hover:text-white',
              )}
              data-slot="polarity-tab"
              data-process={m.process}
            >
              {m.tabLabel}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-zinc-400">{current.caption}</p>

      <ArtifactRows
        rows={[
          { label: 'Ground clamp', value: `${current.ground_socket} (−/+) socket` },
          { label: 'Wire / electrode', value: `${current.electrode_socket} (−/+) socket` },
          {
            label: 'Polarity',
            value: (
              <span
                className={cn(
                  'inline-flex rounded-full border px-2 py-0.5 font-mono text-[0.7rem]',
                  current.polarity_name === 'DCEP'
                    ? 'border-red-400/30 bg-red-400/[0.08] text-red-300'
                    : 'border-blue-400/30 bg-blue-400/[0.08] text-blue-300',
                )}
              >
                {current.polarity_name}
              </span>
            ),
          },
        ]}
      />
    </ArtifactCard>
  );
}
