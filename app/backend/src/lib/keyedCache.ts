/**
 * Keyed in-memory TTL cache.
 *
 * Like TimedCache but supports multiple keyed entries with independent TTLs.
 * Useful for caching parameterized query results (e.g., per-user robot lists,
 * per-tier league standings).
 *
 * Includes automatic eviction of expired entries when the cache exceeds maxSize,
 * preventing unbounded memory growth.
 */
export class KeyedCache<T> {
  private entries = new Map<string, { data: T; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxSize: number = 200,
  ) {}

  get(key: string): T | null {
    const entry = this.entries.get(key);
    if (entry && Date.now() < entry.expiresAt) {
      return entry.data;
    }
    this.entries.delete(key);
    return null;
  }

  set(key: string, data: T): void {
    // Evict expired entries if nearing capacity
    if (this.entries.size >= this.maxSize) {
      const now = Date.now();
      for (const [k, v] of this.entries) {
        if (now >= v.expiresAt) this.entries.delete(k);
      }
      // If still full, drop oldest entry
      if (this.entries.size >= this.maxSize) {
        const firstKey = this.entries.keys().next().value;
        if (firstKey) this.entries.delete(firstKey);
      }
    }
    this.entries.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }

  /** Invalidate a specific key. */
  invalidate(key: string): void {
    this.entries.delete(key);
  }

  /** Invalidate all entries (e.g., after a cycle runs). */
  invalidateAll(): void {
    this.entries.clear();
  }

  /** Current number of cached entries. */
  get size(): number {
    return this.entries.size;
  }
}
