'use client';

import { useEffect, useMemo, useState } from 'react';
import { ActivityIcon } from 'lucide-react';

import type { DutyCycleArtifactPayload, ManualSource } from '@/streaming';
import { cn } from '@/lib/utils';

import { ArtifactCard, ArtifactRows } from './ArtifactCard';
import { loadJson } from './lib/loadJson';

type DutyCycleTableRow = {
  process: 'MIG' | 'TIG' | 'Stick';
  input_voltage: 120 | 240;
  rated: { amperage: number; duty_cycle_pct: number; work_minutes: number; rest_minutes: number };
  continuous: { amperage: number; duty_cycle_pct: 100 };
  current_range: { min_a: number; max_a: number };
  ocv_v: number;
  source_page: number;
  notes?: string;
};

type Band = 'rated' | '100pct' | 'out_of_range' | 'below_range';

type Computed = {
  band: Band;
  duty_cycle_pct: number;
  work_minutes: number;
  rest_minutes: number;
  source_page: number;
};

const PROCESS_OPTIONS = ['MIG', 'TIG', 'Stick'] as const;
const VOLTAGE_OPTIONS = [120, 240] as const;

type DutyCycleArtifactProps = {
  payload: DutyCycleArtifactPayload;
  onOpenPage?: (page: number, source: ManualSource) => void;
};

export function DutyCycleArtifact({ payload, onOpenPage }: DutyCycleArtifactProps) {
  const [voltage, setVoltage] = useState<120 | 240>(payload.input_voltage);
  const [process, setProcess] = useState<'MIG' | 'TIG' | 'Stick'>(payload.process);
  const [amperage, setAmperage] = useState<number>(payload.amperage);
  const [table, setTable] = useState<DutyCycleTableRow[] | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadJson<DutyCycleTableRow[]>('/data/duty_cycle.json')
      .then((rows) => {
        if (!cancelled) setTable(rows);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setTableError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const row = useMemo<DutyCycleTableRow | null>(() => {
    if (!table) return null;
    return table.find((r) => r.process === process && r.input_voltage === voltage) ?? null;
  }, [table, process, voltage]);

  const computed = useMemo<Computed>(() => {
    if (!row) {
      return {
        band: 'rated',
        duty_cycle_pct: payload.duty_cycle_pct,
        work_minutes: payload.work_minutes,
        rest_minutes: payload.rest_minutes,
        source_page: payload.source_page,
      };
    }
    return computeBand(amperage, row);
  }, [row, amperage, payload]);

  const range = row?.current_range ?? null;
  const showInteractive = row !== null;

  return (
    <ArtifactCard
      type="duty_cycle"
      tagLabel="Duty cycle"
      tagIcon={ActivityIcon}
      pageBadge={`${computed.duty_cycle_pct}% @ ${voltage} V`}
      hero={{
        src: '/data/regions/duty_cycle_specifications.png',
        alt: 'Owner-manual specifications block listing rated duty cycles by process and input voltage',
      }}
      title={`${process} · ${voltage} V`}
      subtitle={`${amperage} A · ${computed.duty_cycle_pct}% rated`}
      footer={{ source: 'owner-manual', page: computed.source_page, onOpenPage }}
    >
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[0.65rem] uppercase tracking-[0.14em] text-zinc-500">Process</span>
          <select
            value={process}
            onChange={(e) => setProcess(e.target.value as 'MIG' | 'TIG' | 'Stick')}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
            disabled={!showInteractive}
            aria-label="Process"
          >
            {PROCESS_OPTIONS.map((p) => (
              <option key={p} value={p} className="bg-zinc-900">
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[0.65rem] uppercase tracking-[0.14em] text-zinc-500">
            Input voltage
          </span>
          <select
            value={voltage}
            onChange={(e) => setVoltage(Number(e.target.value) as 120 | 240)}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
            disabled={!showInteractive}
            aria-label="Input voltage"
          >
            {VOLTAGE_OPTIONS.map((v) => (
              <option key={v} value={v} className="bg-zinc-900">
                {v} V
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 block space-y-1 text-xs">
        <span className="flex items-baseline justify-between">
          <span className="text-[0.65rem] uppercase tracking-[0.14em] text-zinc-500">Amperage</span>
          <span className="font-mono text-sm text-white">{amperage} A</span>
        </span>
        <input
          type="range"
          min={range ? range.min_a : Math.max(10, payload.amperage - 50)}
          max={range ? range.max_a : payload.amperage + 50}
          step={1}
          value={amperage}
          onChange={(e) => setAmperage(Number(e.target.value))}
          disabled={!showInteractive}
          className="w-full accent-white"
          aria-label="Amperage"
        />
        {range && (
          <span className="flex justify-between font-mono text-[0.65rem] text-zinc-500">
            <span>{range.min_a} A</span>
            <span>{range.max_a} A</span>
          </span>
        )}
      </label>

      <ArtifactRows
        rows={[
          { label: 'Duty cycle', value: `${computed.duty_cycle_pct}%` },
          { label: 'Work / 10 min', value: `${formatMinutes(computed.work_minutes)} min` },
          { label: 'Rest / 10 min', value: `${formatMinutes(computed.rest_minutes)} min` },
        ]}
      />

      <div className="mt-2">
        <BandBadge band={computed.band} />
      </div>

      {tableError && (
        <p className="mt-2 text-[0.65rem] text-red-300">Interactive recompute unavailable</p>
      )}
    </ArtifactCard>
  );
}

function BandBadge({ band }: { band: Band }) {
  const map: Record<Band, { label: string; className: string }> = {
    '100pct': {
      label: '100% continuous — weld without resting',
      className: 'border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-300',
    },
    rated: {
      label: 'Rated duty cycle — observe work/rest split',
      className: 'border-amber-400/30 bg-amber-400/[0.08] text-amber-200',
    },
    below_range: {
      label: 'Below rated band — no work/rest limit listed',
      className: 'border-white/10 bg-white/[0.04] text-zinc-300',
    },
    out_of_range: {
      label: 'Out of range — exceeds welder spec',
      className: 'border-red-400/30 bg-red-400/[0.08] text-red-300',
    },
  };
  const { label, className } = map[band];
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2.5 py-0.5 text-[0.65rem] font-medium',
        className,
      )}
    >
      {label}
    </span>
  );
}

export function computeBand(amperage: number, row: DutyCycleTableRow): Computed {
  if (amperage > row.current_range.max_a) {
    return {
      band: 'out_of_range',
      duty_cycle_pct: 0,
      work_minutes: 0,
      rest_minutes: 10,
      source_page: row.source_page,
    };
  }
  if (amperage >= row.rated.amperage) {
    return {
      band: 'rated',
      duty_cycle_pct: row.rated.duty_cycle_pct,
      work_minutes: row.rated.work_minutes,
      rest_minutes: row.rated.rest_minutes,
      source_page: row.source_page,
    };
  }
  if (amperage >= row.continuous.amperage) {
    return {
      band: '100pct',
      duty_cycle_pct: 100,
      work_minutes: 10,
      rest_minutes: 0,
      source_page: row.source_page,
    };
  }
  return {
    band: 'below_range',
    duty_cycle_pct: 100,
    work_minutes: 10,
    rest_minutes: 0,
    source_page: row.source_page,
  };
}

function formatMinutes(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace(/\.0$/, '');
}
