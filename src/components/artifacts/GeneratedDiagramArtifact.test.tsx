import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GeneratedDiagramArtifactPayload } from '@/streaming';
import { GeneratedDiagramArtifact } from './GeneratedDiagramArtifact';

const fluxCoredFixture: GeneratedDiagramArtifactPayload = {
  type: 'generated_diagram',
  process: 'flux_cored_mig',
  caption: 'Flux-cored MIG wiring (DCEN).',
  nodes: [
    { id: 'welder', label: 'OmniPro 220', kind: 'welder', x: 160, y: 180 },
    { id: 'pos_terminal', label: '+', kind: 'terminal', x: 220, y: 280 },
    { id: 'neg_terminal', label: '−', kind: 'terminal', x: 140, y: 280 },
    { id: 'electrode', label: 'MIG gun', kind: 'electrode_holder', x: 620, y: 200 },
    { id: 'workpiece', label: 'Workpiece', kind: 'workpiece', x: 540, y: 480 },
    { id: 'ground_clamp', label: 'Ground clamp', kind: 'ground_clamp', x: 620, y: 460 },
  ],
  edges: [
    { from: 'neg_terminal', to: 'electrode', label: 'wire-feed cable', polarity: '-', color: 'black', style: 'solid' },
    { from: 'pos_terminal', to: 'ground_clamp', label: 'work return', polarity: '+', color: 'red', style: 'solid' },
    { from: 'ground_clamp', to: 'workpiece', polarity: 'ground', color: 'green', style: 'dashed' },
  ],
  page_cite: 13,
};

describe('GeneratedDiagramArtifact', () => {
  it('renders the process label and DCEN subtitle for flux-cored MIG', () => {
    const html = renderToStaticMarkup(<GeneratedDiagramArtifact payload={fluxCoredFixture} />);
    expect(html).toContain('Flux-cored MIG wiring');
    expect(html).toContain('DCEN');
  });

  it('renders every node label inside the SVG', () => {
    const html = renderToStaticMarkup(<GeneratedDiagramArtifact payload={fluxCoredFixture} />);
    expect(html).toContain('OmniPro 220');
    expect(html).toContain('MIG gun');
    expect(html).toContain('Workpiece');
    expect(html).toContain('Ground clamp');
  });

  it('includes the safety lead', () => {
    const html = renderToStaticMarkup(<GeneratedDiagramArtifact payload={fluxCoredFixture} />);
    expect(html).toMatch(/Unplug the welder/);
  });

  it('cites the manual page', () => {
    const html = renderToStaticMarkup(<GeneratedDiagramArtifact payload={fluxCoredFixture} />);
    expect(html).toContain('p. 13');
  });

  it('renders an svg with the documented viewbox', () => {
    const html = renderToStaticMarkup(<GeneratedDiagramArtifact payload={fluxCoredFixture} />);
    expect(html).toContain('viewBox="0 0 800 600"');
  });

  it('renders one edge group per payload edge', () => {
    const html = renderToStaticMarkup(<GeneratedDiagramArtifact payload={fluxCoredFixture} />);
    const matches = html.match(/data-slot="diagram-edge"/g) ?? [];
    expect(matches.length).toBe(fluxCoredFixture.edges.length);
  });

  it('does not emit dangerouslySetInnerHTML', () => {
    const html = renderToStaticMarkup(<GeneratedDiagramArtifact payload={fluxCoredFixture} />);
    expect(html).not.toContain('dangerouslySetInnerHTML');
  });
});
