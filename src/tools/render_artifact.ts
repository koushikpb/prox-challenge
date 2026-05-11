import { z } from 'zod';
import { parseArtifactPayload } from '@/streaming';
import type { ArtifactPayload } from '@/streaming';
import type { ToolDefinition } from './types';

export const renderArtifactInputSchema = z.object({
  type: z.enum(['duty_cycle', 'polarity', 'settings', 'troubleshoot']),
  payload: z.record(z.string(), z.unknown()),
});

export type RenderArtifactInput = z.infer<typeof renderArtifactInputSchema>;

export type RenderArtifactOutput = {
  rendered: true;
  artifact: ArtifactPayload;
};

export function renderArtifact(input: RenderArtifactInput): RenderArtifactOutput {
  const candidate = { type: input.type, ...input.payload };
  const artifact = parseArtifactPayload(candidate);
  return { rendered: true, artifact };
}

export const renderArtifactTool: ToolDefinition<RenderArtifactInput, RenderArtifactOutput> = {
  name: 'render_artifact',
  description:
    'Emit one of the four typed React artifacts (duty_cycle, polarity, settings, troubleshoot) to the chat with the supplied payload. The payload is validated against the strict streaming-contract schema before rendering.',
  input_schema: renderArtifactInputSchema,
  handler: renderArtifact,
};
