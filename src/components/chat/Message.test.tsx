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

  it('relocates citations to a Sources footer, deduped, and strips inline (p. N) markers', () => {
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

    expect(html).toContain('data-slot="citations-footer"');
    expect(html).toContain('Sources');

    const cards = html.match(/data-slot="citation-card"/g) ?? [];
    expect(cards.length).toBe(2);

    expect(html).toMatch(/data-page="7"/);
    expect(html).toMatch(/data-page="24"/);

    const prose = html.match(/data-slot="assistant-prose"[\s\S]*?(?=data-slot="citations-footer")/);
    expect(prose).not.toBeNull();
    expect(prose![0]).not.toMatch(/\(p\.\s*\d+\)/);
    expect(prose![0]).not.toContain('data-slot="citation-card"');
  });

  it('hides tool chips when done and surfaces them via a Show steps disclosure', () => {
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
    expect(streamingHtml).not.toContain('data-slot="tool-chips-disclosure"');

    const doneHtml = renderToStaticMarkup(<Message message={finished} onOpenCitation={noop} />);
    expect(doneHtml).not.toContain('data-slot="tool-chips-live"');
    expect(doneHtml).toContain('data-slot="tool-chips-disclosure"');
    expect(doneHtml).toContain('Show steps');
    const chipCount = (doneHtml.match(/data-slot="tool-chip"/g) ?? []).length;
    expect(chipCount).toBe(2);
  });
});
