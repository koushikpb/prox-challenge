import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { ChatMessage } from '@/streaming';
import type { ManualSource } from '@/streaming';
import { StreamParseError, parseArtifactPayload } from '@/streaming/parser';
import type { StreamContext } from '@/streaming/sse';
import { truncateArgsPreview } from '@/streaming/cache';
import { pageIndex } from '@/tools/load-data';
import { ToolInputError } from '@/tools/types';
import { toolRegistry } from '@/tools';
import { SYSTEM_PROMPT } from './system-prompt';

export const DEFAULT_MODEL = 'claude-sonnet-4-6';
export const DEFAULT_MAX_TOKENS = 2048;
export const DEFAULT_MAX_TOOL_LOOPS = 6;

export type AgentRequest = {
  messages: ChatMessage[];
  sessionId?: string;
};

export type AgentClient = Pick<Anthropic, 'messages'>;

export type StreamAgentTurnOptions = {
  client?: AgentClient;
  model?: string;
  maxTokens?: number;
  maxToolLoops?: number;
};

type ToolEntry = {
  name: string;
  description: string;
  inputSchemaJson: Record<string, unknown>;
  inputSchemaZod: z.ZodType<unknown>;
  handler: (args: unknown) => Promise<unknown> | unknown;
};

const toolEntries: ToolEntry[] = toolRegistry.map((tool) => ({
  name: tool.name,
  description: tool.description,
  inputSchemaJson: z.toJSONSchema(tool.input_schema, {
    target: 'draft-7',
    unrepresentable: 'any',
  }) as Record<string, unknown>,
  inputSchemaZod: tool.input_schema as z.ZodType<unknown>,
  handler: tool.handler as (args: unknown) => Promise<unknown> | unknown,
}));

const toolByName = new Map(toolEntries.map((t) => [t.name, t]));

const anthropicTools = toolEntries.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: ensureObjectSchema(t.inputSchemaJson),
}));

function ensureObjectSchema(schema: Record<string, unknown>): {
  type: 'object';
  properties?: Record<string, unknown>;
  required?: string[];
  [k: string]: unknown;
} {
  if (schema.type === 'object') {
    return schema as { type: 'object'; properties?: Record<string, unknown>; required?: string[] };
  }
  return { type: 'object', properties: {}, ...schema };
}

const CITATION_PATTERN = /\(\s*p\.?\s*(\d{1,3})\s*\)/gi;
const ownerManualPages = new Set(
  pageIndex.filter((p) => p.source === 'owner-manual').map((p) => p.page),
);
const quickStartPages = new Set(
  pageIndex.filter((p) => p.source === 'quick-start').map((p) => p.page),
);

function inferCitationSource(page: number): ManualSource {
  if (ownerManualPages.has(page)) return 'owner-manual';
  if (quickStartPages.has(page)) return 'quick-start';
  return 'owner-manual';
}

type ToolUseAccumulator = {
  id: string;
  name: string;
  raw: string;
};

export async function streamAgentTurn(
  request: AgentRequest,
  ctx: StreamContext,
  opts: StreamAgentTurnOptions = {},
): Promise<void> {
  const client = opts.client ?? new Anthropic();
  const model = opts.model ?? DEFAULT_MODEL;
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const maxLoops = opts.maxToolLoops ?? DEFAULT_MAX_TOOL_LOOPS;

  const conversation: Anthropic.MessageParam[] = request.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const citedPages = new Set<number>();

  for (let loop = 0; loop < maxLoops; loop++) {
    if (ctx.signal?.aborted) return;

    const assistantContent: Anthropic.ContentBlockParam[] = [];
    const toolUseBlocks = new Map<number, ToolUseAccumulator>();
    let stopReason: Anthropic.StopReason | null = null;
    let assistantText = '';

    const stream = client.messages.stream({
      model,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: conversation,
      tools: anthropicTools as unknown as Anthropic.Tool[],
    });

    try {
      for await (const event of stream as AsyncIterable<Anthropic.RawMessageStreamEvent>) {
        if (ctx.signal?.aborted) {
          stream.controller.abort();
          return;
        }
        await handleStreamEvent(event, {
          ctx,
          assistantContent,
          toolUseBlocks,
          appendText: (delta) => {
            assistantText += delta;
          },
          setStopReason: (reason) => {
            stopReason = reason;
          },
        });
      }
    } catch (err) {
      throw err;
    }

    emitCitations(assistantText, ctx, citedPages);

    conversation.push({ role: 'assistant', content: assistantContent });

    if (stopReason !== 'tool_use' || toolUseBlocks.size === 0) {
      return;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const [, acc] of toolUseBlocks) {
      const result = await runTool(acc, ctx);
      toolResults.push(result);
    }
    conversation.push({ role: 'user', content: toolResults });
  }
}

type HandleStreamEventArgs = {
  ctx: StreamContext;
  assistantContent: Anthropic.ContentBlockParam[];
  toolUseBlocks: Map<number, ToolUseAccumulator>;
  appendText: (delta: string) => void;
  setStopReason: (reason: Anthropic.StopReason) => void;
};

async function handleStreamEvent(
  event: Anthropic.RawMessageStreamEvent,
  { ctx, assistantContent, toolUseBlocks, appendText, setStopReason }: HandleStreamEventArgs,
): Promise<void> {
  switch (event.type) {
    case 'content_block_start': {
      const block = event.content_block;
      if (block.type === 'text') {
        assistantContent[event.index] = { type: 'text', text: '' };
      } else if (block.type === 'tool_use') {
        assistantContent[event.index] = {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: {},
        };
        toolUseBlocks.set(event.index, { id: block.id, name: block.name, raw: '' });
        ctx.emit({
          type: 'tool_call_start',
          tool: block.name,
        });
      }
      return;
    }
    case 'content_block_delta': {
      const delta = event.delta;
      if (delta.type === 'text_delta') {
        const existing = assistantContent[event.index];
        if (existing && existing.type === 'text') {
          existing.text += delta.text;
        }
        appendText(delta.text);
        ctx.emit({ type: 'text_delta', delta: delta.text });
      } else if (delta.type === 'input_json_delta') {
        const acc = toolUseBlocks.get(event.index);
        if (acc) acc.raw += delta.partial_json;
      }
      return;
    }
    case 'content_block_stop': {
      const acc = toolUseBlocks.get(event.index);
      if (acc) {
        let parsed: unknown;
        try {
          parsed = acc.raw.length > 0 ? JSON.parse(acc.raw) : {};
        } catch {
          parsed = { __parse_error__: acc.raw };
        }
        const block = assistantContent[event.index];
        if (block && block.type === 'tool_use') {
          block.input = parsed as Record<string, unknown>;
        }
      }
      return;
    }
    case 'message_delta': {
      if (event.delta.stop_reason) setStopReason(event.delta.stop_reason);
      return;
    }
    default:
      return;
  }
}

async function runTool(
  acc: ToolUseAccumulator,
  ctx: StreamContext,
): Promise<Anthropic.ToolResultBlockParam> {
  const entry = toolByName.get(acc.name);
  if (!entry) {
    ctx.emit({ type: 'tool_call_end', tool: acc.name, ok: false });
    return {
      type: 'tool_result',
      tool_use_id: acc.id,
      content: `Unknown tool "${acc.name}".`,
      is_error: true,
    };
  }

  let input: unknown;
  try {
    input = acc.raw.length > 0 ? JSON.parse(acc.raw) : {};
  } catch (err) {
    ctx.emit({ type: 'tool_call_end', tool: acc.name, ok: false });
    return {
      type: 'tool_result',
      tool_use_id: acc.id,
      content: `Tool input was not valid JSON: ${(err as Error).message}.`,
      is_error: true,
    };
  }

  const preview = truncateArgsPreview(input);
  ctx.emit({ type: 'tool_call_start', tool: acc.name, args_preview: preview });

  const parseResult = entry.inputSchemaZod.safeParse(input);
  if (!parseResult.success) {
    ctx.emit({ type: 'tool_call_end', tool: acc.name, ok: false });
    return {
      type: 'tool_result',
      tool_use_id: acc.id,
      content: `Tool input failed validation: ${parseResult.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ')}.`,
      is_error: true,
    };
  }

  try {
    const result = await entry.handler(parseResult.data);
    ctx.emit({ type: 'tool_call_end', tool: acc.name, ok: true });
    if (acc.name === 'render_artifact') {
      maybeEmitArtifact(result, ctx);
    }
    return {
      type: 'tool_result',
      tool_use_id: acc.id,
      content: JSON.stringify(result),
    };
  } catch (err) {
    ctx.emit({ type: 'tool_call_end', tool: acc.name, ok: false });
    if (err instanceof StreamParseError) {
      ctx.emit({ type: 'error', message: err.message });
      return {
        type: 'tool_result',
        tool_use_id: acc.id,
        content: `render_artifact rejected the payload: ${err.message}. Re-check the payload shape against the schema and try again or answer in prose.`,
        is_error: true,
      };
    }
    if (err instanceof ToolInputError) {
      return {
        type: 'tool_result',
        tool_use_id: acc.id,
        content: err.message,
        is_error: true,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      type: 'tool_result',
      tool_use_id: acc.id,
      content: `Tool execution failed: ${message}.`,
      is_error: true,
    };
  }
}

function maybeEmitArtifact(result: unknown, ctx: StreamContext): void {
  if (
    typeof result !== 'object' ||
    result === null ||
    !('artifact' in result)
  ) {
    return;
  }
  const candidate = (result as { artifact: unknown }).artifact;
  try {
    const artifact = parseArtifactPayload(candidate);
    ctx.emit({ type: 'artifact', artifact });
  } catch (err) {
    if (err instanceof StreamParseError) {
      ctx.emit({ type: 'error', message: err.message });
    } else {
      throw err;
    }
  }
}

function emitCitations(text: string, ctx: StreamContext, seen: Set<number>): void {
  let match: RegExpExecArray | null;
  CITATION_PATTERN.lastIndex = 0;
  while ((match = CITATION_PATTERN.exec(text)) !== null) {
    const captured = match[1];
    if (!captured) continue;
    const page = Number.parseInt(captured, 10);
    if (!Number.isFinite(page) || seen.has(page)) continue;
    seen.add(page);
    ctx.citePage(page, inferCitationSource(page));
  }
}

export const __testing = { toolEntries, anthropicTools, emitCitations, inferCitationSource };
