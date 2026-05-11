import { describe, expect, it } from 'vitest';
import { getRegion } from './get_region';
import { ToolInputError } from './types';

describe('get_region', () => {
  it('resolves the TIG polarity region', () => {
    const out = getRegion({ region_id: 'polarity_TIG' });
    expect(out.image_url.startsWith('/data/regions/')).toBe(true);
    expect(out.page).toBe(24);
    expect(out.source).toBe('owner-manual');
  });

  it('resolves the selection chart region', () => {
    const out = getRegion({ region_id: 'selection_chart' });
    expect(out.source).toBe('selection-chart');
    expect(out.page).toBe(1);
  });

  it('throws ToolInputError for an unknown region_id', () => {
    expect(() => getRegion({ region_id: 'not_a_real_region' })).toThrow(ToolInputError);
  });
});
