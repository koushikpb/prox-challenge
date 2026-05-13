'use client';

import { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontalIcon } from 'lucide-react';

import type { ManualSource, SettingsArtifactPayload } from '@/streaming';

import { ArtifactCard, ArtifactRows } from './ArtifactCard';
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
  'OmniPro 220 is synergic auto-weld — the welder computes A/V on-screen from wire diameter + thickness — see the LCD (p. 20).';

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

type SettingsConfiguratorArtifactProps = {
  payload: SettingsArtifactPayload;
  onOpenPage?: (page: number, source: ManualSource) => void;
};

export function SettingsConfiguratorArtifact({
  payload,
  onOpenPage,
}: SettingsConfiguratorArtifactProps) {
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
  const renderRow =
    matchedRows[0] ?? nearestRows[0] ?? fallbackRow;
  const isOutOfRange = matchedRows.length === 0 && nearestRows.length > 0;

  const useSelectionChart = renderRow.source === 'selection-chart';
  const heroSrc = useSelectionChart
    ? '/data/regions/selection_chart.png'
    : '/data/regions/lcd_synergic_display.png';
  const heroAlt = useSelectionChart
    ? 'Welder selection chart cross-referencing process, materials, and thickness ranges'
    : 'OmniPro 220 Auto Weld synergic display showing computed amperage and voltage';
  const footerSource: ManualSource = renderRow.source === 'selection-chart' ? 'selection-chart' : 'owner-manual';
  const footerPage = renderRow.source_page;

  const rows = useMemo<Array<{ label: string; value: string }>>(() => {
    const out: Array<{ label: string; value: string }> = [];
    out.push({
      label: 'Process',
      value:
        renderRow.process + (renderRow.subprocess ? ` · ${renderRow.subprocess}` : ''),
    });
    out.push({ label: 'Material', value: formatMaterial(renderRow.material) });
    if (renderRow.thickness_in !== undefined) {
      out.push({ label: 'Thickness', value: `${renderRow.thickness_in} in` });
    } else if (
      renderRow.thickness_min_in !== undefined &&
      renderRow.thickness_max_in !== undefined
    ) {
      out.push({
        label: 'Thickness',
        value: `${renderRow.thickness_min_in}–${renderRow.thickness_max_in} in`,
      });
    }
    out.push({
      label: 'Gas',
      value: renderRow.gas_required
        ? renderRow.gas_scfh_min && renderRow.gas_scfh_max
          ? `Required · ${renderRow.gas_scfh_min}–${renderRow.gas_scfh_max} SCFH`
          : 'Required'
        : 'None (self-shielded)',
    });
    if (renderRow.skill_level) out.push({ label: 'Skill', value: SKILL_LABEL[renderRow.skill_level] });
    if (renderRow.cleanliness)
      out.push({ label: 'Cleanliness', value: CLEANLINESS_LABEL[renderRow.cleanliness] });
    if (renderRow.wfs_ipm !== undefined)
      out.push({ label: 'WFS', value: `${renderRow.wfs_ipm} ipm` });
    if (renderRow.voltage !== undefined) out.push({ label: 'Voltage', value: `${renderRow.voltage} V` });
    return out;
  }, [renderRow]);

  return (
    <ArtifactCard
      type="settings"
      tagLabel="Settings"
      tagIcon={SlidersHorizontalIcon}
      pageBadge={`page ${footerPage}`}
      hero={{ src: heroSrc, alt: heroAlt }}
      title={`${process} · ${formatMaterial(material)}`}
      subtitle="Auto Weld synergic display"
      footer={{ source: footerSource, page: footerPage, onOpenPage }}
    >
      <div className="mt-3 grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[0.65rem] uppercase tracking-[0.14em] text-zinc-500">Process</span>
          <select
            value={process}
            onChange={(e) => setProcess(e.target.value as 'MIG' | 'TIG' | 'Stick')}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
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
          <span className="text-[0.65rem] uppercase tracking-[0.14em] text-zinc-500">Material</span>
          <select
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
            aria-label="Material"
          >
            {materials.map((m) => (
              <option key={m} value={m} className="bg-zinc-900">
                {formatMaterial(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[0.65rem] uppercase tracking-[0.14em] text-zinc-500">
            Thickness (in)
          </span>
          <input
            type="number"
            value={thickness}
            min={0.01}
            max={1}
            step={0.01}
            onChange={(e) => setThickness(Number(e.target.value) || 0)}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
            aria-label="Thickness in inches"
          />
        </label>
      </div>

      {isOutOfRange && (
        <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/[0.06] px-2 py-1 text-[0.7rem] text-amber-200">
          {thickness} in. is outside the published ranges for {formatMaterial(material)} on{' '}
          {process}. Showing the nearest recommendation.
        </p>
      )}

      <ArtifactRows rows={rows} />

      {renderRow.applications && renderRow.applications.length > 0 && (
        <p className="mt-2 text-xs text-zinc-400">
          <span className="text-zinc-500">Applications · </span>
          {renderRow.applications.slice(0, 3).join('; ')}
          {renderRow.applications.length > 3 ? '…' : ''}
        </p>
      )}

      {(renderRow.wfs_ipm !== undefined || renderRow.voltage !== undefined) && (
        <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[0.7rem]">
          <div className="text-[0.6rem] uppercase tracking-[0.14em] text-zinc-500">
            Owner-manual numerical values
          </div>
          <div className="mt-1 font-mono text-zinc-200">
            {renderRow.wfs_ipm !== undefined && <span>WFS {renderRow.wfs_ipm} ipm</span>}
            {renderRow.wfs_ipm !== undefined && renderRow.voltage !== undefined && ' · '}
            {renderRow.voltage !== undefined && <span>{renderRow.voltage} V</span>}
          </div>
        </div>
      )}

      <p className="mt-3 text-[0.7rem] leading-relaxed text-zinc-500">{SYNERGIC_NOTE}</p>

      {tableError && (
        <p className="mt-2 text-[0.65rem] text-red-300">Interactive match unavailable</p>
      )}
    </ArtifactCard>
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
