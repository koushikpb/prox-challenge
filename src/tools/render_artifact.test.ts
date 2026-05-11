import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { StreamParseError } from '@/streaming';
import {
  renderArtifact,
  renderArtifactInputSchema,
  type RenderArtifactInput,
} from './render_artifact';

describe('render_artifact — round trips', () => {
  it('round-trips a duty_cycle payload', () => {
    const payload = {
      type: 'duty_cycle',
      process: 'MIG',
      input_voltage: 240,
      amperage: 200,
      duty_cycle_pct: 25,
      work_minutes: 2.5,
      rest_minutes: 7.5,
      source_page: 7,
    } as const;
    const out = renderArtifact(payload);
    expect(out.rendered).toBe(true);
    expect(out.artifact).toEqual(payload);
  });

  it('round-trips a polarity payload', () => {
    const payload = {
      type: 'polarity',
      process: 'MIG_solid',
      ground_socket: 'Negative',
      electrode_socket: 'Positive',
      polarity_name: 'DCEP',
      source_page: 14,
    } as const;
    const out = renderArtifact(payload);
    expect(out.rendered).toBe(true);
    expect(out.artifact).toEqual(payload);
  });

  it('round-trips a settings payload (no wfs_ipm / voltage — synergic welder)', () => {
    const payload: RenderArtifactInput = {
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
      source_page: 21,
    };
    const out = renderArtifact(payload);
    expect(out.rendered).toBe(true);
    expect(out.artifact).toEqual(payload);
  });

  it('round-trips a troubleshoot payload with a branching node and a leaf', () => {
    const payload: RenderArtifactInput = {
      type: 'troubleshoot',
      symptom: 'porosity',
      tree: [
        {
          node_id: 'root',
          question: 'Is your shielding gas flowing?',
          options: [
            { label: 'Yes', next: 'leak_check' },
            { label: 'No', next: 'open_valve' },
          ],
          source_pages: [38],
        },
        {
          node_id: 'open_valve',
          cause: 'Shielding gas valve closed or empty cylinder.',
          fixes: [
            'Open the cylinder valve and confirm regulator pressure.',
            'Replace the cylinder if empty.',
          ],
          source_pages: [38],
        },
      ],
    };
    const out = renderArtifact(payload);
    expect(out.rendered).toBe(true);
    expect(out.artifact).toEqual(payload);
  });
});

describe('render_artifact — real-bug rejections', () => {
  it('rejects the hallucinated duty_cycle payload from the smoke screenshots ({ band })', () => {
    expect(() =>
      renderArtifact({
        type: 'duty_cycle',
        // @ts-expect-error — `band` is a lookup_duty_cycle output field, not a payload field
        band: 'rated',
      }),
    ).toThrow();
  });

  it('rejects the hallucinated troubleshoot payload from the smoke screenshots', () => {
    expect(() =>
      renderArtifact({
        type: 'troubleshoot',
        // @ts-expect-error — invented field set, not the documented { symptom, tree } shape
        defect: 'porosity',
        process: 'MIG',
        causes: ['low gas flow', 'dirty base metal'],
        notes: 'check the regulator',
      }),
    ).toThrow();
  });

  it('keeps the prior polarity_name enum rejection', () => {
    expect(() =>
      renderArtifact({
        type: 'polarity',
        process: 'TIG',
        ground_socket: 'Positive',
        electrode_socket: 'Negative',
        // @ts-expect-error — DCXY is not in the enum
        polarity_name: 'DCXY',
        source_page: 24,
      }),
    ).toThrow(StreamParseError);
  });

  it('rejects strict-mode unknown fields on a settings payload', () => {
    expect(() =>
      renderArtifact({
        type: 'settings',
        process: 'MIG',
        material: 'mild_steel',
        thickness_in: 0.125,
        skill_level: 'low',
        gas_required: false,
        cleanliness: 'more_spatter',
        applications: ['hobby'],
        source_page: 21,
        // @ts-expect-error — strict mode rejects unknown keys
        wfs_label: '6 o’clock',
      }),
    ).toThrow();
  });
});

describe('render_artifact — JSON-Schema shape', () => {
  it('produces a four-variant discriminated schema (oneOf or anyOf over the four types)', () => {
    const json = z.toJSONSchema(renderArtifactInputSchema, {
      target: 'draft-7',
      unrepresentable: 'any',
    }) as Record<string, unknown>;
    const variants =
      (json.oneOf as Array<Record<string, unknown>> | undefined) ??
      (json.anyOf as Array<Record<string, unknown>> | undefined);
    expect(Array.isArray(variants)).toBe(true);
    expect(variants).toHaveLength(4);

    const typeConsts = variants!
      .map((v) => {
        const props = v.properties as Record<string, Record<string, unknown>> | undefined;
        return props?.type?.const as string | undefined;
      })
      .filter((t): t is string => typeof t === 'string')
      .sort();
    expect(typeConsts).toEqual(
      ['duty_cycle', 'polarity', 'settings', 'troubleshoot'].sort(),
    );
  });
});
