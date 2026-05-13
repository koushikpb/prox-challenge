import { describe, expect, it } from 'vitest';
import { renderRegionArtifact } from './render_region_artifact';
import { ToolInputError } from './types';

describe('renderRegionArtifact', () => {
  it('returns the wiring_schematic region payload from the manual data', () => {
    const out = renderRegionArtifact({ region_id: 'wiring_schematic' });
    expect(out.rendered).toBe(true);
    expect(out.artifact.type).toBe('region');
    expect(out.artifact.region_id).toBe('wiring_schematic');
    expect(out.artifact.image_url).toBe('/data/regions/wiring_schematic.png');
    expect(out.artifact.page).toBe(45);
    expect(out.artifact.source).toBe('owner-manual');
    expect(out.artifact.caption).toMatch(/wiring schematic/i);
    expect(out.artifact.title).toBe('Wiring schematic');
  });

  it('returns the parts_diagram region payload from the manual data', () => {
    const out = renderRegionArtifact({ region_id: 'parts_diagram' });
    expect(out.artifact.region_id).toBe('parts_diagram');
    expect(out.artifact.page).toBe(47);
    expect(out.artifact.title).toBe('Parts diagram');
  });

  it('throws ToolInputError with the catalog of known regions for an unknown id', () => {
    let caught: unknown;
    try {
      renderRegionArtifact({ region_id: 'nope' });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ToolInputError);
    const message = (caught as Error).message;
    expect(message).toContain('Unknown region_id "nope"');
    expect(message).toContain('wiring_schematic');
    expect(message).toContain('parts_diagram');
  });

  it('handles the selection_chart region (selection-chart source)', () => {
    const out = renderRegionArtifact({ region_id: 'selection_chart' });
    expect(out.artifact.source).toBe('selection-chart');
    expect(out.artifact.page).toBe(1);
  });
});
