import { describe, expect, it } from 'vitest';
import { lookupPolarity } from './lookup_polarity';
import { lookupPolarityInputSchema } from './lookup_polarity';

describe('lookup_polarity', () => {
  it('returns DCEN with Positive ground for TIG (canonical example)', () => {
    const out = lookupPolarity({ process: 'TIG' });
    expect(out.polarity).toBe('DCEN');
    expect(out.ground_socket).toBe('Positive');
    expect(out.electrode_socket).toBe('Negative');
    expect(out.region_id).toBe('polarity_TIG');
    expect(out.source_page).toBe(24);
  });

  it('returns DCEN with Positive ground for flux-cored MIG (canonical example)', () => {
    const out = lookupPolarity({ process: 'MIG_flux' });
    expect(out.polarity).toBe('DCEN');
    expect(out.ground_socket).toBe('Positive');
    expect(out.electrode_socket).toBe('Negative');
    expect(out.region_id).toBe('polarity_DCEN_flux_cored');
  });

  it('returns DCEP with Negative ground for solid-core MIG', () => {
    const out = lookupPolarity({ process: 'MIG_solid' });
    expect(out.polarity).toBe('DCEP');
    expect(out.ground_socket).toBe('Negative');
    expect(out.electrode_socket).toBe('Positive');
    expect(out.region_id).toBe('polarity_DCEP_solid_core');
  });

  it('rejects unsupported processes via the input schema', () => {
    expect(lookupPolarityInputSchema.safeParse({ process: 'Plasma' }).success).toBe(false);
  });
});
