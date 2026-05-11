import { z } from 'zod';
import { pageIndex } from './load-data';
import type { PageIndexEntry } from '@/data/schemas';
import type { ToolDefinition } from './types';

export const searchManualInputSchema = z.object({
  query: z.string().min(1),
  top_k: z.number().int().positive().max(10).optional(),
});

export type SearchManualInput = z.infer<typeof searchManualInputSchema>;

export type SearchHit = {
  page: number;
  source: 'owner-manual' | 'quick-start' | 'selection-chart';
  section: string;
  text_snippet: string;
  image_path: string;
  region_ids?: string[];
  score: number;
};

export type SearchManualOutput = { hits: SearchHit[] };

const DEFAULT_TOP_K = 5;
const HEADING_WEIGHT = 3;
const SECTION_WEIGHT = 2;
const SNIPPET_LENGTH = 200;

const STOPWORDS = new Set([
  'a', 'an', 'and', 'or', 'but', 'the', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'to', 'of', 'in', 'on', 'at', 'for', 'with',
  'by', 'as', 'from', 'into', 'this', 'that', 'these', 'those', 'it',
  'its', 'do', 'does', 'did', 'how', 'what', 'which', 'when', 'where',
  'why', 'i', 'you', 'we', 'they', 'he', 'she', 'my', 'your',
]);

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/\W+/)
    .filter((tok) => tok.length > 1 && !STOPWORDS.has(tok));
}

function scorePage(tokens: string[], row: PageIndexEntry): number {
  if (tokens.length === 0) return 0;

  const text = row.text.toLowerCase();
  const headings = row.headings.join(' ').toLowerCase();
  const section = row.section.toLowerCase();

  let score = 0;
  for (const tok of tokens) {
    if (!tok) continue;
    const escaped = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'g');
    const textHits = (text.match(re) ?? []).length;
    const headingHits = (headings.match(re) ?? []).length;
    const sectionHits = (section.match(re) ?? []).length;
    score += textHits + HEADING_WEIGHT * headingHits + SECTION_WEIGHT * sectionHits;
  }
  return score;
}

function extractSnippet(text: string, tokens: string[]): string {
  const lower = text.toLowerCase();
  let idx = -1;
  for (const tok of tokens) {
    const found = lower.indexOf(tok);
    if (found !== -1 && (idx === -1 || found < idx)) idx = found;
  }
  if (idx === -1) {
    return text.slice(0, SNIPPET_LENGTH).replace(/\s+/g, ' ').trim();
  }
  const start = Math.max(0, idx - 40);
  const slice = text.slice(start, start + SNIPPET_LENGTH).replace(/\s+/g, ' ').trim();
  return start > 0 ? `…${slice}` : slice;
}

export function searchManual(input: SearchManualInput): SearchManualOutput {
  const tokens = tokenize(input.query);
  const topK = Math.min(input.top_k ?? DEFAULT_TOP_K, 10);

  const scored = pageIndex
    .map((row) => ({ row, score: scorePage(tokens, row) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.row.page - b.row.page)
    .slice(0, topK);

  const hits: SearchHit[] = scored.map(({ row, score }) => ({
    page: row.page,
    source: row.source,
    section: row.section,
    text_snippet: extractSnippet(row.text, tokens),
    image_path: row.image_path,
    region_ids: row.region_ids.length > 0 ? row.region_ids : undefined,
    score,
  }));

  return { hits };
}

export const searchManualTool: ToolDefinition<SearchManualInput, SearchManualOutput> = {
  name: 'search_manual',
  description:
    'Keyword search across the owner manual, quick-start guide, and selection chart. Returns the top pages by token-overlap (headings weighted), each with a short snippet and the page image URL.',
  input_schema: searchManualInputSchema,
  handler: searchManual,
};
