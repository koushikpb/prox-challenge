import dutyCycleJson from '@/data/duty_cycle.json';
import polarityJson from '@/data/polarity.json';
import settingsJson from '@/data/settings.json';
import regionsJson from '@/data/regions.json';
import pageIndexJson from '@/data/index.json';
import {
  dutyCycleSchema,
  pageIndexSchema,
  polaritySchema,
  regionsSchema,
  settingsSchema,
  validate,
  type DutyCycleTable,
  type PageIndex,
  type PolarityTable,
  type RegionsTable,
  type SettingsTable,
} from '@/data/schemas';

export const dutyCycleTable: DutyCycleTable = validate(
  dutyCycleSchema,
  dutyCycleJson,
  'data/duty_cycle.json',
);

export const polarityTable: PolarityTable = validate(
  polaritySchema,
  polarityJson,
  'data/polarity.json',
);

export const settingsTable: SettingsTable = validate(
  settingsSchema,
  settingsJson,
  'data/settings.json',
);

export const regionsTable: RegionsTable = validate(
  regionsSchema,
  regionsJson,
  'data/regions.json',
);

export const pageIndex: PageIndex = validate(
  pageIndexSchema,
  pageIndexJson,
  'data/index.json',
);
