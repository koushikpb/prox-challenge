'use client';

import { useEffect, useMemo, useState } from 'react';

import type { DutyCycleArtifactPayload } from '@/streaming';
import { cn } from '@/lib/utils';

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

type DutyCycleArtifactProps = { payload: DutyCycleArtifactPayload };

export function DutyCycleArtifact({ payload }: DutyCycleArtifactProps) {
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
    <section
      className="space-y-3 rounded-lg border bg-card p-3 text-card-foreground shadow-sm"
      data-slot="artifact"
      data-artifact-type="duty_cycle"
    >
      <header className="flex items-baseline justify-between">
        <h3 className="font-heading text-sm font-semibold">Duty cycle</h3>
        <span className="text-xs text-muted-foreground">
          {process} · {voltage} V
        </span>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Process</span>
          <select
            value={process}
            onChange={(e) => setProcess(e.target.value as 'MIG' | 'TIG' | 'Stick')}
            className="rounded-md border bg-background px-2 py-1 text-sm"
            disabled={!showInteractive}
            aria-label="Process"
          >
            {PROCESS_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Input voltage</span>
          <select
            value={voltage}
            onChange={(e) => setVoltage(Number(e.target.value) as 120 | 240)}
            className="rounded-md border bg-background px-2 py-1 text-sm"
            disabled={!showInteractive}
            aria-label="Input voltage"
          >
            {VOLTAGE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v} V
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-1 text-xs">
        <span className="flex items-baseline justify-between">
          <span className="text-muted-foreground">Amperage</span>
          <span className="font-mono text-sm text-foreground">{amperage} A</span>
        </span>
        <input
          type="range"
          min={range ? range.min_a : Math.max(10, payload.amperage - 50)}
          max={range ? range.max_a : payload.amperage + 50}
          step={1}
          value={amperage}
          onChange={(e) => setAmperage(Number(e.target.value))}
          disabled={!showInteractive}
          className="w-full accent-primary"
          aria-label="Amperage"
        />
        {range && (
          <span className="flex justify-between text-[0.65rem] text-muted-foreground">
            <span>{range.min_a} A</span>
            <span>{range.max_a} A</span>
          </span>
        )}
      </label>

      <DutyReadout computed={computed} />

      <footer className="flex items-center justify-between text-[0.7rem] text-muted-foreground">
        <span>p. {computed.source_page}</span>
        {tableError && <span className="text-destructive">Interactive recompute unavailable</span>}
      </footer>
    </section>
  );
}

function DutyReadout({ computed }: { computed: Computed }) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/40 p-2 text-center text-xs">
      <Stat label="Duty cycle" value={`${computed.duty_cycle_pct}%`} />
      <Stat
        label="Work / 10 min"
        value={`${formatMinutes(computed.work_minutes)} min`}
      />
      <Stat
        label="Rest / 10 min"
        value={`${formatMinutes(computed.rest_minutes)} min`}
      />
      <div className="col-span-3">
        <BandBadge band={computed.band} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm text-foreground">{value}</div>
    </div>
  );
}

function BandBadge({ band }: { band: Band }) {
  if (band === '100pct') {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        100% continuous — weld without resting
      </span>
    );
  }
  if (band === 'rated') {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
        Rated duty cycle — observe work/rest split
      </span>
    );
  }
  if (band === 'below_range') {
    return (
      <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-medium text-secondary-foreground">
        Below rated band — no work/rest limit listed
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-[0.65rem] font-medium text-destructive',
      )}
    >
      Out of range — exceeds welder spec
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
