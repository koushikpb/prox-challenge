import { describe, expect, it } from 'vitest';
import { parseArtifactPayload } from '@/streaming';
import type { WiringProcess } from '@/streaming';
import { polarityTable } from './load-data';
import { WIRING_DIAGRAMS } from './wiring-diagrams';

const processes: WiringProcess[] = [
  'solid_wire_mig',
  'flux_cored_mig',
  'tig_dcen',
  'stick_dcep',
  'stick_dcen',
];

describe('WIRING_DIAGRAMS canonical layouts', () => {
  it.each(processes)('parses against the artifact schema for %s', (process) => {
    const layout = WIRING_DIAGRAMS[process];
    expect(() =>
      parseArtifactPayload({
        type: 'generated_diagram',
        process,
        nodes: layout.nodes,
        edges: layout.edges,
        caption: layout.caption,
        page_cite: layout.page_cite,
      }),
    ).not.toThrow();
  });

  it.each(processes)('cites a non-zero manual page for %s', (process) => {
    expect(WIRING_DIAGRAMS[process].page_cite).toBeGreaterThan(0);
  });

  it('solid_wire_mig matches data/polarity.json MIG_solid (DCEP)', () => {
    const row = polarityTable.find((p) => p.process === 'MIG_solid');
    expect(row).toBeDefined();
    const layout = WIRING_DIAGRAMS.solid_wire_mig;
    expect(layout.polarity_name).toBe(row!.polarity_name);
    expect(layout.electrode_terminal).toBe(row!.electrode_socket);
    expect(layout.ground_terminal).toBe(row!.ground_socket);
    expect(layout.page_cite).toBe(row!.source_page);
  });

  it('flux_cored_mig matches data/polarity.json MIG_flux (DCEN)', () => {
    const row = polarityTable.find((p) => p.process === 'MIG_flux');
    expect(row).toBeDefined();
    const layout = WIRING_DIAGRAMS.flux_cored_mig;
    expect(layout.polarity_name).toBe(row!.polarity_name);
    expect(layout.electrode_terminal).toBe(row!.electrode_socket);
    expect(layout.ground_terminal).toBe(row!.ground_socket);
    expect(layout.page_cite).toBe(row!.source_page);
  });

  it('tig_dcen matches data/polarity.json TIG (DCEN)', () => {
    const row = polarityTable.find((p) => p.process === 'TIG');
    expect(row).toBeDefined();
    const layout = WIRING_DIAGRAMS.tig_dcen;
    expect(layout.polarity_name).toBe(row!.polarity_name);
    expect(layout.electrode_terminal).toBe(row!.electrode_socket);
    expect(layout.ground_terminal).toBe(row!.ground_socket);
    expect(layout.page_cite).toBe(row!.source_page);
  });

  it('stick_dcep matches data/polarity.json Stick (DCEP)', () => {
    const row = polarityTable.find((p) => p.process === 'Stick');
    expect(row).toBeDefined();
    const layout = WIRING_DIAGRAMS.stick_dcep;
    expect(layout.polarity_name).toBe(row!.polarity_name);
    expect(layout.electrode_terminal).toBe(row!.electrode_socket);
    expect(layout.ground_terminal).toBe(row!.ground_socket);
    expect(layout.page_cite).toBe(row!.source_page);
  });

  it('stick_dcen reverses Stick polarity for specialty rods', () => {
    const layout = WIRING_DIAGRAMS.stick_dcen;
    expect(layout.polarity_name).toBe('DCEN');
    expect(layout.electrode_terminal).toBe('Negative');
    expect(layout.ground_terminal).toBe('Positive');
    expect(layout.page_cite).toBe(27);
  });

  it('all layouts include the workpiece + ground_clamp + electrode + welder + both terminals', () => {
    for (const process of processes) {
      const nodes = new Set(WIRING_DIAGRAMS[process].nodes.map((n) => n.id));
      expect(nodes.has('welder')).toBe(true);
      expect(nodes.has('pos_terminal')).toBe(true);
      expect(nodes.has('neg_terminal')).toBe(true);
      expect(nodes.has('electrode')).toBe(true);
      expect(nodes.has('workpiece')).toBe(true);
      expect(nodes.has('ground_clamp')).toBe(true);
    }
  });
});

