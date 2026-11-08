/**
 * In-memory single-value cache that refreshes in the background.
 *
 * - Fresh value (younger than `ttlMs`): returned as is.
 * - Stale value: returned immediately, and one background refresh starts.
 * - No value yet: the caller waits for the load; concurrent callers share it.
 *
 * A failed background refresh keeps the stale value (and is reported through
 * `onError`); a failed first load rejects for every waiting caller and leaves
 * the cache empty, so the next call tries again.
 *
 * `invalidate` also discards a load already in flight: it read the data from
 * before the change that caused the invalidation (a season rollover), so its
 * result is never stored and the next `get` starts a new load.
 *
 * Meant for expensive read-mostly payloads such as the Hall of Records, where
 * a few minutes of staleness is fine but making a visitor wait ~10 s for a
 * rebuild after every expiry (as `TimedCache` did) is not.
 */
export class RefreshingCache<T> {
  private value: T | null = null;
  private loadedAt = 0;
  private inFlight: Promise<T> | null = null;
  /** Bumped by `invalidate`; a load started under an older one is discarded. */
  private generation = 0;

  constructor(
    private readonly ttlMs: number,
    private readonly load: () => Promise<T>,
    private readonly onError: (error: unknown) => void = () => {},
    private readonly now: () => number = Date.now,
  ) {}

  /** The cached value, refreshed in the background once stale. */
  async get(): Promise<T> {
    if (this.value !== null) {
      if (this.now() - this.loadedAt >= this.ttlMs) this.refreshInBackground();
      return this.value;
    }
    return this.refresh();
  }

  /** Load now (or join the load in flight) and cache the result. */
  refresh(): Promise<T> {
    if (!this.inFlight) {
      const generation = this.generation;
      const load: Promise<T> = this.load()
        .then((value) => {
          if (generation === this.generation) {
            this.value = value;
            this.loadedAt = this.now();
          }
          return value;
        })
        .finally(() => {
          if (this.inFlight === load) this.inFlight = null;
        });
      this.inFlight = load;
    }
    return this.inFlight;
  }

  /**
   * Drop the cached value and any load in flight; the next `get` waits for a
   * fresh load.
   */
  invalidate(): void {
    this.generation += 1;
    this.value = null;
    this.loadedAt = 0;
    this.inFlight = null;
  }

  private refreshInBackground(): void {
    if (this.inFlight) return;
    this.refresh().catch(this.onError);
  }
}
