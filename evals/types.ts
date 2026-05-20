import { z } from 'zod';

export const ARTIFACT_KINDS = ['duty_cycle', 'polarity', 'settings', 'troubleshoot', 'region'] as const;
export type ExpectedArtifactKind = (typeof ARTIFACT_KINDS)[number];

const goldenInputObjectSchema = z
  .object({
    text: z.string().min(1),
    images: z.array(z.string().min(1)).min(1),
  })
  .strict();

// Golden inputs are either a plain question string (the historical shape,
// kept so existing entries stay valid) or an object with text + relative
// image paths under evals/fixtures/. The runner builds the appropriate
// user-content blocks before posting to /api/chat.
export const goldenInputSchema = z.union([z.string().min(1), goldenInputObjectSchema]);

export type GoldenInput = z.infer<typeof goldenInputSchema>;

export const goldenEntrySchema = z
  .object({
    id: z.string().min(1),
    question: goldenInputSchema,
    expected_facts: z.array(z.string()),
    expects_image: z.boolean(),
    expects_artifact: z.union([z.enum(ARTIFACT_KINDS), z.null()]),
    expects_clarification: z.boolean(),
    expects_safety_nudge: z.boolean(),
    notes: z.string().optional(),
  })
  .strict();

export type GoldenEntry = z.infer<typeof goldenEntrySchema>;

export function entryQuestionText(entry: GoldenEntry): string {
  return typeof entry.question === 'string' ? entry.question : entry.question.text;
}

export function entryQuestionImages(entry: GoldenEntry): string[] {
  return typeof entry.question === 'string' ? [] : entry.question.images;
}

export const CHECK_KEYS = ['facts', 'image', 'artifact', 'clarification', 'safety'] as const;
export type CheckKey = (typeof CHECK_KEYS)[number];

export type EntryResult = {
  id: string;
  question: string;
  results: Record<CheckKey, boolean>;
  missing_facts: string[];
  overall: boolean;
};
