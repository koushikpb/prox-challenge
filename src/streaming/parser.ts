import { z } from 'zod';
import type { ArtifactPayload, ImageMediaType, StreamEvent, UserContentBlock } from './types';

export const MAX_IMAGE_BLOCKS_PER_MESSAGE = 4;
export const MAX_DECODED_BYTES_PER_REQUEST = 4 * 1024 * 1024;

const IMAGE_MAGIC_NUMBERS: Record<ImageMediaType, (bytes: Uint8Array) => boolean> = {
  'image/png': (b) =>
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  'image/jpeg': (b) =>
    b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/webp': (b) =>
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  'image/gif': (b) =>
    b.length >= 6 &&
    b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 &&
    (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61,
};

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

const imageMediaTypeSchema = z.enum([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

const textBlockSchema = z
  .object({ type: z.literal('text'), text: z.string() })
  .strict();

const imageBlockSchema = z
  .object({
    type: z.literal('image'),
    source: z
      .object({
        type: z.literal('base64'),
        media_type: imageMediaTypeSchema,
        data: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const userContentBlockSchema = z.discriminatedUnion('type', [
  textBlockSchema,
  imageBlockSchema,
]);

export const userMessageContentSchema = z.union([
  z.string().min(1),
  z.array(userContentBlockSchema).min(1),
]);

function decodeFirstBytes(data: string, n: number): Uint8Array {
  // Decode just enough to verify the magic number without materializing the
  // full payload. The leading n bytes correspond to ceil(n / 3) * 4 base64
  // chars; we use a generous slice to absorb whitespace if any.
  const head = data.replace(/\s+/g, '').slice(0, Math.max(24, Math.ceil(n / 3) * 4));
  const buf = Buffer.from(head, 'base64');
  return new Uint8Array(buf.buffer, buf.byteOffset, Math.min(buf.length, n));
}

export function validateUserContent(content: unknown): UserContentBlock[] | string {
  const parsed = userMessageContentSchema.safeParse(content);
  if (!parsed.success) {
    const summary = parsed.error.issues
      .map((iss) => `${iss.path.join('.') || '(root)'}: ${iss.message}`)
      .join('; ');
    throw new StreamParseError(`User content failed validation — ${summary}`);
  }

  if (typeof parsed.data === 'string') return parsed.data;

  const blocks = parsed.data;
  const imageBlocks = blocks.filter(
    (b): b is Extract<UserContentBlock, { type: 'image' }> => b.type === 'image',
  );
  if (imageBlocks.length > MAX_IMAGE_BLOCKS_PER_MESSAGE) {
    throw new StreamParseError(
      `Too many image attachments — limit is ${MAX_IMAGE_BLOCKS_PER_MESSAGE} per message, received ${imageBlocks.length}.`,
    );
  }

  let totalBytes = 0;
  for (const block of imageBlocks) {
    const size = Buffer.byteLength(block.source.data, 'base64');
    totalBytes += size;
    if (totalBytes > MAX_DECODED_BYTES_PER_REQUEST) {
      throw new StreamParseError(
        `Attachment payload exceeds ${MAX_DECODED_BYTES_PER_REQUEST} bytes (decoded).`,
      );
    }
    const head = decodeFirstBytes(block.source.data, 16);
    const matcher = IMAGE_MAGIC_NUMBERS[block.source.media_type];
    if (!matcher(head)) {
      throw new StreamParseError(
        `Attachment header does not match declared media_type ${block.source.media_type}.`,
      );
    }
  }
  return blocks;
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
