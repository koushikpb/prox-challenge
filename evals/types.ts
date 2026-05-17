import { z } from 'zod';

export const ARTIFACT_KINDS = ['duty_cycle', 'polarity', 'settings', 'troubleshoot', 'region'] as const;
export type ExpectedArtifactKind = (typeof ARTIFACT_KINDS)[number];

export const goldenEntrySchema = z
  .object({
    id: z.string().min(1),
    question: z.string().min(1),
    expected_facts: z.array(z.string()),
    expects_image: z.boolean(),
    expects_artifact: z.union([z.enum(ARTIFACT_KINDS), z.null()]),
    expects_clarification: z.boolean(),
    expects_safety_nudge: z.boolean(),
    notes: z.string().optional(),
  })
  .strict();

export type GoldenEntry = z.infer<typeof goldenEntrySchema>;

export const CHECK_KEYS = ['facts', 'image', 'artifact', 'clarification', 'safety'] as const;
export type CheckKey = (typeof CHECK_KEYS)[number];

export type EntryResult = {
  id: string;
  question: string;
  results: Record<CheckKey, boolean>;
  missing_facts: string[];
  overall: boolean;
};
