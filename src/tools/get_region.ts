import { z } from 'zod';
import { regionsTable } from './load-data';
import type { ToolDefinition } from './types';
import { ToolInputError } from './types';

export const getRegionInputSchema = z.object({
  region_id: z.string().min(1),
});

export type GetRegionInput = z.infer<typeof getRegionInputSchema>;

export type GetRegionOutput = {
  region_id: string;
  image_url: string;
  page: number;
  source: 'owner-manual' | 'quick-start' | 'selection-chart';
  caption: string;
};

export function getRegion(input: GetRegionInput): GetRegionOutput {
  const region = regionsTable.find((r) => r.region_id === input.region_id);
  if (!region) {
    const known = regionsTable.map((r) => r.region_id).join(', ');
    throw new ToolInputError(
      `Unknown region_id "${input.region_id}". Known regions: ${known}.`,
    );
  }
  return {
    region_id: region.region_id,
    image_url: region.image_path,
    page: region.page,
    source: region.source,
    caption: region.caption,
  };
}

export const getRegionTool: ToolDefinition<GetRegionInput, GetRegionOutput> = {
  name: 'get_region',
  description:
    'Return a named cropped region from the manual (polarity diagrams, the LCD synergic display, the selection chart, etc.). Use when the answer is fundamentally visual and a focused crop helps more than the full page.',
  input_schema: getRegionInputSchema,
  handler: getRegion,
};
