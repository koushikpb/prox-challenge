import { describe, expect, it } from 'vitest';
import { searchManual } from './search_manual';

describe('search_manual', () => {
  it('returns pages 37 and 40 in its top hits for "porosity"', () => {
    const { hits } = searchManual({ query: 'porosity' });
    const pages = hits.map((h) => h.page);
    expect(pages).toContain(37);
    expect(pages).toContain(40);
  });

  it('returns at least one page in the 10–17 range for "wire feed"', () => {
    const { hits } = searchManual({ query: 'wire feed' });
    expect(hits.some((h) => h.page >= 10 && h.page <= 17)).toBe(true);
  });

  it('respects top_k', () => {
    const { hits } = searchManual({ query: 'welding', top_k: 3 });
    expect(hits.length).toBeLessThanOrEqual(3);
  });

  it('returns an empty hits array when no token overlaps the corpus', () => {
    const { hits } = searchManual({ query: 'xyzzyfoobarbaz' });
    expect(hits).toHaveLength(0);
  });

  it('emits a snippet that contains the matched token where possible', () => {
    const { hits } = searchManual({ query: 'porosity' });
    expect(hits[0]?.text_snippet.toLowerCase()).toContain('poros');
  });
});
