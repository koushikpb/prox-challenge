import { z } from 'zod';
import { settingsTable } from './load-data';
import type { SettingsEntry } from '@/data/schemas';
import type { ToolDefinition } from './types';

export const SYNERGIC_NOTE =
  'OmniPro 220 computes A/V on-screen from wire diameter + thickness — see the LCD (p. 20).';

export const lookupSettingsInputSchema = z.object({
  process: z.enum(['MIG', 'TIG', 'Stick']),
  material: z.string().min(1),
  thickness_in: z.number().positive(),
});

export type LookupSettingsInput = z.infer<typeof lookupSettingsInputSchema>;

export type SettingsMatch = SettingsEntry & { notes?: string };

export type LookupSettingsOutput = {
  matches: SettingsMatch[];
  synergic_note: string;
};

function inThicknessRange(row: SettingsEntry, thickness: number): boolean {
  if (row.thickness_min_in !== undefined && row.thickness_max_in !== undefined) {
    return thickness >= row.thickness_min_in && thickness <= row.thickness_max_in;
  }
  if (row.thickness_in !== undefined) {
    return Math.abs(row.thickness_in - thickness) < 1e-6;
  }
  return false;
}

function distanceFromRange(row: SettingsEntry, thickness: number): number {
  if (row.thickness_min_in !== undefined && row.thickness_max_in !== undefined) {
    if (thickness < row.thickness_min_in) return row.thickness_min_in - thickness;
    if (thickness > row.thickness_max_in) return thickness - row.thickness_max_in;
    return 0;
  }
  if (row.thickness_in !== undefined) return Math.abs(row.thickness_in - thickness);
  return Number.POSITIVE_INFINITY;
}

export function lookupSettings(input: LookupSettingsInput): LookupSettingsOutput {
  const materialKey = input.material.toLowerCase().replace(/\s+/g, '_');
  const sameProcessAndMaterial = settingsTable.filter(
    (row) => row.process === input.process && row.material === materialKey,
  );

  const inRange = sameProcessAndMaterial.filter((row) => inThicknessRange(row, input.thickness_in));

  if (inRange.length > 0) {
    return { matches: inRange, synergic_note: SYNERGIC_NOTE };
  }

  if (sameProcessAndMaterial.length === 0) {
    return { matches: [], synergic_note: SYNERGIC_NOTE };
  }

  const sorted = [...sameProcessAndMaterial].sort(
    (a, b) => distanceFromRange(a, input.thickness_in) - distanceFromRange(b, input.thickness_in),
  );
  const nearestDistance = distanceFromRange(sorted[0]!, input.thickness_in);
  const nearest = sorted.filter(
    (row) => distanceFromRange(row, input.thickness_in) === nearestDistance,
  );

  const matches: SettingsMatch[] = nearest.map((row) => ({
    ...row,
    notes:
      row.notes !== undefined
        ? `${row.notes} (Out of range: thickness ${input.thickness_in}" falls outside this row's coverage; showing the nearest match.)`
        : `Out of range: thickness ${input.thickness_in}" falls outside this row's coverage; showing the nearest match.`,
  }));

  return { matches, synergic_note: SYNERGIC_NOTE };
}

export const lookupSettingsTool: ToolDefinition<LookupSettingsInput, LookupSettingsOutput> = {
  name: 'lookup_settings',
  description:
    'Return process-selection guidance (skill level, gas requirement, SCFH band, cleanliness, applications) for a given welding process, material, and thickness. The OmniPro 220 is a synergic welder — actual A/V are set on the LCD, not by this tool.',
  input_schema: lookupSettingsInputSchema,
  handler: lookupSettings,
};
