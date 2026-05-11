import { z } from 'zod';
import {
  dutyCycleArtifactSchema,
  parseArtifactPayload,
  polarityArtifactSchema,
  settingsArtifactSchema,
  troubleshootArtifactSchema,
} from '@/streaming';
import type { ArtifactPayload } from '@/streaming';
import type { ToolDefinition } from './types';

export const renderArtifactInputSchema = z.discriminatedUnion('type', [
  dutyCycleArtifactSchema,
  polarityArtifactSchema,
  settingsArtifactSchema,
  troubleshootArtifactSchema,
]);

export type RenderArtifactInput = z.infer<typeof renderArtifactInputSchema>;

export type RenderArtifactOutput = {
  rendered: true;
  artifact: ArtifactPayload;
};

export function renderArtifact(input: RenderArtifactInput): RenderArtifactOutput {
  const artifact = parseArtifactPayload(input);
  return { rendered: true, artifact };
}

export const renderArtifactTool: ToolDefinition<RenderArtifactInput, RenderArtifactOutput> = {
  name: 'render_artifact',
  description:
    'Emit one of four typed React artifacts. Pass the full payload at the top level — the `type` field is the discriminator and the remaining fields are the payload. The schema is strict: unknown fields are rejected. Do not invent fields and do not pass tool-output fields like `band` from lookup_duty_cycle. The four allowed types are duty_cycle, polarity, settings, and troubleshoot; each has its own required field set.',
  input_schema: renderArtifactInputSchema,
  handler: renderArtifact,
};
