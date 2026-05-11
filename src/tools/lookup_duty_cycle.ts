import { z } from 'zod';
import { dutyCycleTable } from './load-data';
import type { ToolDefinition } from './types';
import { ToolInputError } from './types';

export const lookupDutyCycleInputSchema = z.object({
  process: z.enum(['MIG', 'TIG', 'Stick']),
  input_voltage: z.union([z.literal(120), z.literal(240)]),
  amperage: z.number().positive(),
});

export type LookupDutyCycleInput = z.infer<typeof lookupDutyCycleInputSchema>;

export type DutyCycleBand = 'rated' | '100pct' | 'out_of_range';

export type LookupDutyCycleOutput = {
  process: 'MIG' | 'TIG' | 'Stick';
  input_voltage: 120 | 240;
  amperage: number;
  duty_cycle_pct: number;
  work_minutes: number;
  rest_minutes: number;
  source_page: number;
  band: DutyCycleBand;
  notes?: string;
};

export function lookupDutyCycle(input: LookupDutyCycleInput): LookupDutyCycleOutput {
  const row = dutyCycleTable.find(
    (r) => r.process === input.process && r.input_voltage === input.input_voltage,
  );
  if (!row) {
    throw new ToolInputError(
      `No duty-cycle data for process=${input.process} on ${input.input_voltage}V input. Supported combinations are listed in data/duty_cycle.json.`,
    );
  }

  const { rated, continuous, current_range, source_page } = row;

  if (input.amperage < current_range.min_a) {
    return {
      process: row.process,
      input_voltage: row.input_voltage,
      amperage: input.amperage,
      duty_cycle_pct: 100,
      work_minutes: 10,
      rest_minutes: 0,
      source_page,
      band: 'out_of_range',
      notes: `Requested amperage ${input.amperage}A is below the rated range (${current_range.min_a}–${current_range.max_a}A). Returning continuous-duty figures; verify the welder will actually produce this current.`,
    };
  }

  if (input.amperage > current_range.max_a) {
    return {
      process: row.process,
      input_voltage: row.input_voltage,
      amperage: input.amperage,
      duty_cycle_pct: rated.duty_cycle_pct,
      work_minutes: rated.work_minutes,
      rest_minutes: rated.rest_minutes,
      source_page,
      band: 'out_of_range',
      notes: `Requested amperage ${input.amperage}A exceeds the rated maximum (${current_range.max_a}A). The welder is not rated for this current — figures shown are the rated band's worst-case as a conservative reference.`,
    };
  }

  if (input.amperage <= continuous.amperage) {
    return {
      process: row.process,
      input_voltage: row.input_voltage,
      amperage: input.amperage,
      duty_cycle_pct: 100,
      work_minutes: 10,
      rest_minutes: 0,
      source_page,
      band: '100pct',
      notes: `At ${input.amperage}A on ${input.input_voltage}V input, the welder runs continuously (≤ ${continuous.amperage}A 100% duty-cycle limit, p. ${source_page}).`,
    };
  }

  return {
    process: row.process,
    input_voltage: row.input_voltage,
    amperage: input.amperage,
    duty_cycle_pct: rated.duty_cycle_pct,
    work_minutes: rated.work_minutes,
    rest_minutes: rated.rest_minutes,
    source_page,
    band: 'rated',
  };
}

export const lookupDutyCycleTool: ToolDefinition<LookupDutyCycleInput, LookupDutyCycleOutput> = {
  name: 'lookup_duty_cycle',
  description:
    'Look up the rated duty cycle for the Vulcan OmniPro 220 at a given process, input voltage, and welding amperage. Returns work/rest minutes per 10-minute period and which band the amperage falls into (rated / 100% continuous / out of range).',
  input_schema: lookupDutyCycleInputSchema,
  handler: lookupDutyCycle,
};
