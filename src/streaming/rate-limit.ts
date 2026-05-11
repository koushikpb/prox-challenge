export const RATE_LIMIT_MAX_REQUESTS = 30;
export const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  retry_after_seconds?: number;
};

export function checkRateLimit(
  ip: string,
  now: number = Date.now(),
  max: number = RATE_LIMIT_MAX_REQUESTS,
  windowMs: number = RATE_LIMIT_WINDOW_MS,
): RateLimitResult {
  pruneIfNeeded(now, windowMs);

  const key = ip || 'unknown';
  const bucket = buckets.get(key) ?? { timestamps: [] };
  const cutoff = now - windowMs;
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);

  if (bucket.timestamps.length >= max) {
    const oldest = bucket.timestamps[0]!;
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(key, bucket);
    return { allowed: false, retry_after_seconds: retryAfter };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { allowed: true };
}

export function resetRateLimit(): void {
  buckets.clear();
  lastPruneAt = 0;
}

let lastPruneAt = 0;

function pruneIfNeeded(now: number, windowMs: number): void {
  if (now - lastPruneAt < windowMs) return;
  lastPruneAt = now;
  const cutoff = now - 2 * windowMs;
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}
