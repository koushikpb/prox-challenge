import { z } from 'zod';
import { polarityTable } from './load-data';
import type { ToolDefinition } from './types';
import { ToolInputError } from './types';

export const lookupPolarityInputSchema = z.object({
  process: z.enum(['MIG_solid', 'MIG_flux', 'TIG', 'Stick']),
});

export type LookupPolarityInput = z.infer<typeof lookupPolarityInputSchema>;

export type LookupPolarityOutput = {
  process: 'MIG_solid' | 'MIG_flux' | 'TIG' | 'Stick';
  polarity: 'DCEP' | 'DCEN';
  ground_socket: 'Positive' | 'Negative';
  electrode_socket: 'Positive' | 'Negative';
  source_page: number;
  region_id: string;
  explanation: string;
};

export function lookupPolarity(input: LookupPolarityInput): LookupPolarityOutput {
  const row = polarityTable.find((r) => r.process === input.process);
  if (!row) {
    throw new ToolInputError(
      `No polarity entry for process=${input.process}. Supported processes: MIG_solid, MIG_flux, TIG, Stick (see data/polarity.json).`,
    );
  }
  return {
    process: row.process,
    polarity: row.polarity_name,
    ground_socket: row.ground_socket,
    electrode_socket: row.electrode_socket,
    source_page: row.source_page,
    region_id: row.region_id,
    explanation: row.explanation,
  };
}

export const lookupPolarityTool: ToolDefinition<LookupPolarityInput, LookupPolarityOutput> = {
  name: 'lookup_polarity',
  description:
    'Return the DC polarity (DCEP/DCEN), ground- and electrode-socket assignments, the owner-manual page, and the labeled diagram region for one of the four welding processes the OmniPro 220 supports.',
  input_schema: lookupPolarityInputSchema,
  handler: lookupPolarity,
};
