/**
 * Simple in-memory TTL cache.
 *
 * Stores a single value with a time-to-live. After the TTL expires,
 * the next `get()` returns null and the value is cleared.
 *
 * Designed for caching expensive query results that change infrequently
 * (e.g., Hall of Records, leaderboards).
 */
export class TimedCache<T> {
  private value: T | null = null;
  private expiresAt = 0;

  constructor(private readonly ttlMs: number) {}

  get(): T | null {
    if (this.value !== null && Date.now() < this.expiresAt) {
      return this.value;
    }
    this.value = null;
    return null;
  }

  set(value: T): void {
    this.value = value;
    this.expiresAt = Date.now() + this.ttlMs;
  }

  invalidate(): void {
    this.value = null;
    this.expiresAt = 0;
  }
}
