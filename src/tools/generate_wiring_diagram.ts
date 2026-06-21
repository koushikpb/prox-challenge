import { z } from 'zod';
import { parseArtifactPayload } from '@/streaming';
import type { GeneratedDiagramArtifactPayload } from '@/streaming';
import type { ToolDefinition } from './types';
import { ToolInputError } from './types';
import { WIRING_DIAGRAMS } from './wiring-diagrams';

export const generateWiringDiagramInputSchema = z
  .object({
    process: z.enum([
      'flux_cored_mig',
      'solid_wire_mig',
      'stick_dcep',
      'stick_dcen',
      'tig_dcen',
    ]),
    notes: z.string().max(120).optional(),
  })
  .strict();

export type GenerateWiringDiagramInput = z.infer<typeof generateWiringDiagramInputSchema>;

export type GenerateWiringDiagramOutput = {
  rendered: true;
  artifact: GeneratedDiagramArtifactPayload;
};

function clampCaption(layoutCaption: string, notes?: string): string {
  if (!notes) return layoutCaption;
  const combined = `${layoutCaption} — ${notes}`;
  return combined.length <= 320 ? combined : combined.slice(0, 320);
}

export function generateWiringDiagram(
  input: GenerateWiringDiagramInput,
): GenerateWiringDiagramOutput {
  const layout = WIRING_DIAGRAMS[input.process];
  if (!layout) {
    throw new ToolInputError(`unknown process: ${input.process}`);
  }
  const artifact = parseArtifactPayload({
    type: 'generated_diagram',
    process: input.process,
    nodes: layout.nodes,
    edges: layout.edges,
    caption: clampCaption(layout.caption, input.notes),
    page_cite: layout.page_cite,
  }) as GeneratedDiagramArtifactPayload;
  return { rendered: true, artifact };
}

export const generateWiringDiagramTool: ToolDefinition<
  GenerateWiringDiagramInput,
  GenerateWiringDiagramOutput
> = {
  name: 'generate_wiring_diagram',
  description:
    'Generate a custom wiring diagram for a welding process. The model picks the `process` enum (flux_cored_mig | solid_wire_mig | stick_dcep | stick_dcen | tig_dcen) and may add a short `notes` caption (≤120 chars); the tool returns a structured nodes+edges payload from a canonical, manual-grounded layout table. Use this tool for prompts that ask to *draw*, *create*, *generate*, or *make me* a wiring diagram. Do NOT use this for "show me the wiring schematic from the manual" — that is render_region_artifact({ region_id: "wiring_schematic" }).',
  input_schema: generateWiringDiagramInputSchema,
  handler: generateWiringDiagram,
};
