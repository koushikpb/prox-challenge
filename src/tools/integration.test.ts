import { describe, expect, it } from 'vitest';
import { toolRegistry } from './index';
import { lookupPolarity } from './lookup_polarity';
import { getRegion } from './get_region';
import { searchManual } from './search_manual';
import { renderArtifact } from './render_artifact';

describe('tool registry contract', () => {
  it('registers exactly the seven Spec-defined tools', () => {
    const names = toolRegistry.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        'get_page_image',
        'get_region',
        'lookup_duty_cycle',
        'lookup_polarity',
        'lookup_settings',
        'render_artifact',
        'search_manual',
      ].sort(),
    );
  });

  it('every tool has a non-empty description and a zod input_schema', () => {
    for (const tool of toolRegistry) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(typeof tool.input_schema.safeParse).toBe('function');
    }
  });
});

describe('cross-tool grounding', () => {
  it('every polarity row resolves through get_region to a real image_url', () => {
    for (const process of ['MIG_solid', 'MIG_flux', 'TIG', 'Stick'] as const) {
      const polarity = lookupPolarity({ process });
      const region = getRegion({ region_id: polarity.region_id });
      expect(region.image_url.startsWith('/data/regions/')).toBe(true);
      expect(region.page).toBe(polarity.source_page);
    }
  });

  it('search_manual hits surface real, addressable page image_paths', () => {
    const { hits } = searchManual({ query: 'duty cycle' });
    for (const hit of hits) {
      expect(hit.image_path.startsWith('/data/pages/')).toBe(true);
    }
  });

  it('render_artifact validates a fully-populated settings payload', () => {
    const out = renderArtifact({
      type: 'settings',
      process: 'MIG',
      subprocess: 'solid-core',
      material: 'mild_steel',
      thickness_in: 0.125,
      skill_level: 'moderate',
      gas_required: true,
      gas_scfh_min: 20,
      gas_scfh_max: 30,
      cleanliness: 'clean_minimal_spatter',
      applications: ['general fabrication'],
      source_page: 1,
    });
    expect(out.rendered).toBe(true);
    expect(out.artifact.type).toBe('settings');
  });
});
