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

export type RenderArtifactOutput = {
  rendered: true;
  artifact: ArtifactPayload;
};

export const renderDutyCycleArtifactInputSchema = dutyCycleArtifactSchema.omit({ type: true });
export const renderPolarityArtifactInputSchema = polarityArtifactSchema.omit({ type: true });
export const renderSettingsArtifactInputSchema = settingsArtifactSchema.omit({ type: true });
export const renderTroubleshootArtifactInputSchema = troubleshootArtifactSchema.omit({ type: true });

export type RenderDutyCycleArtifactInput = z.infer<typeof renderDutyCycleArtifactInputSchema>;
export type RenderPolarityArtifactInput = z.infer<typeof renderPolarityArtifactInputSchema>;
export type RenderSettingsArtifactInput = z.infer<typeof renderSettingsArtifactInputSchema>;
export type RenderTroubleshootArtifactInput = z.infer<typeof renderTroubleshootArtifactInputSchema>;

export function renderDutyCycleArtifact(
  input: RenderDutyCycleArtifactInput,
): RenderArtifactOutput {
  const artifact = parseArtifactPayload({ type: 'duty_cycle', ...input });
  return { rendered: true, artifact };
}

export function renderPolarityArtifact(
  input: RenderPolarityArtifactInput,
): RenderArtifactOutput {
  const artifact = parseArtifactPayload({ type: 'polarity', ...input });
  return { rendered: true, artifact };
}

export function renderSettingsArtifact(
  input: RenderSettingsArtifactInput,
): RenderArtifactOutput {
  const artifact = parseArtifactPayload({ type: 'settings', ...input });
  return { rendered: true, artifact };
}

export function renderTroubleshootArtifact(
  input: RenderTroubleshootArtifactInput,
): RenderArtifactOutput {
  const artifact = parseArtifactPayload({ type: 'troubleshoot', ...input });
  return { rendered: true, artifact };
}

export const renderDutyCycleArtifactTool: ToolDefinition<
  RenderDutyCycleArtifactInput,
  RenderArtifactOutput
> = {
  name: 'render_duty_cycle_artifact',
  description:
    'Render the interactive duty-cycle artifact. Call this when the user asks about duty cycle, work/rest minutes, or "can I run this all day". Pass the values you got from lookup_duty_cycle. Do not include a `type` field — the tool name is the type. Do not pass the `band` field from lookup_duty_cycle\'s output; it is not part of the artifact payload.',
  input_schema: renderDutyCycleArtifactInputSchema,
  handler: renderDutyCycleArtifact,
};

export const renderPolarityArtifactTool: ToolDefinition<
  RenderPolarityArtifactInput,
  RenderArtifactOutput
> = {
  name: 'render_polarity_artifact',
  description:
    'Render the interactive polarity artifact. Call this when the user asks "what polarity for X" or how to wire the sockets. Pass the values you got from lookup_polarity. Use the four-way `process` enum (MIG_solid | MIG_flux | TIG | Stick). Do not include a `type` field — the tool name is the type.',
  input_schema: renderPolarityArtifactInputSchema,
  handler: renderPolarityArtifact,
};

export const renderSettingsArtifactTool: ToolDefinition<
  RenderSettingsArtifactInput,
  RenderArtifactOutput
> = {
  name: 'render_settings_artifact',
  description:
    'Render the interactive settings artifact. Call this when the user asks "what setting for X material at Y thickness". Pass the values you got from lookup_settings. Omit `wfs_ipm` and `voltage` — this welder is synergic, so the LCD computes them. Do not include a `type` field — the tool name is the type.',
  input_schema: renderSettingsArtifactInputSchema,
  handler: renderSettingsArtifact,
};

export const renderTroubleshootArtifactTool: ToolDefinition<
  RenderTroubleshootArtifactInput,
  RenderArtifactOutput
> = {
  name: 'render_troubleshoot_artifact',
  description:
    'Render the interactive troubleshoot artifact. Call this when the user reports a weld defect (porosity, burn-through, undercut, etc.) and would benefit from a guided diagnosis. The payload is `{ symptom, tree }` only — do not pass fields like `defect`, `process`, `causes`, or `notes`. Each node in `tree` is either a `question`+`options` branch or a terminal `cause`+`fixes` leaf, plus a `node_id` and `source_pages`.',
  input_schema: renderTroubleshootArtifactInputSchema,
  handler: renderTroubleshootArtifact,
};
