'use client';

const cache = new Map<string, Promise<unknown>>();

export function loadJson<T>(url: string): Promise<T> {
  let pending = cache.get(url);
  if (!pending) {
    pending = fetch(url, { credentials: 'omit' }).then(async (res) => {
      if (!res.ok) {
        throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
      }
      return (await res.json()) as unknown;
    });
    cache.set(url, pending);
  }
  return pending as Promise<T>;
}
