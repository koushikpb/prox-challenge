import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { RegionArtifactPayload } from '@/streaming';
import { RegionArtifact } from './RegionArtifact';

const wiringFixture: RegionArtifactPayload = {
  type: 'region',
  region_id: 'wiring_schematic',
  image_url: '/data/regions/wiring_schematic.png',
  caption:
    'Safety: all internal service requires the welder to be unplugged and fully discharged before any panel is opened. Internal wiring schematic showing the PFC stage, MCU board, IGBT inverter, and output rectification. (p. 45)',
  page: 45,
  source: 'owner-manual',
  title: 'Wiring schematic',
};

const partsFixture: RegionArtifactPayload = {
  type: 'region',
  region_id: 'parts_diagram',
  image_url: '/data/regions/parts_diagram.png',
  caption:
    'Exploded assembly diagram with numbered callouts that line up with the parts list on p. 46. (p. 47)',
  page: 47,
  source: 'owner-manual',
  title: 'Parts diagram',
};

describe('RegionArtifact', () => {
  it('renders the wiring_schematic payload via ArtifactCard chrome', () => {
    const html = renderToStaticMarkup(<RegionArtifact payload={wiringFixture} />);
    expect(html).toContain('data-slot="artifact-tag"');
    expect(html).toContain('data-slot="artifact-page-badge"');
    expect(html).toContain('data-slot="artifact-footer"');
    expect(html).toContain('data-slot="artifact-source-pill"');
    expect(html).toContain('Owner manual');
  });

  it('uses the payload title and a humanized tag label', () => {
    const html = renderToStaticMarkup(<RegionArtifact payload={wiringFixture} />);
    expect(html).toContain('Wiring schematic');
    expect(html).toContain('WIRING SCHEMATIC');
  });

  it('renders the hero image with the region image_url', () => {
    const html = renderToStaticMarkup(<RegionArtifact payload={wiringFixture} />);
    expect(html).toContain('/data/regions/wiring_schematic.png');
  });

  it('renders the caption', () => {
    const html = renderToStaticMarkup(<RegionArtifact payload={wiringFixture} />);
    expect(html).toContain('data-slot="region-caption"');
    expect(html).toContain('PFC stage');
  });

  it('shows the source pill with the correct page number', () => {
    const html = renderToStaticMarkup(<RegionArtifact payload={wiringFixture} />);
    expect(html).toContain('data-page="45"');
    expect(html).toContain('p. 45');
  });

  it('leads the wiring_schematic card with the capacitor-discharge safety line', () => {
    const html = renderToStaticMarkup(<RegionArtifact payload={wiringFixture} />);
    expect(html).toContain('data-slot="artifact-safety"');
    expect(html).toMatch(/capacitors discharge/i);
  });

  it('omits the safety note for non-hazard regions like parts_diagram', () => {
    const html = renderToStaticMarkup(<RegionArtifact payload={partsFixture} />);
    expect(html).not.toContain('data-slot="artifact-safety"');
    expect(html).toContain('PARTS DIAGRAM');
    expect(html).toContain('/data/regions/parts_diagram.png');
    expect(html).toContain('data-page="47"');
  });

  it('shows the polarity-unplug safety note when a polarity_* region is rendered through this card', () => {
    const polarityFixture: RegionArtifactPayload = {
      type: 'region',
      region_id: 'polarity_TIG',
      image_url: '/data/regions/polarity_TIG.png',
      caption: 'TIG polarity diagram. (p. 24)',
      page: 24,
      source: 'owner-manual',
      title: 'Polarity TIG',
    };
    const html = renderToStaticMarkup(<RegionArtifact payload={polarityFixture} />);
    expect(html).toContain('data-slot="artifact-safety"');
    expect(html).toMatch(/changing cable polarity/i);
  });
});
