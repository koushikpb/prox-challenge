import { describe, expect, it } from 'vitest';
import { SYNERGIC_NOTE, lookupSettings } from './lookup_settings';

describe('lookup_settings', () => {
  it('returns the solid-core MIG row for mild steel @ 0.125" and includes the synergic note', () => {
    const out = lookupSettings({ process: 'MIG', material: 'mild_steel', thickness_in: 0.125 });
    const solid = out.matches.find((m) => m.subprocess === 'solid-core');
    expect(solid, 'expected at least one MIG solid-core mild-steel match').toBeDefined();
    expect(solid?.gas_required).toBe(true);
    expect(solid?.gas_scfh_min).toBe(20);
    expect(solid?.gas_scfh_max).toBe(30);
    expect(out.synergic_note).toBe(SYNERGIC_NOTE);
  });

  it('also surfaces the flux-cored row at 0.125" since both ranges cover it', () => {
    const out = lookupSettings({ process: 'MIG', material: 'mild_steel', thickness_in: 0.125 });
    expect(out.matches.some((m) => m.subprocess === 'flux-cored')).toBe(true);
  });

  it('returns the nearest row(s) with a note when thickness is above the max', () => {
    const out = lookupSettings({ process: 'MIG', material: 'mild_steel', thickness_in: 2.0 });
    expect(out.matches.length).toBeGreaterThan(0);
    expect(out.matches[0]?.notes).toMatch(/out of range/i);
    expect(out.synergic_note).toBe(SYNERGIC_NOTE);
  });

  it('returns an empty matches array but still includes the synergic note for an unknown material', () => {
    const out = lookupSettings({ process: 'MIG', material: 'titanium', thickness_in: 0.125 });
    expect(out.matches).toHaveLength(0);
    expect(out.synergic_note).toBe(SYNERGIC_NOTE);
  });

  it('accepts capitalized material names by normalizing to the underscore form', () => {
    const out = lookupSettings({ process: 'MIG', material: 'Mild Steel', thickness_in: 0.125 });
    expect(out.matches.length).toBeGreaterThan(0);
  });
});
