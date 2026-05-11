import { describe, expect, it } from 'vitest';

import { detectSpeechSupport } from './useSpeech';

describe('detectSpeechSupport', () => {
  it('returns false on the server (no window)', () => {
    expect(detectSpeechSupport(undefined)).toEqual({ recognition: false, synthesis: false });
  });

  it('returns false flags when neither vendor-prefixed API exists', () => {
    const win = {} as Parameters<typeof detectSpeechSupport>[0];
    expect(detectSpeechSupport(win)).toEqual({ recognition: false, synthesis: false });
  });

  it('detects unprefixed SpeechRecognition', () => {
    const win = {
      SpeechRecognition: function () {} as unknown,
    } as Parameters<typeof detectSpeechSupport>[0];
    const support = detectSpeechSupport(win);
    expect(support.recognition).toBe(true);
    expect(support.synthesis).toBe(false);
  });

  it('detects webkit-prefixed SpeechRecognition', () => {
    const win = {
      webkitSpeechRecognition: function () {} as unknown,
    } as Parameters<typeof detectSpeechSupport>[0];
    expect(detectSpeechSupport(win).recognition).toBe(true);
  });

  it('detects speechSynthesis presence', () => {
    const win = {
      speechSynthesis: { speak: () => {} },
    } as unknown as Parameters<typeof detectSpeechSupport>[0];
    const support = detectSpeechSupport(win);
    expect(support.synthesis).toBe(true);
    expect(support.recognition).toBe(false);
  });
});
