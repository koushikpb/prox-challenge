import { describe, expect, it } from 'vitest';
import { StreamParseError, parseEvent, serializeEvent } from './parser';
import type {
  ArtifactEvent,
  ArtifactPayload,
  CitationEvent,
  DoneEvent,
  DutyCycleArtifactPayload,
  ErrorEvent,
  PolarityArtifactPayload,
  RegionArtifactPayload,
  SettingsArtifactPayload,
  StreamEvent,
  TextDeltaEvent,
  ToolCallEndEvent,
  ToolCallStartEvent,
  TroubleshootArtifactPayload,
} from './types';

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

describe('compile-time payload shape pins', () => {
  it('exposes the fixtures so any future drift surfaces here', () => {
    expect(allArtifactFixtures).toHaveLength(5);
    const kinds = allArtifactFixtures.map((p) => p.type);
    expect(new Set(kinds)).toEqual(
      new Set(['duty_cycle', 'polarity', 'settings', 'troubleshoot', 'region']),
    );
  });
});
