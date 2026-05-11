import type { ArtifactPayload, ManualSource } from '@/streaming';

export type CitationRef = {
  page: number;
  source: ManualSource;
};

export type ToolCallStatus = 'pending' | 'ok' | 'error';

export type ToolCallRecord = {
  id: string;
  tool: string;
  argsPreview?: string;
  status: ToolCallStatus;
};

export type UserMessage = {
  id: string;
  role: 'user';
  content: string;
};

export type AssistantMessage = {
  id: string;
  role: 'assistant';
  kind: 'answer' | 'clarification';
  content: string;
  toolCalls: ToolCallRecord[];
  citations: CitationRef[];
  artifacts: ArtifactPayload[];
  errors: string[];
  done: boolean;
};

export type ChatMessageRecord = UserMessage | AssistantMessage;
