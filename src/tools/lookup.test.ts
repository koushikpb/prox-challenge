import { describe, expect, it } from 'vitest';
import dutyCycleJson from '@/data/duty_cycle.json';
import polarityJson from '@/data/polarity.json';
import settingsJson from '@/data/settings.json';
import troubleshootingJson from '@/data/troubleshooting.json';
import partsJson from '@/data/parts.json';
import {
  dutyCycleSchema,
  partsSchema,
  polaritySchema,
  settingsSchema,
  troubleshootingSchema,
} from '@/data/schemas';

describe('structured-data schemas', () => {
  it('duty_cycle.json validates against dutyCycleSchema', () => {
    const result = dutyCycleSchema.safeParse(dutyCycleJson);
    expect(result.success, JSON.stringify(result.error?.issues, null, 2)).toBe(true);
  });

  it('polarity.json validates against polaritySchema', () => {
    const result = polaritySchema.safeParse(polarityJson);
    expect(result.success, JSON.stringify(result.error?.issues, null, 2)).toBe(true);
  });

  it('settings.json validates against settingsSchema', () => {
    const result = settingsSchema.safeParse(settingsJson);
    expect(result.success, JSON.stringify(result.error?.issues, null, 2)).toBe(true);
  });

  it('troubleshooting.json validates against troubleshootingSchema', () => {
    const result = troubleshootingSchema.safeParse(troubleshootingJson);
    expect(result.success, JSON.stringify(result.error?.issues, null, 2)).toBe(true);
  });

  it('parts.json validates against partsSchema', () => {
    const result = partsSchema.safeParse(partsJson);
    expect(result.success, JSON.stringify(result.error?.issues, null, 2)).toBe(true);
  });
});

describe('README example facts', () => {
  it('MIG @ 200 A on 240 V → duty_cycle_pct === 25', () => {
    const dutyCycle = dutyCycleSchema.parse(dutyCycleJson);
    const row = dutyCycle.find(
      (r) => r.process === 'MIG' && r.input_voltage === 240 && r.rated.amperage === 200,
    );
    expect(row, 'expected MIG / 240V / 200A row to exist').toBeDefined();
    expect(row?.rated.duty_cycle_pct).toBe(25);
  });

  it('TIG ground socket === "Positive"', () => {
    const polarity = polaritySchema.parse(polarityJson);
    const row = polarity.find((r) => r.process === 'TIG');
    expect(row, 'expected TIG polarity row to exist').toBeDefined();
    expect(row?.ground_socket).toBe('Positive');
  });

  it('Flux-cored DCEN ground socket === "Positive"', () => {
    const polarity = polaritySchema.parse(polarityJson);
    const row = polarity.find((r) => r.process === 'MIG_flux' && r.polarity_name === 'DCEN');
    expect(row, 'expected MIG_flux / DCEN polarity row to exist').toBeDefined();
    expect(row?.ground_socket).toBe('Positive');
  });
});
