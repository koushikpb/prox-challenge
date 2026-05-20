import type { ImageMediaType, UserContentBlock } from '@/streaming';

export const MAX_LONG_EDGE_PX = 1600;
export const COMPRESS_SIZE_THRESHOLD_BYTES = 1_500_000;
export const COMPRESS_LONG_EDGE_THRESHOLD_PX = 2000;
export const PER_ATTACHMENT_BYTE_LIMIT = 4 * 1024 * 1024;

const FILE_EXT_TO_MEDIA: Record<string, ImageMediaType> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

export function inferMediaType(filename: string): ImageMediaType | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return null;
  return FILE_EXT_TO_MEDIA[ext] ?? null;
}

export type CompressDecision = {
  shouldCompress: boolean;
  targetLongEdge: number;
  reason: 'size' | 'dimensions' | 'none';
};

// The compression decision is intentionally separated from the canvas work
// so it can be unit-tested without a DOM. The thresholds match the Task
// Prompt: > 1.5 MB OR > 2000 px on the long edge.
export function decideCompression(
  sizeBytes: number,
  longestEdgePx: number,
): CompressDecision {
  if (sizeBytes > COMPRESS_SIZE_THRESHOLD_BYTES) {
    return { shouldCompress: true, targetLongEdge: MAX_LONG_EDGE_PX, reason: 'size' };
  }
  if (longestEdgePx > COMPRESS_LONG_EDGE_THRESHOLD_PX) {
    return { shouldCompress: true, targetLongEdge: MAX_LONG_EDGE_PX, reason: 'dimensions' };
  }
  return { shouldCompress: false, targetLongEdge: longestEdgePx, reason: 'none' };
}

// Source-format → output-format selection for the canvas re-encode.
// Transparent PNGs preserve their alpha; everything else collapses to JPEG
// for size. WebP/GIF re-encode as JPEG since the canvas drop loses animation
// regardless, and the model accepts JPEG everywhere.
export function chooseOutputType(sourceType: ImageMediaType): {
  mimeType: 'image/png' | 'image/jpeg';
  mediaType: ImageMediaType;
  quality: number;
} {
  if (sourceType === 'image/png') {
    return { mimeType: 'image/png', mediaType: 'image/png', quality: 1 };
  }
  return { mimeType: 'image/jpeg', mediaType: 'image/jpeg', quality: 0.85 };
}

export function fitWithin(
  width: number,
  height: number,
  maxLongEdge: number,
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) return { width, height };
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return await blob.arrayBuffer();
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

export type PreparedAttachment = {
  block: Extract<UserContentBlock, { type: 'image' }>;
  previewUrl: string;
  filename: string;
  sizeBytes: number;
};

// Browser-only path. Reads a File via createImageBitmap (or the legacy <img>
// fallback), draws it to an offscreen canvas, and base64-encodes the resulting
// Blob. The canvas re-encode also strips EXIF — relied upon intentionally so
// we do not need to ship a metadata-rewriting library.
export async function prepareAttachment(file: File): Promise<PreparedAttachment> {
  const sourceMedia = inferMediaType(file.name);
  if (!sourceMedia) {
    throw new Error(`Unsupported file type: ${file.name}`);
  }

  const sizeBytes = file.size;
  const arrayBuffer = await blobToArrayBuffer(file);
  const dimensions = await readImageDimensions(file);
  const decision = decideCompression(sizeBytes, Math.max(dimensions.width, dimensions.height));

  let outBlob: Blob;
  let outMedia: ImageMediaType;
  if (decision.shouldCompress) {
    const out = await canvasEncode(file, decision.targetLongEdge, sourceMedia);
    outBlob = out.blob;
    outMedia = out.mediaType;
  } else {
    outBlob = new Blob([arrayBuffer], { type: sourceMedia });
    outMedia = sourceMedia;
  }

  if (outBlob.size > PER_ATTACHMENT_BYTE_LIMIT) {
    throw new Error(
      `Attachment "${file.name}" exceeds the 4 MB cap after compression (${Math.round(outBlob.size / 1024)} KB).`,
    );
  }

  const outBuf = await blobToArrayBuffer(outBlob);
  const base64 = arrayBufferToBase64(outBuf);
  const previewUrl = URL.createObjectURL(outBlob);

  return {
    block: {
      type: 'image',
      source: { type: 'base64', media_type: outMedia, data: base64 },
    },
    previewUrl,
    filename: file.name,
    sizeBytes: outBlob.size,
  };
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      const out = { width: bitmap.width, height: bitmap.height };
      bitmap.close?.();
      return out;
    } catch {
      // fall through to <img> path
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const out = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(out);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

async function canvasEncode(
  file: File,
  targetLongEdge: number,
  sourceMedia: ImageMediaType,
): Promise<{ blob: Blob; mediaType: ImageMediaType }> {
  const bitmap =
    typeof createImageBitmap === 'function' ? await createImageBitmap(file) : null;
  let drawWidth: number;
  let drawHeight: number;
  let drawSource: CanvasImageSource;

  if (bitmap) {
    drawWidth = bitmap.width;
    drawHeight = bitmap.height;
    drawSource = bitmap;
  } else {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const el = new Image();
      el.onload = () => {
        resolve(el);
        URL.revokeObjectURL(url);
      };
      el.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      el.src = url;
    });
    drawWidth = img.naturalWidth;
    drawHeight = img.naturalHeight;
    drawSource = img;
  }

  const fit = fitWithin(drawWidth, drawHeight, targetLongEdge);
  const canvas = document.createElement('canvas');
  canvas.width = fit.width;
  canvas.height = fit.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable; cannot compress image.');
  }
  ctx.drawImage(drawSource, 0, 0, fit.width, fit.height);
  bitmap?.close?.();

  const { mimeType, mediaType, quality } = chooseOutputType(sourceMedia);
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      mimeType,
      quality,
    );
  });
  return { blob, mediaType };
}
