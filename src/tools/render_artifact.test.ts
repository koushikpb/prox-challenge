import { describe, expect, it } from 'vitest';
import { StreamParseError } from '@/streaming';
import { renderArtifact } from './render_artifact';

describe('render_artifact', () => {
  it('returns rendered:true for a valid polarity payload', () => {
    const out = renderArtifact({
      type: 'polarity',
      payload: {
        process: 'TIG',
        ground_socket: 'Positive',
        electrode_socket: 'Negative',
        polarity_name: 'DCEN',
        source_page: 24,
      },
    });
    expect(out.rendered).toBe(true);
    expect(out.artifact.type).toBe('polarity');
  });

  it('throws StreamParseError when polarity_name is not DCEP/DCEN', () => {
    expect(() =>
      renderArtifact({
        type: 'polarity',
        payload: {
          process: 'TIG',
          ground_socket: 'Positive',
          electrode_socket: 'Negative',
          polarity_name: 'DCXY',
          source_page: 24,
        },
      }),
    ).toThrow(StreamParseError);
  });

  it('throws StreamParseError when the type disagrees with the payload shape', () => {
    expect(() =>
      renderArtifact({
        type: 'duty_cycle',
        payload: { process: 'MIG', polarity_name: 'DCEP' },
      }),
    ).toThrow(StreamParseError);
  });
});
