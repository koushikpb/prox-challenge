'use client';

import { useMemo, useState } from 'react';

import type { PolarityArtifactPayload } from '@/streaming';
import { cn } from '@/lib/utils';

type PolarityProcess = PolarityArtifactPayload['process'];

type PolarityModel = {
  process: PolarityProcess;
  label: string;
  electrode_label: string;
  ground_socket: 'Positive' | 'Negative';
  electrode_socket: 'Positive' | 'Negative';
  polarity_name: 'DCEP' | 'DCEN';
  source_page: number;
  hint: string;
};

const MODEL: ReadonlyArray<PolarityModel> = [
  {
    process: 'MIG_solid',
    label: 'MIG (solid-core, gas)',
    electrode_label: 'Wire-feed cable',
    ground_socket: 'Negative',
    electrode_socket: 'Positive',
    polarity_name: 'DCEP',
    source_page: 14,
    hint: 'Gas-shielded solid wire',
  },
  {
    process: 'MIG_flux',
    label: 'MIG (flux-cored)',
    electrode_label: 'Wire-feed cable',
    ground_socket: 'Positive',
    electrode_socket: 'Negative',
    polarity_name: 'DCEN',
    source_page: 13,
    hint: 'Self-shielded flux core',
  },
  {
    process: 'TIG',
    label: 'TIG',
    electrode_label: 'TIG torch cable',
    ground_socket: 'Positive',
    electrode_socket: 'Negative',
    polarity_name: 'DCEN',
    source_page: 24,
    hint: 'Steel / stainless / chrome-moly',
  },
  {
    process: 'Stick',
    label: 'Stick (SMAW)',
    electrode_label: 'Electrode holder cable',
    ground_socket: 'Negative',
    electrode_socket: 'Positive',
    polarity_name: 'DCEP',
    source_page: 27,
    hint: 'Most rods — check rod spec',
  },
];

type PolarityArtifactProps = { payload: PolarityArtifactPayload };

export function PolarityArtifact({ payload }: PolarityArtifactProps) {
  const [process, setProcess] = useState<PolarityProcess>(payload.process);

  const current = useMemo<PolarityModel>(() => {
    const fromModel = MODEL.find((m) => m.process === process);
    if (fromModel) return fromModel;
    return {
      process: payload.process,
      label: payload.process,
      electrode_label: 'Electrode cable',
      ground_socket: payload.ground_socket,
      electrode_socket: payload.electrode_socket,
      polarity_name: payload.polarity_name,
      source_page: payload.source_page,
      hint: '',
    };
  }, [process, payload]);

  return (
    <section
      className="space-y-3 rounded-lg border bg-card p-3 text-card-foreground shadow-sm"
      data-slot="artifact"
      data-artifact-type="polarity"
    >
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold">Polarity wiring</h3>
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-[0.7rem] font-semibold',
            current.polarity_name === 'DCEP'
              ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
          )}
        >
          {current.polarity_name}
        </span>
      </header>

      <p className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[0.7rem] text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        Unplug the welder before swapping cables between sockets.
      </p>

      <div role="tablist" aria-label="Process" className="flex flex-wrap gap-1">
        {MODEL.map((m) => (
          <button
            key={m.process}
            type="button"
            role="tab"
            aria-selected={process === m.process}
            onClick={() => setProcess(m.process)}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[0.7rem] font-medium transition-colors',
              process === m.process
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <PolaritySVG model={current} />

      <p className="text-xs text-muted-foreground">{current.hint}</p>

      <footer className="text-[0.7rem] text-muted-foreground">p. {current.source_page}</footer>
    </section>
  );
}

function PolaritySVG({ model }: { model: PolarityModel }) {
  const groundColor = model.ground_socket === 'Positive' ? '#dc2626' : '#0f172a';
  const electrodeColor = model.electrode_socket === 'Positive' ? '#dc2626' : '#0f172a';
  return (
    <svg
      viewBox="0 0 320 180"
      role="img"
      aria-label={`Polarity diagram: ${model.label} runs ${model.polarity_name}`}
      className="h-auto w-full"
    >
      <rect
        x="80"
        y="20"
        width="160"
        height="140"
        rx="10"
        fill="hsl(var(--muted) / 0.3)"
        stroke="currentColor"
        strokeOpacity="0.2"
      />
      <text x="160" y="38" textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.6">
        Front sockets
      </text>

      <Socket cx={120} cy={100} label="−" tone="negative" highlight={model.ground_socket === 'Negative' || model.electrode_socket === 'Negative'} />
      <Socket cx={200} cy={100} label="+" tone="positive" highlight={model.ground_socket === 'Positive' || model.electrode_socket === 'Positive'} />

      <Cable
        from={model.ground_socket === 'Negative' ? [120, 100] : [200, 100]}
        to={[40, 150]}
        color={groundColor}
        label="Ground clamp"
        labelAt={[40, 168]}
      />
      <Cable
        from={model.electrode_socket === 'Negative' ? [120, 100] : [200, 100]}
        to={[280, 150]}
        color={electrodeColor}
        label={model.electrode_label}
        labelAt={[280, 168]}
      />
    </svg>
  );
}

function Socket({
  cx,
  cy,
  label,
  tone,
  highlight,
}: {
  cx: number;
  cy: number;
  label: string;
  tone: 'positive' | 'negative';
  highlight: boolean;
}) {
  const fill = tone === 'positive' ? '#fee2e2' : '#e2e8f0';
  const stroke = tone === 'positive' ? '#dc2626' : '#475569';
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={20}
        fill={fill}
        stroke={stroke}
        strokeWidth={highlight ? 3 : 1.5}
        opacity={highlight ? 1 : 0.7}
      />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="14" fontWeight="600" fill={stroke}>
        {label}
      </text>
    </g>
  );
}

function Cable({
  from,
  to,
  color,
  label,
  labelAt,
}: {
  from: [number, number];
  to: [number, number];
  color: string;
  label: string;
  labelAt: [number, number];
}) {
  const [fx, fy] = from;
  const [tx, ty] = to;
  const midX = (fx + tx) / 2;
  return (
    <g>
      <path
        d={`M ${fx} ${fy} C ${midX} ${fy}, ${midX} ${ty}, ${tx} ${ty}`}
        stroke={color}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
      <circle cx={tx} cy={ty} r={4} fill={color} />
      <text x={labelAt[0]} y={labelAt[1]} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.75">
        {label}
      </text>
    </g>
  );
}
