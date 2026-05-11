import { describe, expect, it } from 'vitest';
import { getPageImage } from './get_page_image';
import { ToolInputError } from './types';

describe('get_page_image', () => {
  it('returns the owner-manual page when given a valid page number', () => {
    const out = getPageImage({ page: 7 });
    expect(out.page).toBe(7);
    expect(out.source).toBe('owner-manual');
    expect(out.image_url).toBe('/data/pages/owner-manual-007.png');
    expect(out.caption).toContain('owner-manual p. 7');
  });

  it('prefers owner-manual on page-number collision (page 1)', () => {
    const out = getPageImage({ page: 1 });
    expect(out.source).toBe('owner-manual');
  });

  it('throws ToolInputError for an unknown page number', () => {
    expect(() => getPageImage({ page: 9999 })).toThrow(ToolInputError);
  });
});
