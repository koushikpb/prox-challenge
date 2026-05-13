import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { Message } from './Message';
import type { AssistantMessage, ToolCallRecord } from './types';

const noop = () => undefined;

function makeAssistant(overrides: Partial<AssistantMessage> = {}): AssistantMessage {
  return {
    id: 'a-1',
    role: 'assistant',
    kind: 'answer',
    content: '',
    toolCalls: [],
    citations: [],
    artifacts: [],
    errors: [],
    done: false,
    ...overrides,
  };
}

describe('Message', () => {
  it('renders Markdown bold and lists in assistant prose', () => {
    const msg = makeAssistant({
      content: 'Here is the **rated** duty cycle.\n\n- 25%\n- 200 A',
      done: true,
    });
    const html = renderToStaticMarkup(<Message message={msg} onOpenCitation={noop} />);
    expect(html).toContain('<strong');
    expect(html).toMatch(/<strong[^>]*>rated<\/strong>/);
    expect(html).toContain('<ul');
    const liMatches = html.match(/<li[^>]*>/g) ?? [];
    expect(liMatches.length).toBe(2);
    expect(html).toContain('25%');
    expect(html).toContain('200 A');
  });

  it('strips inline (p. N) markers from prose and surfaces no Sources block', () => {
    const msg = makeAssistant({
      content: 'Use DCEN for flux-core (p. 7). The procedure is on (p. 24).',
      citations: [
        { page: 7, source: 'owner-manual' },
        { page: 24, source: 'owner-manual' },
        { page: 7, source: 'owner-manual' },
      ],
      done: true,
    });
    const html = renderToStaticMarkup(<Message message={msg} onOpenCitation={noop} />);

    expect(html).not.toContain('data-slot="citations-footer"');
    expect(html).not.toMatch(/>\s*Sources\s*</);

    const prose = html.match(/data-slot="assistant-prose"[\s\S]*?<\/div>/);
    expect(prose).not.toBeNull();
    expect(prose![0]).not.toMatch(/\(p\.\s*\d+\)/);
  });

  it('shows pending and ok chips while streaming and hides them once done', () => {
    const toolCalls: ToolCallRecord[] = [
      { id: 't-1', tool: 'lookup_duty_cycle', status: 'pending' },
      { id: 't-2', tool: 'render_artifact', status: 'ok' },
    ];
    const streaming = makeAssistant({ toolCalls, done: false });
    const finished = makeAssistant({
      toolCalls: toolCalls.map((c) => ({ ...c, status: 'ok' })),
      content: 'Done.',
      done: true,
    });

    const streamingHtml = renderToStaticMarkup(
      <Message message={streaming} onOpenCitation={noop} />,
    );
    expect(streamingHtml).toContain('data-slot="tool-chips-live"');
    const liveChips = streamingHtml.match(/data-slot="tool-chip"/g) ?? [];
    expect(liveChips.length).toBe(2);
    expect(streamingHtml).toContain('data-status="pending"');
    expect(streamingHtml).toContain('data-status="ok"');

    const doneHtml = renderToStaticMarkup(<Message message={finished} onOpenCitation={noop} />);
    expect(doneHtml).not.toContain('data-slot="tool-chips-live"');
    expect(doneHtml).not.toContain('data-slot="tool-chip"');
    expect(doneHtml).not.toContain('Show steps');
  });

  it('hides tool chips entirely when showSteps is false', () => {
    const streaming = makeAssistant({
      toolCalls: [{ id: 't-1', tool: 'lookup_duty_cycle', status: 'pending' }],
      done: false,
    });
    const html = renderToStaticMarkup(
      <Message message={streaming} onOpenCitation={noop} showSteps={false} />,
    );
    expect(html).not.toContain('data-slot="tool-chips-live"');
    expect(html).not.toContain('data-slot="tool-chip"');
  });
});
