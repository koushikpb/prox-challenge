import { z } from 'zod';
import { pageIndex } from './load-data';
import type { ToolDefinition } from './types';
import { ToolInputError } from './types';

export const getPageImageInputSchema = z.object({
  page: z.number().int().positive(),
});

export type GetPageImageInput = z.infer<typeof getPageImageInputSchema>;

export type GetPageImageOutput = {
  page: number;
  source: 'owner-manual' | 'quick-start' | 'selection-chart';
  image_url: string;
  caption: string;
};

const SOURCE_PRIORITY: Array<'owner-manual' | 'quick-start' | 'selection-chart'> = [
  'owner-manual',
  'quick-start',
  'selection-chart',
];

export function getPageImage(input: GetPageImageInput): GetPageImageOutput {
  const candidates = pageIndex.filter((row) => row.page === input.page);
  if (candidates.length === 0) {
    throw new ToolInputError(
      `No manual page indexed at page=${input.page}. Owner manual covers pages 1–48; the quick-start guide and selection chart use their own page numbering and are accessible via region IDs (see get_region).`,
    );
  }

  const ordered = [...candidates].sort(
    (a, b) => SOURCE_PRIORITY.indexOf(a.source) - SOURCE_PRIORITY.indexOf(b.source),
  );
  const row = ordered[0]!;

  const heading = row.headings.find((h) => h.trim().length > 0);
  const caption = heading
    ? `${row.source} p. ${row.page} — ${row.section}: ${heading.trim()}`
    : `${row.source} p. ${row.page} — ${row.section}`;

  return {
    page: row.page,
    source: row.source,
    image_url: row.image_path,
    caption,
  };
}

export const getPageImageTool: ToolDefinition<GetPageImageInput, GetPageImageOutput> = {
  name: 'get_page_image',
  description:
    'Return the URL and caption for a single owner-manual page render. Owner-manual pages 1–48 are addressable by page number.',
  input_schema: getPageImageInputSchema,
  handler: getPageImage,
};
