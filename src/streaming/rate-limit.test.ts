import { afterEach, describe, expect, it } from 'vitest';
import {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  checkRateLimit,
  resetRateLimit,
} from './rate-limit';

afterEach(() => {
  resetRateLimit();
});

describe('checkRateLimit', () => {
  it('allows requests under the limit', () => {
    const now = Date.now();
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      expect(checkRateLimit('1.2.3.4', now + i).allowed).toBe(true);
    }
  });

  it('rejects requests once the limit is hit', () => {
    const now = Date.now();
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      checkRateLimit('1.2.3.4', now + i);
    }
    const result = checkRateLimit('1.2.3.4', now + RATE_LIMIT_MAX_REQUESTS);
    expect(result.allowed).toBe(false);
    expect(result.retry_after_seconds).toBeGreaterThan(0);
  });

  it('expires entries after the window', () => {
    const now = Date.now();
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      checkRateLimit('1.2.3.4', now + i);
    }
    expect(checkRateLimit('1.2.3.4', now + RATE_LIMIT_WINDOW_MS + 1).allowed).toBe(true);
  });

  it('tracks IPs independently', () => {
    const now = Date.now();
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      checkRateLimit('1.1.1.1', now + i);
    }
    expect(checkRateLimit('1.1.1.1', now + RATE_LIMIT_MAX_REQUESTS).allowed).toBe(false);
    expect(checkRateLimit('2.2.2.2', now + RATE_LIMIT_MAX_REQUESTS).allowed).toBe(true);
  });

  it('treats empty strings as "unknown"', () => {
    const now = Date.now();
    expect(checkRateLimit('', now).allowed).toBe(true);
  });
});
