export type { ToolDefinition, ToolHandler } from './types';
export { ToolInputError } from './types';

export {
  lookupDutyCycle,
  lookupDutyCycleTool,
  lookupDutyCycleInputSchema,
  type LookupDutyCycleInput,
  type LookupDutyCycleOutput,
  type DutyCycleBand,
} from './lookup_duty_cycle';

export {
  lookupPolarity,
  lookupPolarityTool,
  lookupPolarityInputSchema,
  type LookupPolarityInput,
  type LookupPolarityOutput,
} from './lookup_polarity';

export {
  lookupSettings,
  lookupSettingsTool,
  lookupSettingsInputSchema,
  SYNERGIC_NOTE,
  type LookupSettingsInput,
  type LookupSettingsOutput,
  type SettingsMatch,
} from './lookup_settings';

export {
  getPageImage,
  getPageImageTool,
  getPageImageInputSchema,
  type GetPageImageInput,
  type GetPageImageOutput,
} from './get_page_image';

export {
  getRegion,
  getRegionTool,
  getRegionInputSchema,
  type GetRegionInput,
  type GetRegionOutput,
} from './get_region';

export {
  searchManual,
  searchManualTool,
  searchManualInputSchema,
  type SearchManualInput,
  type SearchManualOutput,
  type SearchHit,
} from './search_manual';

export {
  renderArtifact,
  renderArtifactTool,
  renderArtifactInputSchema,
  type RenderArtifactInput,
  type RenderArtifactOutput,
} from './render_artifact';

import { lookupDutyCycleTool } from './lookup_duty_cycle';
import { lookupPolarityTool } from './lookup_polarity';
import { lookupSettingsTool } from './lookup_settings';
import { getPageImageTool } from './get_page_image';
import { getRegionTool } from './get_region';
import { searchManualTool } from './search_manual';
import { renderArtifactTool } from './render_artifact';

export const toolRegistry = [
  searchManualTool,
  getPageImageTool,
  getRegionTool,
  lookupDutyCycleTool,
  lookupPolarityTool,
  lookupSettingsTool,
  renderArtifactTool,
] as const;
