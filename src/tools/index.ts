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
  renderDutyCycleArtifact,
  renderDutyCycleArtifactTool,
  renderDutyCycleArtifactInputSchema,
  renderPolarityArtifact,
  renderPolarityArtifactTool,
  renderPolarityArtifactInputSchema,
  renderSettingsArtifact,
  renderSettingsArtifactTool,
  renderSettingsArtifactInputSchema,
  renderTroubleshootArtifact,
  renderTroubleshootArtifactTool,
  renderTroubleshootArtifactInputSchema,
  type RenderArtifactOutput,
  type RenderDutyCycleArtifactInput,
  type RenderPolarityArtifactInput,
  type RenderSettingsArtifactInput,
  type RenderTroubleshootArtifactInput,
} from './render_artifact';

import { lookupDutyCycleTool } from './lookup_duty_cycle';
import { lookupPolarityTool } from './lookup_polarity';
import { lookupSettingsTool } from './lookup_settings';
import { getPageImageTool } from './get_page_image';
import { getRegionTool } from './get_region';
import { searchManualTool } from './search_manual';
import {
  renderDutyCycleArtifactTool,
  renderPolarityArtifactTool,
  renderSettingsArtifactTool,
  renderTroubleshootArtifactTool,
} from './render_artifact';

export const RENDER_ARTIFACT_TOOL_NAMES = [
  'render_duty_cycle_artifact',
  'render_polarity_artifact',
  'render_settings_artifact',
  'render_troubleshoot_artifact',
] as const;

export type RenderArtifactToolName = (typeof RENDER_ARTIFACT_TOOL_NAMES)[number];

export const toolRegistry = [
  searchManualTool,
  getPageImageTool,
  getRegionTool,
  lookupDutyCycleTool,
  lookupPolarityTool,
  lookupSettingsTool,
  renderDutyCycleArtifactTool,
  renderPolarityArtifactTool,
  renderSettingsArtifactTool,
  renderTroubleshootArtifactTool,
] as const;
