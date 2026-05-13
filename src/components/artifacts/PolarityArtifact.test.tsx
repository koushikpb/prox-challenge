import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { PolarityArtifact } from './PolarityArtifact';
import { polarityFixture } from '@/app/(dev)/artifacts/fixtures';

describe('PolarityArtifact', () => {
  it('renders the default payload', () => {
    const html = renderToStaticMarkup(<PolarityArtifact payload={polarityFixture} />);
    expect(html).toMatchSnapshot();
  });

  it('shows the DCEP badge for solid-core MIG by default', () => {
    const html = renderToStaticMarkup(<PolarityArtifact payload={polarityFixture} />);
    expect(html).toContain('DCEP');
  });

  it('renders the ArtifactCard chrome — tag, page badge, source pill in footer', () => {
    const html = renderToStaticMarkup(<PolarityArtifact payload={polarityFixture} />);
    expect(html).toContain('data-slot="artifact-tag"');
    expect(html).toContain('data-slot="artifact-page-badge"');
    expect(html).toContain('data-slot="artifact-footer"');
    expect(html).toContain('data-slot="artifact-source-pill"');
    expect(html).toContain('Owner manual');
  });

  it('renders all four process tabs', () => {
    const html = renderToStaticMarkup(<PolarityArtifact payload={polarityFixture} />);
    const tabs = html.match(/data-slot="polarity-tab"/g) ?? [];
    expect(tabs.length).toBe(4);
    expect(html).toContain('data-process="Stick"');
    expect(html).toContain('data-process="TIG"');
    expect(html).toContain('data-process="MIG_solid"');
    expect(html).toContain('data-process="MIG_flux"');
  });

  it('selects the payload-derived tab by default and surfaces the matching region image', () => {
    const html = renderToStaticMarkup(<PolarityArtifact payload={polarityFixture} />);
    // payload is MIG_solid → DCEP solid-core hero
    expect(html).toContain('polarity_DCEP_solid_core.png');
    // Exactly one tab is aria-selected="true"; locate the matching data-process.
    const tabPattern = /<button[^>]*role="tab"[^>]*data-process="([^"]+)"/g;
    const allTabs = [...html.matchAll(tabPattern)].map((m) => m[0]);
    const selectedTabs = allTabs.filter((tab) => tab.includes('aria-selected="true"'));
    expect(selectedTabs.length).toBe(1);
    const selectedProcess = selectedTabs[0]!.match(/data-process="([^"]+)"/)?.[1];
    expect(selectedProcess).toBe('MIG_solid');
  });

  it('uses the flux-core hero when the payload selects MIG_flux', () => {
    const html = renderToStaticMarkup(
      <PolarityArtifact
        payload={{
          type: 'polarity',
          process: 'MIG_flux',
          ground_socket: 'Positive',
          electrode_socket: 'Negative',
          polarity_name: 'DCEN',
          source_page: 13,
        }}
      />,
    );
    expect(html).toContain('polarity_DCEN_flux_cored.png');
    expect(html).toContain('DCEN');
  });

  it('uses the TIG hero when the payload selects TIG', () => {
    const html = renderToStaticMarkup(
      <PolarityArtifact
        payload={{
          type: 'polarity',
          process: 'TIG',
          ground_socket: 'Positive',
          electrode_socket: 'Negative',
          polarity_name: 'DCEN',
          source_page: 24,
        }}
      />,
    );
    expect(html).toContain('polarity_TIG.png');
  });

  it('uses the Stick hero when the payload selects Stick', () => {
    const html = renderToStaticMarkup(
      <PolarityArtifact
        payload={{
          type: 'polarity',
          process: 'Stick',
          ground_socket: 'Negative',
          electrode_socket: 'Positive',
          polarity_name: 'DCEP',
          source_page: 27,
        }}
      />,
    );
    expect(html).toContain('polarity_Stick.png');
  });

  it('renders the safety unplug warning above the diagram', () => {
    const html = renderToStaticMarkup(<PolarityArtifact payload={polarityFixture} />);
    expect(html).toContain('data-slot="artifact-safety"');
    expect(html).toContain('Unplug the welder');
  });
});
