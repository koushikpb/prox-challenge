import { z } from 'zod';
import type { ArtifactPayload, StreamEvent } from './types';

export class StreamParseError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'StreamParseError';
    if (cause !== undefined) this.cause = cause;
  }
}

export const dutyCycleArtifactSchema = z
  .object({
    type: z.literal('duty_cycle'),
    process: z.enum(['MIG', 'TIG', 'Stick']),
    input_voltage: z.union([z.literal(120), z.literal(240)]),
    amperage: z.number(),
    duty_cycle_pct: z.number(),
    work_minutes: z.number(),
    rest_minutes: z.number(),
    source_page: z.number(),
  })
  .strict();

export const polarityArtifactSchema = z
  .object({
    type: z.literal('polarity'),
    process: z.enum(['MIG_solid', 'MIG_flux', 'TIG', 'Stick']),
    ground_socket: z.enum(['Positive', 'Negative']),
    electrode_socket: z.enum(['Positive', 'Negative']),
    polarity_name: z.enum(['DCEP', 'DCEN']),
    source_page: z.number(),
  })
  .strict();

export const settingsArtifactSchema = z
  .object({
    type: z.literal('settings'),
    process: z.enum(['MIG', 'TIG', 'Stick']),
    subprocess: z.enum(['solid-core', 'flux-cored']).optional(),
    material: z.string(),
    thickness_in: z.number(),
    skill_level: z.enum(['low', 'moderate', 'high']),
    gas_required: z.boolean(),
    gas_scfh_min: z.number().optional(),
    gas_scfh_max: z.number().optional(),
    cleanliness: z.enum(['extremely_clean', 'clean_minimal_spatter', 'more_spatter']),
    applications: z.array(z.string()),
    wfs_ipm: z.number().optional(),
    voltage: z.number().optional(),
    notes: z.string().optional(),
    source_page: z.number(),
  })
  .strict();

const troubleshootNodeSchema = z
  .object({
    node_id: z.string(),
    question: z.string().optional(),
    options: z
      .array(z.object({ label: z.string(), next: z.string() }).strict())
      .optional(),
    cause: z.string().optional(),
    fixes: z.array(z.string()).optional(),
    source_pages: z.array(z.number()),
  })
  .strict();

export const troubleshootArtifactSchema = z
  .object({
    type: z.literal('troubleshoot'),
    symptom: z.string(),
    tree: z.array(troubleshootNodeSchema),
  })
  .strict();

export const regionArtifactSchema = z
  .object({
    type: z.literal('region'),
    region_id: z.string().min(1),
    image_url: z.string().min(1),
    caption: z.string(),
    page: z.number(),
    source: z.enum(['owner-manual', 'quick-start', 'selection-chart']),
    title: z.string().optional(),
  })
  .strict();

export const artifactPayloadSchema = z.discriminatedUnion('type', [
  dutyCycleArtifactSchema,
  polarityArtifactSchema,
  settingsArtifactSchema,
  troubleshootArtifactSchema,
  regionArtifactSchema,
]);

const textDeltaSchema = z
  .object({ type: z.literal('text_delta'), delta: z.string() })
  .strict();

const toolCallStartSchema = z
  .object({
    type: z.literal('tool_call_start'),
    tool: z.string(),
    args_preview: z.string().optional(),
  })
  .strict();

const toolCallEndSchema = z
  .object({
    type: z.literal('tool_call_end'),
    tool: z.string(),
    ok: z.boolean(),
  })
  .strict();

const artifactEventSchema = z
  .object({ type: z.literal('artifact'), artifact: artifactPayloadSchema })
  .strict();

const citationEventSchema = z
  .object({
    type: z.literal('citation'),
    page: z.number(),
    source: z.enum(['owner-manual', 'quick-start', 'selection-chart']),
  })
  .strict();

const errorEventSchema = z
  .object({ type: z.literal('error'), message: z.string() })
  .strict();

const doneEventSchema = z.object({ type: z.literal('done') }).strict();

const streamEventSchema = z.discriminatedUnion('type', [
  textDeltaSchema,
  toolCallStartSchema,
  toolCallEndSchema,
  artifactEventSchema,
  citationEventSchema,
  errorEventSchema,
  doneEventSchema,
]);

export function serializeEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function parseEvent(line: string): StreamEvent {
  const trimmed = line.replace(/\r?\n+$/, '');
  if (!trimmed.startsWith('data: ')) {
    throw new StreamParseError(
      `SSE record missing "data: " prefix: received ${JSON.stringify(line.slice(0, 32))}`,
    );
  }
  const json = trimmed.slice('data: '.length);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new StreamParseError('SSE payload is not valid JSON', err);
  }
  const result = streamEventSchema.safeParse(parsed);
  if (!result.success) {
    const summary = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new StreamParseError(`StreamEvent failed validation — ${summary}`, result.error);
  }
  return result.data as StreamEvent;
}

export function parseArtifactPayload(value: unknown): ArtifactPayload {
  const result = artifactPayloadSchema.safeParse(value);
  if (!result.success) {
    const summary = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new StreamParseError(`ArtifactPayload failed validation — ${summary}`, result.error);
  }
  return result.data as ArtifactPayload;
}
