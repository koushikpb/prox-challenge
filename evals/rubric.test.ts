import { describe, expect, it } from 'vitest';
import type { StreamEvent } from '@/streaming';
import {
  applyRubric,
  checkArtifact,
  checkClarification,
  checkExpectedFacts,
  checkImage,
  checkSafetyNudge,
  endsWithQuestionMark,
  firstParagraph,
  type PageExistsPredicate,
} from './rubric';
import type { GoldenEntry } from './types';

const text = (s: string): StreamEvent => ({ type: 'text_delta', delta: s });
const cite = (page: number, source: 'owner-manual' | 'quick-start' | 'selection-chart' = 'owner-manual'): StreamEvent => ({
  type: 'citation',
  page,
  source,
});

describe('checkExpectedFacts', () => {
  it('passes when every fact appears (case-insensitive)', () => {
    const r = checkExpectedFacts('Duty cycle is 25% at 240V.', ['25%', '240V']);
    expect(r).toEqual({ ok: true, missing: [] });
  });
  it('reports each missing fact verbatim', () => {
    const r = checkExpectedFacts('it is hot today', ['25%', '240V']);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['25%', '240V']);
  });
});

describe('checkImage', () => {
  const pageExists: PageExistsPredicate = (source, page) =>
    source === 'owner-manual' && page === 14;

  it('returns true when expected and a citation resolves to a real page image', () => {
    const events = [text('see p. 14'), cite(14)];
    expect(checkImage(events, true, pageExists)).toBe(true);
  });
  it('returns false when expected but no citation resolves', () => {
    const events = [text('see p. 99'), cite(99)];
    expect(checkImage(events, true, pageExists)).toBe(false);
  });
  it('returns true when not expected, regardless of citations (presence-only)', () => {
    expect(checkImage([text('plain text')], false, pageExists)).toBe(true);
    expect(checkImage([text('see p. 14'), cite(14)], false, pageExists)).toBe(true);
  });
});

describe('checkArtifact', () => {
  const dutyArtifact: StreamEvent = {
    type: 'artifact',
    artifact: {
      type: 'duty_cycle',
      process: 'MIG',
      input_voltage: 240,
      amperage: 200,
      duty_cycle_pct: 25,
      work_minutes: 2.5,
      rest_minutes: 7.5,
      source_page: 7,
    },
  };

  it('matches the expected artifact kind', () => {
    expect(checkArtifact([dutyArtifact], 'duty_cycle')).toBe(true);
  });
  it('rejects when the expected kind is absent', () => {
    expect(checkArtifact([dutyArtifact], 'polarity')).toBe(false);
  });
  it('requires zero artifacts when expected is null', () => {
    expect(checkArtifact([text('hi')], null)).toBe(true);
    expect(checkArtifact([dutyArtifact], null)).toBe(false);
  });
});

describe('checkClarification', () => {
  it('treats a question-mark-terminated response (with trailing citation) as a clarification', () => {
    expect(
      checkClarification('Which welding process — MIG, TIG, or Stick? (p. 8)', true),
    ).toBe(true);
  });
  it('rejects a declarative response when clarification was expected', () => {
    expect(checkClarification('Use DCEP for solid-core MIG. (p. 14)', true)).toBe(false);
  });
  it('passes a declarative answer when clarification was not expected', () => {
    expect(checkClarification('Use DCEP for solid-core MIG. (p. 14)', false)).toBe(true);
  });
  it('endsWithQuestionMark strips parenthetical page citations from the tail', () => {
    expect(endsWithQuestionMark('Which process? (p. 8)')).toBe(true);
    expect(endsWithQuestionMark('Use DCEP. (p. 14)')).toBe(false);
  });
});

describe('checkSafetyNudge', () => {
  it('matches a "Heads up: unplug" lead paragraph when expected', () => {
    const txt = 'Heads up: unplug the welder before wiring polarity sockets.\n\nThen swap the cables.';
    expect(checkSafetyNudge(txt, true)).toBe(true);
  });
  it('rejects a lead paragraph with no safety keyword when expected', () => {
    expect(checkSafetyNudge('Duty cycle is 25% on 240V.', true)).toBe(false);
  });
  it('passes a non-safety response when not expected', () => {
    expect(checkSafetyNudge('Duty cycle is 25% on 240V.', false)).toBe(true);
  });
  it('firstParagraph slices at the first blank line', () => {
    expect(firstParagraph('Heads up: unplug.\n\nThen swap.')).toBe('Heads up: unplug.');
  });
});

describe('applyRubric', () => {
  const entry: GoldenEntry = {
    id: 'TQ',
    question: 'Polarity for TIG?',
    expected_facts: ['DCEN', 'Positive'],
    expects_image: true,
    expects_artifact: 'polarity',
    expects_clarification: false,
    expects_safety_nudge: false,
  };
  const events: StreamEvent[] = [
    text('TIG runs DCEN: ground clamp into the Positive (+) socket. (p. 24)'),
    cite(24),
    {
      type: 'artifact',
      artifact: {
        type: 'polarity',
        process: 'TIG',
        ground_socket: 'Positive',
        electrode_socket: 'Negative',
        polarity_name: 'DCEN',
        source_page: 24,
      },
    },
  ];
  const pageExists: PageExistsPredicate = (s, p) => s === 'owner-manual' && p === 24;

  it('aggregates all five checks into one result row', () => {
    const r = applyRubric(events, entry, { pageExists });
    expect(r.id).toBe('TQ');
    expect(r.results).toEqual({
      facts: true,
      image: true,
      artifact: true,
      clarification: true,
      safety: true,
    });
    expect(r.overall).toBe(true);
    expect(r.missing_facts).toEqual([]);
  });
});
