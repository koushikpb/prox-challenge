import { z } from 'zod';
import { parseArtifactPayload } from '@/streaming';
import type { RegionArtifactPayload } from '@/streaming';
import { regionsTable } from './load-data';
import type { ToolDefinition } from './types';
import { ToolInputError } from './types';

export const renderRegionArtifactInputSchema = z
  .object({
    region_id: z.string().min(1),
  })
  .strict();

export type RenderRegionArtifactInput = z.infer<typeof renderRegionArtifactInputSchema>;

export type RenderRegionArtifactOutput = {
  rendered: true;
  artifact: RegionArtifactPayload;
};

function humanizeRegionId(id: string): string {
  const words = id.replace(/_/g, ' ').trim();
  if (words.length === 0) return id;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function renderRegionArtifact(
  input: RenderRegionArtifactInput,
): RenderRegionArtifactOutput {
  const region = regionsTable.find((r) => r.region_id === input.region_id);
  if (!region) {
    const known = regionsTable.map((r) => r.region_id).join(', ');
    throw new ToolInputError(
      `Unknown region_id "${input.region_id}". Known regions: ${known}.`,
    );
  }
  const artifact = parseArtifactPayload({
    type: 'region',
    region_id: region.region_id,
    image_url: region.image_path,
    caption: region.caption,
    page: region.page,
    source: region.source,
    title: humanizeRegionId(region.region_id),
  }) as RegionArtifactPayload;
  return { rendered: true, artifact };
}

export const renderRegionArtifactTool: ToolDefinition<
  RenderRegionArtifactInput,
  RenderRegionArtifactOutput
> = {
  name: 'render_region_artifact',
  description:
    'Render a standalone region artifact card for a named cropped diagram (wiring_schematic, parts_diagram, lcd_synergic_display, selection_chart, duty_cycle_specifications, or any polarity_* region). Call this when the user asks to *see*, *show me*, or *bring up* a diagram, schematic, or chart and no per-type artifact (duty cycle / polarity / settings / troubleshoot) already carries that region as its hero. Input is `{ region_id }` only — caption, page, and source are pulled from the manual data.',
  input_schema: renderRegionArtifactInputSchema,
  handler: renderRegionArtifact,
};
