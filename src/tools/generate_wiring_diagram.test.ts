import { describe, expect, it } from 'vitest';
import { generateWiringDiagram } from './generate_wiring_diagram';

describe('generateWiringDiagram', () => {
  it('returns a generated_diagram artifact for flux_cored_mig', () => {
    const out = generateWiringDiagram({ process: 'flux_cored_mig' });
    expect(out.rendered).toBe(true);
    expect(out.artifact.type).toBe('generated_diagram');
    expect(out.artifact.process).toBe('flux_cored_mig');
    expect(out.artifact.nodes.length).toBeGreaterThanOrEqual(2);
    expect(out.artifact.edges.length).toBeGreaterThanOrEqual(1);
    expect(out.artifact.page_cite).toBe(13);
  });

  it('appends user notes to the canonical caption', () => {
    const out = generateWiringDiagram({
      process: 'stick_dcep',
      notes: 'Steel plate, 6011 rod',
    });
    expect(out.artifact.caption.endsWith('Steel plate, 6011 rod')).toBe(true);
    expect(out.artifact.caption.length).toBeLessThanOrEqual(320);
  });

  it('clamps an oversized notes string', () => {
    const longNote = 'x'.repeat(400);
    const out = generateWiringDiagram({ process: 'tig_dcen', notes: longNote });
    expect(out.artifact.caption.length).toBeLessThanOrEqual(320);
  });

  it('preserves a 120-char notes string on stick_dcen without truncation', () => {
    const longNote = 'a'.repeat(120);
    const out = generateWiringDiagram({ process: 'stick_dcen', notes: longNote });
    expect(out.artifact.caption.includes(longNote)).toBe(true);
    expect(out.artifact.caption.length).toBeLessThanOrEqual(320);
  });

  it('flux-cored MIG cable goes from negative terminal (DCEN)', () => {
    const out = generateWiringDiagram({ process: 'flux_cored_mig' });
    const electrodeEdge = out.artifact.edges.find((e) => e.to === 'electrode');
    expect(electrodeEdge?.from).toBe('neg_terminal');
    expect(electrodeEdge?.polarity).toBe('-');
  });

  it('solid-wire MIG cable goes from positive terminal (DCEP)', () => {
    const out = generateWiringDiagram({ process: 'solid_wire_mig' });
    const electrodeEdge = out.artifact.edges.find((e) => e.to === 'electrode');
    expect(electrodeEdge?.from).toBe('pos_terminal');
    expect(electrodeEdge?.polarity).toBe('+');
  });
});
