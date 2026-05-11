'use client';

import { useEffect, useMemo, useState } from 'react';

import type { SettingsArtifactPayload } from '@/streaming';

import { loadJson } from './lib/loadJson';

type SettingsTableRow = {
  source: 'selection-chart' | 'owner-manual';
  process: 'MIG' | 'TIG' | 'Stick';
  subprocess?: 'solid-core' | 'flux-cored';
  material: string;
  thickness_in?: number;
  thickness_min_in?: number;
  thickness_max_in?: number;
  wire_diameter_in?: number;
  wfs_ipm?: number;
  voltage?: number;
  gas_required: boolean;
  gas_scfh_min?: number;
  gas_scfh_max?: number;
  skill_level?: 'low' | 'moderate' | 'high';
  cleanliness?: 'extremely_clean' | 'clean_minimal_spatter' | 'more_spatter';
  applications?: string[];
  notes?: string;
  source_page: number;
};

const SYNERGIC_NOTE =
  'The welder computes A/V on-screen from wire diameter + thickness — see the LCD (p. 20).';

const PROCESS_OPTIONS = ['MIG', 'TIG', 'Stick'] as const;
const SKILL_LABEL: Record<'low' | 'moderate' | 'high', string> = {
  low: 'Low — beginner-friendly',
  moderate: 'Moderate — some practice',
  high: 'High — experienced operators',
};
const CLEANLINESS_LABEL: Record<NonNullable<SettingsTableRow['cleanliness']>, string> = {
  extremely_clean: 'Extremely clean — minimal cleanup',
  clean_minimal_spatter: 'Clean — minimal spatter',
  more_spatter: 'Heavier spatter — expect cleanup',
};

type SettingsConfiguratorArtifactProps = { payload: SettingsArtifactPayload };

export function SettingsConfiguratorArtifact({ payload }: SettingsConfiguratorArtifactProps) {
  const [process, setProcess] = useState<'MIG' | 'TIG' | 'Stick'>(payload.process);
  const [material, setMaterial] = useState<string>(payload.material);
  const [thickness, setThickness] = useState<number>(payload.thickness_in);
  const [table, setTable] = useState<SettingsTableRow[] | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadJson<SettingsTableRow[]>('/data/settings.json')
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

  const materials = useMemo<string[]>(() => {
    if (!table) return [payload.material];
    const set = new Set<string>(table.filter((r) => r.process === process).map((r) => r.material));
    set.add(payload.material);
    return [...set].sort();
  }, [table, process, payload.material]);

  const matchedRows = useMemo<SettingsTableRow[]>(() => {
    if (!table) return [];
    return table.filter(
      (r) => r.process === process && r.material === material && thicknessFits(thickness, r),
    );
  }, [table, process, material, thickness]);

  const nearestRows = useMemo<SettingsTableRow[]>(() => {
    if (!table || matchedRows.length > 0) return [];
    const candidates = table.filter((r) => r.process === process && r.material === material);
    if (candidates.length === 0) return [];
    candidates.sort((a, b) => thicknessDistance(thickness, a) - thicknessDistance(thickness, b));
    return candidates.slice(0, 1);
  }, [table, matchedRows, process, material, thickness]);

  const fallbackRow = useMemo<SettingsTableRow>(() => payloadAsRow(payload), [payload]);
  const renderRows = matchedRows.length > 0 ? matchedRows : nearestRows.length > 0 ? nearestRows : [fallbackRow];
  const isOutOfRange = matchedRows.length === 0 && nearestRows.length > 0;

  return (
    <section
      className="space-y-3 rounded-lg border bg-card p-3 text-card-foreground shadow-sm"
      data-slot="artifact"
      data-artifact-type="settings"
    >
      <header className="flex items-baseline justify-between">
        <h3 className="font-heading text-sm font-semibold">Settings recommendation</h3>
        <span className="text-xs text-muted-foreground">
          {process} · {formatMaterial(material)}
        </span>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Process</span>
          <select
            value={process}
            onChange={(e) => setProcess(e.target.value as 'MIG' | 'TIG' | 'Stick')}
            className="rounded-md border bg-background px-2 py-1 text-sm"
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
          <span className="text-muted-foreground">Material</span>
          <select
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-sm"
            aria-label="Material"
          >
            {materials.map((m) => (
              <option key={m} value={m}>
                {formatMaterial(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Thickness (in)</span>
          <input
            type="number"
            value={thickness}
            min={0.01}
            max={1}
            step={0.01}
            onChange={(e) => setThickness(Number(e.target.value) || 0)}
            className="rounded-md border bg-background px-2 py-1 text-sm"
            aria-label="Thickness in inches"
          />
        </label>
      </div>

      {isOutOfRange && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[0.7rem] text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          {thickness} in. is outside the published ranges for {formatMaterial(material)} on {process}. Showing the nearest recommendation.
        </p>
      )}

      <div className="space-y-3">
        {renderRows.map((row, idx) => (
          <SettingsRow key={`${row.source}-${row.source_page}-${idx}`} row={row} />
        ))}
      </div>

      <p className="rounded-md bg-secondary/60 px-2 py-1 text-[0.7rem] text-secondary-foreground">
        {SYNERGIC_NOTE}
      </p>

      <footer className="flex items-center justify-between text-[0.7rem] text-muted-foreground">
        <span>p. {renderRows[0]?.source_page ?? payload.source_page}</span>
        {tableError && <span className="text-destructive">Interactive match unavailable</span>}
      </footer>
    </section>
  );
}

function SettingsRow({ row }: { row: SettingsTableRow }) {
  const hasNumeric = row.wfs_ipm !== undefined || row.voltage !== undefined;
  return (
    <div className="space-y-1.5 rounded-md border bg-muted/30 p-2">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
          {row.process}
          {row.subprocess ? ` · ${row.subprocess}` : ''}
        </span>
        {row.skill_level && (
          <span className="text-muted-foreground">{SKILL_LABEL[row.skill_level]}</span>
        )}
      </div>
      <ul className="ml-3 list-disc space-y-0.5 text-xs">
        <li>
          Gas:{' '}
          {row.gas_required
            ? row.gas_scfh_min && row.gas_scfh_max
              ? `required, ${row.gas_scfh_min}–${row.gas_scfh_max} SCFH`
              : 'required'
            : 'none (self-shielded)'}
        </li>
        {row.cleanliness && <li>{CLEANLINESS_LABEL[row.cleanliness]}</li>}
        {row.applications && row.applications.length > 0 && (
          <li>
            Applications: {row.applications.slice(0, 3).join('; ')}
            {row.applications.length > 3 ? '…' : ''}
          </li>
        )}
        {row.notes && <li className="text-muted-foreground">{row.notes}</li>}
      </ul>
      {hasNumeric && (
        <div className="rounded border border-dashed bg-background px-2 py-1 text-[0.7rem]">
          <div className="text-muted-foreground">Owner-manual numerical values:</div>
          <div className="font-mono">
            {row.wfs_ipm !== undefined && <span>WFS {row.wfs_ipm} ipm</span>}
            {row.wfs_ipm !== undefined && row.voltage !== undefined && ' · '}
            {row.voltage !== undefined && <span>{row.voltage} V</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function thicknessFits(thickness: number, row: SettingsTableRow): boolean {
  if (row.thickness_in !== undefined) {
    return Math.abs(row.thickness_in - thickness) < 0.005;
  }
  if (row.thickness_min_in !== undefined && row.thickness_max_in !== undefined) {
    return thickness >= row.thickness_min_in && thickness <= row.thickness_max_in;
  }
  return false;
}

function thicknessDistance(thickness: number, row: SettingsTableRow): number {
  if (row.thickness_in !== undefined) return Math.abs(row.thickness_in - thickness);
  if (row.thickness_min_in !== undefined && row.thickness_max_in !== undefined) {
    if (thickness < row.thickness_min_in) return row.thickness_min_in - thickness;
    if (thickness > row.thickness_max_in) return thickness - row.thickness_max_in;
    return 0;
  }
  return Number.POSITIVE_INFINITY;
}

function formatMaterial(material: string): string {
  return material.replace(/_/g, ' ');
}

function payloadAsRow(payload: SettingsArtifactPayload): SettingsTableRow {
  return {
    source: 'owner-manual',
    process: payload.process,
    subprocess: payload.subprocess,
    material: payload.material,
    thickness_in: payload.thickness_in,
    gas_required: payload.gas_required,
    gas_scfh_min: payload.gas_scfh_min,
    gas_scfh_max: payload.gas_scfh_max,
    skill_level: payload.skill_level,
    cleanliness: payload.cleanliness,
    applications: payload.applications,
    wfs_ipm: payload.wfs_ipm,
    voltage: payload.voltage,
    notes: payload.notes,
    source_page: payload.source_page,
  };
}
