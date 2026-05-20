export type ManualSource = 'owner-manual' | 'quick-start' | 'selection-chart';

export type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

export type UserContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: {
        type: 'base64';
        media_type: ImageMediaType;
        data: string;
      };
    };

export type UserMessageContent = string | UserContentBlock[];

export type UserMessage = {
  role: 'user';
  content: UserMessageContent;
};

export type AssistantMessage = {
  role: 'assistant';
  content: string;
};

export type WireMessage = UserMessage | AssistantMessage;

export type DutyCycleArtifactPayload = {
  type: 'duty_cycle';
  process: 'MIG' | 'TIG' | 'Stick';
  input_voltage: 120 | 240;
  amperage: number;
  duty_cycle_pct: number;
  work_minutes: number;
  rest_minutes: number;
  source_page: number;
};

export type PolarityArtifactPayload = {
  type: 'polarity';
  process: 'MIG_solid' | 'MIG_flux' | 'TIG' | 'Stick';
  ground_socket: 'Positive' | 'Negative';
  electrode_socket: 'Positive' | 'Negative';
  polarity_name: 'DCEP' | 'DCEN';
  source_page: number;
};

export type SettingsArtifactPayload = {
  type: 'settings';
  process: 'MIG' | 'TIG' | 'Stick';
  subprocess?: 'solid-core' | 'flux-cored';
  material: string;
  thickness_in: number;
  skill_level: 'low' | 'moderate' | 'high';
  gas_required: boolean;
  gas_scfh_min?: number;
  gas_scfh_max?: number;
  cleanliness: 'extremely_clean' | 'clean_minimal_spatter' | 'more_spatter';
  applications: string[];
  wfs_ipm?: number;
  voltage?: number;
  notes?: string;
  source_page: number;
};

export type TroubleshootArtifactPayload = {
  type: 'troubleshoot';
  symptom: string;
  tree: TroubleshootNode[];
};

export type TroubleshootNode = {
  node_id: string;
  question?: string;
  options?: { label: string; next: string }[];
  cause?: string;
  fixes?: string[];
  source_pages: number[];
};

export type RegionArtifactPayload = {
  type: 'region';
  region_id: string;
  image_url: string;
  caption: string;
  page: number;
  source: ManualSource;
  title?: string;
};

export type ArtifactPayload =
  | DutyCycleArtifactPayload
  | PolarityArtifactPayload
  | SettingsArtifactPayload
  | TroubleshootArtifactPayload
  | RegionArtifactPayload;

export type ArtifactKind = ArtifactPayload['type'];

export type TextDeltaEvent = { type: 'text_delta'; delta: string };
export type ToolCallStartEvent = { type: 'tool_call_start'; tool: string; args_preview?: string };
export type ToolCallEndEvent = { type: 'tool_call_end'; tool: string; ok: boolean };
export type ArtifactEvent = { type: 'artifact'; artifact: ArtifactPayload };
export type CitationEvent = { type: 'citation'; page: number; source: ManualSource };
export type ErrorEvent = { type: 'error'; message: string };
export type DoneEvent = { type: 'done' };

export type StreamEvent =
  | TextDeltaEvent
  | ToolCallStartEvent
  | ToolCallEndEvent
  | ArtifactEvent
  | CitationEvent
  | ErrorEvent
  | DoneEvent;

export type StreamEventKind = StreamEvent['type'];
