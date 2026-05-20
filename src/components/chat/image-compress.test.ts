import { describe, expect, it } from 'vitest';
import {
  COMPRESS_LONG_EDGE_THRESHOLD_PX,
  COMPRESS_SIZE_THRESHOLD_BYTES,
  MAX_LONG_EDGE_PX,
  chooseOutputType,
  decideCompression,
  fitWithin,
  inferMediaType,
} from './image-compress';

describe('inferMediaType', () => {
  it.each([
    ['photo.png', 'image/png'],
    ['photo.PNG', 'image/png'],
    ['photo.jpg', 'image/jpeg'],
    ['photo.jpeg', 'image/jpeg'],
    ['photo.webp', 'image/webp'],
    ['photo.gif', 'image/gif'],
  ])('maps %s → %s', (name, expected) => {
    expect(inferMediaType(name)).toBe(expected);
  });

  it('returns null for unknown extensions', () => {
    expect(inferMediaType('notes.txt')).toBeNull();
    expect(inferMediaType('rotated.heic')).toBeNull();
    expect(inferMediaType('vector.svg')).toBeNull();
    expect(inferMediaType('noext')).toBeNull();
  });
});

describe('decideCompression', () => {
  it('skips compression when the image is small and modest in size', () => {
    const out = decideCompression(500_000, 1200);
    expect(out.shouldCompress).toBe(false);
    expect(out.reason).toBe('none');
  });

  it('triggers on byte size alone (1.6 MB at 800px)', () => {
    const out = decideCompression(COMPRESS_SIZE_THRESHOLD_BYTES + 1, 800);
    expect(out.shouldCompress).toBe(true);
    expect(out.reason).toBe('size');
    expect(out.targetLongEdge).toBe(MAX_LONG_EDGE_PX);
  });

  it('triggers on dimensions alone (small file, 3000 px long edge)', () => {
    const out = decideCompression(100_000, COMPRESS_LONG_EDGE_THRESHOLD_PX + 1);
    expect(out.shouldCompress).toBe(true);
    expect(out.reason).toBe('dimensions');
  });

  it('size dominates when both triggers fire', () => {
    const out = decideCompression(5_000_000, 4000);
    expect(out.reason).toBe('size');
  });
});

describe('chooseOutputType', () => {
  it('preserves PNG to keep alpha', () => {
    const out = chooseOutputType('image/png');
    expect(out.mediaType).toBe('image/png');
    expect(out.mimeType).toBe('image/png');
  });

  it.each(['image/jpeg', 'image/webp', 'image/gif'] as const)(
    'collapses %s to JPEG at 0.85 quality',
    (source) => {
      const out = chooseOutputType(source);
      expect(out.mediaType).toBe('image/jpeg');
      expect(out.mimeType).toBe('image/jpeg');
      expect(out.quality).toBe(0.85);
    },
  );
});

describe('fitWithin', () => {
  it('leaves dimensions unchanged when already inside the box', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('scales the long edge down to the target and preserves aspect ratio', () => {
    const out = fitWithin(4000, 2000, 1600);
    expect(out.width).toBe(1600);
    expect(out.height).toBe(800);
  });

  it('handles a tall image too', () => {
    const out = fitWithin(2000, 4000, 1600);
    expect(out.width).toBe(800);
    expect(out.height).toBe(1600);
  });
});
