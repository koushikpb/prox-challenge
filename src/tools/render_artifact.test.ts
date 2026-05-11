import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { StreamParseError } from '@/streaming';
import {
  renderDutyCycleArtifact,
  renderDutyCycleArtifactTool,
  renderPolarityArtifact,
  renderPolarityArtifactTool,
  renderSettingsArtifact,
  renderSettingsArtifactTool,
  renderTroubleshootArtifact,
  renderTroubleshootArtifactTool,
  type RenderSettingsArtifactInput,
  type RenderTroubleshootArtifactInput,
} from './render_artifact';
import type { ToolDefinition } from './types';

describe('render_*_artifact — round trips', () => {
  it('renderDutyCycleArtifact builds the typed artifact from a flat payload', () => {
    const out = renderDutyCycleArtifact({
      process: 'MIG',
      input_voltage: 240,
      amperage: 200,
      duty_cycle_pct: 25,
      work_minutes: 2.5,
      rest_minutes: 7.5,
      source_page: 7,
    });
    expect(out.rendered).toBe(true);
    expect(out.artifact).toEqual({
      type: 'duty_cycle',
      process: 'MIG',
      input_voltage: 240,
      amperage: 200,
      duty_cycle_pct: 25,
      work_minutes: 2.5,
      rest_minutes: 7.5,
      source_page: 7,
    });
  });

  it('renderPolarityArtifact builds the typed artifact from a flat payload', () => {
    const out = renderPolarityArtifact({
      process: 'MIG_solid',
      ground_socket: 'Negative',
      electrode_socket: 'Positive',
      polarity_name: 'DCEP',
      source_page: 14,
    });
    expect(out.rendered).toBe(true);
    expect(out.artifact.type).toBe('polarity');
    expect(out.artifact).toMatchObject({ polarity_name: 'DCEP' });
  });

  it('renderSettingsArtifact builds the typed artifact from a flat payload', () => {
    const input: RenderSettingsArtifactInput = {
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
    const out = renderSettingsArtifact(input);
    expect(out.rendered).toBe(true);
    expect(out.artifact.type).toBe('settings');
  });

  it('renderTroubleshootArtifact builds the typed artifact from a flat payload', () => {
    const input: RenderTroubleshootArtifactInput = {
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
    const out = renderTroubleshootArtifact(input);
    expect(out.rendered).toBe(true);
    expect(out.artifact.type).toBe('troubleshoot');
    expect((out.artifact as { tree: unknown[] }).tree).toHaveLength(2);
  });
});

describe('render_*_artifact — real-bug rejections', () => {
  it('renderDutyCycleArtifact rejects the hallucinated { band } payload from the smoke screenshots', () => {
    expect(() =>
      renderDutyCycleArtifactTool.input_schema.parse({ band: 'rated' }),
    ).toThrow();
  });

  it('renderTroubleshootArtifact rejects the hallucinated { defect, process, causes, notes } payload', () => {
    expect(() =>
      renderTroubleshootArtifactTool.input_schema.parse({
        defect: 'porosity',
        process: 'MIG',
        causes: ['low gas flow', 'dirty base metal'],
        notes: 'check the regulator',
      }),
    ).toThrow();
  });

  it('renderPolarityArtifact rejects an out-of-enum polarity_name and throws StreamParseError from the handler when bypassed', () => {
    expect(() =>
      renderPolarityArtifactTool.input_schema.parse({
        process: 'TIG',
        ground_socket: 'Positive',
        electrode_socket: 'Negative',
        polarity_name: 'DCXY',
        source_page: 24,
      }),
    ).toThrow();
    expect(() =>
      // bypass the input schema to confirm the handler still defends via parseArtifactPayload
      renderPolarityArtifact({
        process: 'TIG',
        ground_socket: 'Positive',
        electrode_socket: 'Negative',
        polarity_name: 'DCXY' as unknown as 'DCEN',
        source_page: 24,
      }),
    ).toThrow(StreamParseError);
  });

  it('renderSettingsArtifact rejects unknown fields (strict mode)', () => {
    expect(() =>
      renderSettingsArtifactTool.input_schema.parse({
        process: 'MIG',
        material: 'mild_steel',
        thickness_in: 0.125,
        skill_level: 'low',
        gas_required: false,
        cleanliness: 'more_spatter',
        applications: ['hobby'],
        source_page: 21,
        wfs_label: '6 o’clock',
      }),
    ).toThrow();
  });

  it('every per-type tool rejects a payload that carries an extra `type` field', () => {
    const tools = [
      renderDutyCycleArtifactTool,
      renderPolarityArtifactTool,
      renderSettingsArtifactTool,
      renderTroubleshootArtifactTool,
    ];
    for (const tool of tools) {
      expect(() => tool.input_schema.parse({ type: 'duty_cycle' })).toThrow();
    }
  });
});

describe('render_*_artifact — JSON-Schema shape for the Anthropic tools API', () => {
  const renderTools: Array<ToolDefinition<unknown, unknown>> = [
    renderDutyCycleArtifactTool as unknown as ToolDefinition<unknown, unknown>,
    renderPolarityArtifactTool as unknown as ToolDefinition<unknown, unknown>,
    renderSettingsArtifactTool as unknown as ToolDefinition<unknown, unknown>,
    renderTroubleshootArtifactTool as unknown as ToolDefinition<unknown, unknown>,
  ];

  it.each(renderTools.map((t) => [t.name, t] as const))(
    '%s emits a plain object root schema with no top-level oneOf/anyOf/allOf',
    (_name, tool) => {
      const json = z.toJSONSchema(tool.input_schema, {
        target: 'draft-7',
        unrepresentable: 'any',
      }) as Record<string, unknown>;
      expect(json.type).toBe('object');
      expect(json.oneOf).toBeUndefined();
      expect(json.anyOf).toBeUndefined();
      expect(json.allOf).toBeUndefined();
      const properties = json.properties as Record<string, unknown> | undefined;
      expect(properties).toBeDefined();
      // The discriminator `type` must not be on the input schema — the tool name carries it.
      expect(properties?.type).toBeUndefined();
    },
  );
});
