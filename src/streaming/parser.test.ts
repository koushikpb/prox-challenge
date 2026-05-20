import { describe, expect, it } from 'vitest';
import {
  MAX_DECODED_BYTES_PER_REQUEST,
  MAX_IMAGE_BLOCKS_PER_MESSAGE,
  StreamParseError,
  parseEvent,
  serializeEvent,
  validateUserContent,
} from './parser';
import type {
  ArtifactEvent,
  ArtifactPayload,
  CitationEvent,
  DoneEvent,
  DutyCycleArtifactPayload,
  ErrorEvent,
  GeneratedDiagramArtifactPayload,
  PolarityArtifactPayload,
  RegionArtifactPayload,
  SettingsArtifactPayload,
  StreamEvent,
  TextDeltaEvent,
  ToolCallEndEvent,
  ToolCallStartEvent,
  TroubleshootArtifactPayload,
} from './types';
import { parseArtifactPayload } from './parser';

const dutyCycleFixture = {
  type: 'duty_cycle',
  process: 'MIG',
  input_voltage: 240,
  amperage: 200,
  duty_cycle_pct: 25,
  work_minutes: 2.5,
  rest_minutes: 7.5,
  source_page: 7,
} as const satisfies DutyCycleArtifactPayload;

const polarityFixture = {
  type: 'polarity',
  process: 'MIG_solid',
  ground_socket: 'Negative',
  electrode_socket: 'Positive',
  polarity_name: 'DCEP',
  source_page: 14,
} as const satisfies PolarityArtifactPayload;

const settingsFixture = {
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
  applications: ['general fabrication', 'auto body'],
  source_page: 20,
} as const satisfies SettingsArtifactPayload;

const troubleshootFixture = {
  type: 'troubleshoot',
  symptom: 'porous welds',
  tree: [
    {
      node_id: 'root',
      question: 'Is the shielding gas flowing?',
      options: [
        { label: 'Yes', next: 'gas_ok' },
        { label: 'No', next: 'gas_off' },
      ],
      source_pages: [35, 36],
    },
    {
      node_id: 'gas_off',
      cause: 'Cylinder valve closed or regulator off',
      fixes: ['Open the cylinder valve fully', 'Verify regulator is set to 20–30 SCFH'],
      source_pages: [20],
    },
  ],
} as const satisfies TroubleshootArtifactPayload;

const generatedDiagramFixture = {
  type: 'generated_diagram',
  process: 'flux_cored_mig',
  caption: 'Flux-cored MIG wiring (DCEN).',
  nodes: [
    { id: 'welder', label: 'Welder', kind: 'welder', x: 120, y: 120 },
    { id: 'workpiece', label: 'Workpiece', kind: 'workpiece', x: 540, y: 420 },
    { id: 'gun', label: 'MIG gun', kind: 'electrode_holder', x: 540, y: 200 },
    { id: 'ground', label: 'Ground clamp', kind: 'ground_clamp', x: 540, y: 420 },
  ],
  edges: [
    { from: 'welder', to: 'gun', label: 'wire feed', polarity: '-', color: 'black', style: 'solid' },
    { from: 'welder', to: 'ground', label: 'ground', polarity: '+', color: 'red', style: 'solid' },
    { from: 'ground', to: 'workpiece', color: 'green', style: 'solid' },
  ],
  page_cite: 13,
} as const satisfies GeneratedDiagramArtifactPayload;

const regionFixture = {
  type: 'region',
  region_id: 'wiring_schematic',
  image_url: '/data/regions/wiring_schematic.png',
  caption:
    'Safety: all internal service requires the welder to be unplugged and fully discharged before any panel is opened. Internal wiring schematic showing the PFC stage, MCU board, IGBT inverter, and output rectification. (p. 45)',
  page: 45,
  source: 'owner-manual',
  title: 'Wiring schematic',
} as const satisfies RegionArtifactPayload;

const allArtifactFixtures: readonly ArtifactPayload[] = [
  dutyCycleFixture,
  polarityFixture,
  settingsFixture,
  troubleshootFixture,
  regionFixture,
  generatedDiagramFixture,
];

const textDeltaFixture: TextDeltaEvent = { type: 'text_delta', delta: 'Hello, ' };
const toolCallStartFixture: ToolCallStartEvent = {
  type: 'tool_call_start',
  tool: 'lookup_duty_cycle',
  args_preview: '{"process":"MIG","input_voltage":240,"amperage":200}',
};
const toolCallEndFixture: ToolCallEndEvent = {
  type: 'tool_call_end',
  tool: 'lookup_duty_cycle',
  ok: true,
};
const citationFixture: CitationEvent = { type: 'citation', page: 14, source: 'owner-manual' };
const errorFixture: ErrorEvent = {
  type: 'error',
  message: 'ANTHROPIC_API_KEY missing — set it in .env to run the agent.',
};
const doneFixture: DoneEvent = { type: 'done' };

function artifactEvent(payload: ArtifactPayload): ArtifactEvent {
  return { type: 'artifact', artifact: payload };
}

describe('serializeEvent', () => {
  it('emits a single SSE record terminated by a blank line', () => {
    const out = serializeEvent(textDeltaFixture);
    expect(out).toBe(`data: ${JSON.stringify(textDeltaFixture)}\n\n`);
    expect(out.endsWith('\n\n')).toBe(true);
  });

  it('does not include an event: prefix line', () => {
    expect(serializeEvent(doneFixture).startsWith('event:')).toBe(false);
  });
});

describe('parseEvent round-trips every StreamEvent variant', () => {
  const events: StreamEvent[] = [
    textDeltaFixture,
    toolCallStartFixture,
    toolCallEndFixture,
    citationFixture,
    errorFixture,
    doneFixture,
    ...allArtifactFixtures.map(artifactEvent),
  ];

  for (const event of events) {
    const label =
      event.type === 'artifact' ? `artifact:${event.artifact.type}` : event.type;
    it(`round-trips ${label}`, () => {
      const wire = serializeEvent(event);
      expect(parseEvent(wire)).toEqual(event);
    });
  }

  it('round-trips a tool_call_start without args_preview', () => {
    const event: ToolCallStartEvent = { type: 'tool_call_start', tool: 'get_region' };
    expect(parseEvent(serializeEvent(event))).toEqual(event);
  });

  it('round-trips a settings artifact missing all optional fields', () => {
    const minimalSettings: SettingsArtifactPayload = {
      type: 'settings',
      process: 'TIG',
      material: 'aluminum',
      thickness_in: 0.0625,
      skill_level: 'high',
      gas_required: true,
      cleanliness: 'extremely_clean',
      applications: ['thin-gauge sheet'],
      source_page: 24,
    };
    const event = artifactEvent(minimalSettings);
    expect(parseEvent(serializeEvent(event))).toEqual(event);
  });
});

describe('parseEvent rejects invalid input', () => {
  it('throws StreamParseError for malformed JSON', () => {
    expect(() => parseEvent('data: {not json}\n\n')).toThrow(StreamParseError);
  });

  it('throws StreamParseError for an unknown event type', () => {
    const line = `data: ${JSON.stringify({ type: 'unknown_event', delta: 'x' })}\n\n`;
    expect(() => parseEvent(line)).toThrow(StreamParseError);
  });

  it('throws StreamParseError when an artifact polarity_name is not DCEP or DCEN', () => {
    const bogus = {
      type: 'artifact',
      artifact: { ...polarityFixture, polarity_name: 'DCXY' },
    };
    const line = `data: ${JSON.stringify(bogus)}\n\n`;
    expect(() => parseEvent(line)).toThrow(StreamParseError);
  });

  it('throws StreamParseError when a required field is missing', () => {
    const line = `data: ${JSON.stringify({ type: 'text_delta' })}\n\n`;
    expect(() => parseEvent(line)).toThrow(StreamParseError);
  });

  it('throws StreamParseError when the line is missing the data: prefix', () => {
    expect(() => parseEvent(JSON.stringify(doneFixture))).toThrow(StreamParseError);
  });

  it('throws StreamParseError when an artifact omits source_page', () => {
    const { source_page: _omit, ...rest } = dutyCycleFixture;
    void _omit;
    const line = `data: ${JSON.stringify({ type: 'artifact', artifact: rest })}\n\n`;
    expect(() => parseEvent(line)).toThrow(StreamParseError);
  });
});

// Minimal valid magic-number payloads, padded to 16+ bytes so the
// decodeFirstBytes head check has enough material to inspect.
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const WEBP_HEADER = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const GIF_HEADER = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

function padTo16(prefix: Buffer): string {
  const padding = Buffer.alloc(Math.max(0, 32 - prefix.length));
  return Buffer.concat([prefix, padding]).toString('base64');
}

const SAMPLE_PNG_BASE64 = padTo16(PNG_HEADER);
const SAMPLE_JPEG_BASE64 = padTo16(JPEG_HEADER);
const SAMPLE_WEBP_BASE64 = padTo16(WEBP_HEADER);
const SAMPLE_GIF_BASE64 = padTo16(GIF_HEADER);

describe('validateUserContent', () => {
  it('accepts a plain string (backward compat)', () => {
    expect(validateUserContent('hello')).toBe('hello');
  });

  it('accepts a single text block', () => {
    const blocks = [{ type: 'text', text: 'hi' }];
    expect(validateUserContent(blocks)).toEqual(blocks);
  });

  it.each([
    ['image/png', SAMPLE_PNG_BASE64],
    ['image/jpeg', SAMPLE_JPEG_BASE64],
    ['image/webp', SAMPLE_WEBP_BASE64],
    ['image/gif', SAMPLE_GIF_BASE64],
  ] as const)('accepts a valid %s attachment', (media_type, data) => {
    const blocks = [
      { type: 'text', text: 'look' },
      { type: 'image', source: { type: 'base64', media_type, data } },
    ];
    expect(validateUserContent(blocks)).toEqual(blocks);
  });

  it('rejects an oversized payload (5 MB of zero bytes)', () => {
    const oversize = Buffer.alloc(5 * 1024 * 1024).toString('base64');
    const blocks = [
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: oversize },
      },
    ];
    expect(() => validateUserContent(blocks)).toThrow(StreamParseError);
    expect(() => validateUserContent(blocks)).toThrow(/exceeds/i);
  });

  it(`rejects more than ${MAX_IMAGE_BLOCKS_PER_MESSAGE} image blocks`, () => {
    const block = {
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: 'image/png' as const, data: SAMPLE_PNG_BASE64 },
    };
    const blocks = [block, block, block, block, block];
    expect(() => validateUserContent(blocks)).toThrow(StreamParseError);
    expect(() => validateUserContent(blocks)).toThrow(/limit/i);
  });

  it('rejects a magic-number / media_type mismatch (JPEG bytes with PNG label)', () => {
    const blocks = [
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: SAMPLE_JPEG_BASE64 },
      },
    ];
    expect(() => validateUserContent(blocks)).toThrow(StreamParseError);
    expect(() => validateUserContent(blocks)).toThrow(/media_type/i);
  });

  it('rejects an unsupported media_type', () => {
    const blocks = [
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/svg+xml', data: SAMPLE_PNG_BASE64 },
      },
    ];
    expect(() => validateUserContent(blocks)).toThrow(StreamParseError);
  });

  it('rejects an empty content array', () => {
    expect(() => validateUserContent([])).toThrow(StreamParseError);
  });

  it('exposes the documented decoded-byte cap', () => {
    expect(MAX_DECODED_BYTES_PER_REQUEST).toBe(4 * 1024 * 1024);
  });
});

describe('compile-time payload shape pins', () => {
  it('exposes the fixtures so any future drift surfaces here', () => {
    expect(allArtifactFixtures).toHaveLength(6);
    const kinds = allArtifactFixtures.map((p) => p.type);
    expect(new Set(kinds)).toEqual(
      new Set([
        'duty_cycle',
        'polarity',
        'settings',
        'troubleshoot',
        'region',
        'generated_diagram',
      ]),
    );
  });
});

describe('parseArtifactPayload — generated_diagram structural validation', () => {
  it('accepts a well-formed payload', () => {
    expect(parseArtifactPayload(generatedDiagramFixture)).toEqual(generatedDiagramFixture);
  });

  it('rejects duplicate node ids', () => {
    const bad = {
      ...generatedDiagramFixture,
      nodes: [
        ...generatedDiagramFixture.nodes,
        { id: 'welder', label: 'dup', kind: 'welder', x: 0, y: 0 },
      ],
    };
    expect(() => parseArtifactPayload(bad)).toThrow(/duplicate node id/);
  });

  it('rejects an edge referencing an unknown node', () => {
    const bad = {
      ...generatedDiagramFixture,
      edges: [
        { from: 'welder', to: 'ghost', color: 'red', style: 'solid' },
      ],
    };
    expect(() => parseArtifactPayload(bad)).toThrow(/references unknown node/);
  });

  it('rejects a label exceeding the 32-char cap', () => {
    const bad = {
      ...generatedDiagramFixture,
      nodes: [
        { id: 'welder', label: 'x'.repeat(33), kind: 'welder', x: 0, y: 0 },
        ...generatedDiagramFixture.nodes.slice(1),
      ],
    };
    expect(() => parseArtifactPayload(bad)).toThrow(StreamParseError);
  });

  it('rejects positions outside the 0..800 × 0..600 viewbox', () => {
    const bad = {
      ...generatedDiagramFixture,
      nodes: [
        { id: 'welder', label: 'Welder', kind: 'welder', x: 900, y: 0 },
        ...generatedDiagramFixture.nodes.slice(1),
      ],
    };
    expect(() => parseArtifactPayload(bad)).toThrow(StreamParseError);
  });

  it('rejects fewer than two nodes', () => {
    const bad = {
      ...generatedDiagramFixture,
      nodes: [generatedDiagramFixture.nodes[0]],
      edges: [],
    };
    expect(() => parseArtifactPayload(bad)).toThrow(StreamParseError);
  });
});
