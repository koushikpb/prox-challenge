import { z } from 'zod';

const positiveInt = z.number().int().positive();
const nonNegativeNumber = z.number().nonnegative();

export const dutyCycleEntrySchema = z
  .object({
    process: z.enum(['MIG', 'TIG', 'Stick']),
    input_voltage: z.union([z.literal(120), z.literal(240)]),
    rated: z.object({
      amperage: positiveInt,
      duty_cycle_pct: z.number().int().min(1).max(100),
      work_minutes: nonNegativeNumber,
      rest_minutes: nonNegativeNumber,
    }),
    continuous: z.object({
      amperage: positiveInt,
      duty_cycle_pct: z.literal(100),
    }),
    current_range: z.object({
      min_a: positiveInt,
      max_a: positiveInt,
    }),
    ocv_v: positiveInt,
    source_page: positiveInt,
    notes: z.string().optional(),
  })
  .refine((row) => row.current_range.min_a <= row.current_range.max_a, {
    message: 'current_range.min_a must be ≤ current_range.max_a',
    path: ['current_range'],
  })
  .refine(
    (row) =>
      Math.abs(row.rated.work_minutes - (10 * row.rated.duty_cycle_pct) / 100) < 0.01 &&
      Math.abs(row.rated.work_minutes + row.rated.rest_minutes - 10) < 0.01,
    {
      message:
        'work_minutes and rest_minutes must sum to 10 and work_minutes must equal 10 × duty_cycle_pct / 100',
      path: ['rated'],
    },
  );

export const dutyCycleSchema = z.array(dutyCycleEntrySchema);

export const polarityEntrySchema = z
  .object({
    process: z.enum(['MIG_solid', 'MIG_flux', 'TIG', 'Stick']),
    polarity_name: z.enum(['DCEP', 'DCEN']),
    ground_socket: z.enum(['Positive', 'Negative']),
    electrode_socket: z.enum(['Positive', 'Negative']),
    source_page: positiveInt,
    region_id: z.enum([
      'polarity_DCEP_solid_core',
      'polarity_DCEN_flux_cored',
      'polarity_TIG',
      'polarity_Stick',
    ]),
    explanation: z.string().min(1),
  })
  .refine((row) => row.ground_socket !== row.electrode_socket, {
    message: 'ground_socket and electrode_socket must be opposites',
    path: ['electrode_socket'],
  })
  .refine(
    (row) =>
      (row.polarity_name === 'DCEP' && row.electrode_socket === 'Positive') ||
      (row.polarity_name === 'DCEN' && row.electrode_socket === 'Negative'),
    {
      message: 'polarity_name must match electrode_socket (DCEP=Positive, DCEN=Negative)',
      path: ['polarity_name'],
    },
  );

export const polaritySchema = z.array(polarityEntrySchema);

export const settingsEntrySchema = z
  .object({
    source: z.enum(['selection-chart', 'owner-manual']),
    process: z.enum(['MIG', 'TIG', 'Stick']),
    subprocess: z.enum(['solid-core', 'flux-cored']).optional(),
    material: z.enum(['mild_steel', 'stainless', 'aluminum', 'chrome_moly', 'castings']),
    thickness_in: z.number().positive().optional(),
    thickness_min_in: z.number().positive().optional(),
    thickness_max_in: z.number().positive().optional(),
    wire_diameter_in: z.number().positive().optional(),
    wfs_ipm: z.number().positive().optional(),
    voltage: z.number().positive().optional(),
    gas_required: z.boolean(),
    gas_scfh_min: z.number().positive().optional(),
    gas_scfh_max: z.number().positive().optional(),
    electrode_or_rod_diameter: z.number().positive().optional(),
    skill_level: z.enum(['low', 'moderate', 'high']).optional(),
    cleanliness: z.enum(['extremely_clean', 'clean_minimal_spatter', 'more_spatter']).optional(),
    applications: z.array(z.string()).optional(),
    notes: z.string().optional(),
    source_page: positiveInt,
  })
  .refine(
    (row) =>
      row.thickness_in !== undefined ||
      (row.thickness_min_in !== undefined && row.thickness_max_in !== undefined),
    {
      message: 'settings row must have either thickness_in or both thickness_min_in and thickness_max_in',
      path: ['thickness_in'],
    },
  )
  .refine(
    (row) =>
      row.thickness_min_in === undefined ||
      row.thickness_max_in === undefined ||
      row.thickness_min_in <= row.thickness_max_in,
    {
      message: 'thickness_min_in must be ≤ thickness_max_in',
      path: ['thickness_max_in'],
    },
  );

export const settingsSchema = z.array(settingsEntrySchema);

const branchNodeSchema = z.object({
  node_id: z.string().min(1),
  symptom: z.string().min(1).optional(),
  question: z.string().min(1),
  options: z
    .array(z.object({ label: z.string().min(1), next: z.string().min(1) }))
    .min(1),
  source_pages: z.array(positiveInt).min(1),
});

const leafNodeSchema = z.object({
  node_id: z.string().min(1),
  symptom: z.string().min(1).optional(),
  cause: z.string().min(1),
  fixes: z.array(z.string().min(1)).min(1),
  source_pages: z.array(positiveInt).min(1),
});

export const troubleshootingNodeSchema = z.union([branchNodeSchema, leafNodeSchema]);

export const troubleshootingSchema = z
  .array(troubleshootingNodeSchema)
  .superRefine((nodes, ctx) => {
    const ids = new Set(nodes.map((n) => n.node_id));
    if (ids.size !== nodes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'troubleshooting node_id values must be unique',
      });
    }
    nodes.forEach((node, i) => {
      if ('options' in node) {
        node.options.forEach((opt, j) => {
          if (!ids.has(opt.next)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `options[${j}].next "${opt.next}" does not resolve to any node_id`,
              path: [i, 'options', j, 'next'],
            });
          }
        });
      }
    });
  });

export const partsEntrySchema = z.object({
  item_number: positiveInt,
  name: z.string().min(1),
  quantity: positiveInt,
  source_page: positiveInt,
  notes: z.string().optional(),
});

export const partsSchema = z.array(partsEntrySchema);

export const regionEntrySchema = z.object({
  region_id: z.string().min(1).regex(/^[A-Za-z0-9_]+$/),
  source: z.enum(['owner-manual', 'quick-start', 'selection-chart']),
  page: positiveInt,
  bbox: z.object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    w: positiveInt,
    h: positiveInt,
  }),
  image_path: z.string().startsWith('/data/regions/'),
  caption: z.string().min(1),
  source_pages: z.array(positiveInt).min(1),
});

export const regionsSchema = z.array(regionEntrySchema).superRefine((regions, ctx) => {
  const ids = new Set(regions.map((r) => r.region_id));
  if (ids.size !== regions.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'region_id values must be unique',
    });
  }
});

export const pageIndexEntrySchema = z.object({
  page: positiveInt,
  source: z.enum(['owner-manual', 'quick-start', 'selection-chart']),
  section: z.string().min(1),
  headings: z.array(z.string()),
  text: z.string(),
  image_path: z.string().startsWith('/data/pages/'),
  region_ids: z.array(z.string()).default([]),
});

export const pageIndexSchema = z.array(pageIndexEntrySchema);

export type DutyCycleEntry = z.infer<typeof dutyCycleEntrySchema>;
export type DutyCycleTable = z.infer<typeof dutyCycleSchema>;
export type PolarityEntry = z.infer<typeof polarityEntrySchema>;
export type PolarityTable = z.infer<typeof polaritySchema>;
export type SettingsEntry = z.infer<typeof settingsEntrySchema>;
export type SettingsTable = z.infer<typeof settingsSchema>;
export type TroubleshootingNode = z.infer<typeof troubleshootingNodeSchema>;
export type TroubleshootingTree = z.infer<typeof troubleshootingSchema>;
export type PartsEntry = z.infer<typeof partsEntrySchema>;
export type PartsTable = z.infer<typeof partsSchema>;
export type RegionEntry = z.infer<typeof regionEntrySchema>;
export type RegionsTable = z.infer<typeof regionsSchema>;
export type PageIndexEntry = z.infer<typeof pageIndexEntrySchema>;
export type PageIndex = z.infer<typeof pageIndexSchema>;

export function validate<T>(schema: z.ZodType<T>, json: unknown, filename: string): T {
  const result = schema.safeParse(json);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Schema validation failed for ${filename}:\n${formatted}`);
  }
  return result.data;
}
