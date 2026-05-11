import { describe, expect, it } from 'vitest';
import { lookupDutyCycle } from './lookup_duty_cycle';
import { ToolInputError } from './types';

describe('lookup_duty_cycle', () => {
  it('returns 25% rated band for the README example (MIG 240V 200A)', () => {
    const out = lookupDutyCycle({ process: 'MIG', input_voltage: 240, amperage: 200 });
    expect(out.duty_cycle_pct).toBe(25);
    expect(out.work_minutes).toBe(2.5);
    expect(out.rest_minutes).toBe(7.5);
    expect(out.band).toBe('rated');
    expect(out.source_page).toBe(7);
  });

  it('returns 100% continuous band at or below the continuous current', () => {
    const out = lookupDutyCycle({ process: 'MIG', input_voltage: 240, amperage: 100 });
    expect(out.band).toBe('100pct');
    expect(out.duty_cycle_pct).toBe(100);
    expect(out.work_minutes).toBe(10);
    expect(out.rest_minutes).toBe(0);
  });

  it('returns out_of_range for an amperage above the rated maximum', () => {
    const out = lookupDutyCycle({ process: 'MIG', input_voltage: 240, amperage: 300 });
    expect(out.band).toBe('out_of_range');
    expect(out.notes).toMatch(/exceeds the rated maximum/i);
  });

  it('returns out_of_range for an amperage below the rated minimum', () => {
    const out = lookupDutyCycle({ process: 'MIG', input_voltage: 240, amperage: 5 });
    expect(out.band).toBe('out_of_range');
    expect(out.notes).toMatch(/below the rated range/i);
  });

  it('throws ToolInputError when the (process, voltage) pair has no data', () => {
    expect(() =>
      // @ts-expect-error - exercising a runtime guard with deliberately invalid combo
      lookupDutyCycle({ process: 'Stick', input_voltage: 999, amperage: 100 }),
    ).toThrow(ToolInputError);
  });
});
