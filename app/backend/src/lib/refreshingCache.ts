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
 * Meant for expensive read-mostly payloads such as the Hall of Records, where
 * a few minutes of staleness is fine but making a visitor wait ~10 s for a
 * rebuild after every expiry (as `TimedCache` did) is not.
 */
export class RefreshingCache<T> {
  private value: T | null = null;
  private loadedAt = 0;
  private inFlight: Promise<T> | null = null;

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
      this.inFlight = this.load()
        .then((value) => {
          this.value = value;
          this.loadedAt = this.now();
          return value;
        })
        .finally(() => {
          this.inFlight = null;
        });
    }
    return this.inFlight;
  }

  /** Drop the cached value; the next `get` waits for a fresh load. */
  invalidate(): void {
    this.value = null;
    this.loadedAt = 0;
  }

  private refreshInBackground(): void {
    if (this.inFlight) return;
    this.refresh().catch(this.onError);
  }
}
