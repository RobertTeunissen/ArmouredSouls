import logger from '../../config/logger';

const TTL_MS = 300_000; // 5 minutes
const MAX_PENDING_PER_USER = 3;
const CLEANUP_INTERVAL_MS = 60_000; // 60 seconds

export interface PendingUploadEntry {
  processedBuffer: Buffer;
  userId: number;
  robotId: number;
  originalFileSize: number;
  originalDimensions: { width: number; height: number };
  acknowledgedRobotLikeness: boolean;
  moderationScores?: Record<string, number>;
  robotLikenessScore?: number;
  createdAt: number;
}

class PendingUploadCache {
  private cache = new Map<string, PendingUploadEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Store a pending upload entry keyed by confirmation token.
   * Enforces max pending per user — evicts the oldest entry for that user if limit exceeded.
   */
  store(token: string, entry: PendingUploadEntry): void {
    // Enforce per-user limit: find all entries for this user
    const userEntries: { token: string; createdAt: number }[] = [];
    for (const [existingToken, existingEntry] of this.cache) {
      if (existingEntry.userId === entry.userId) {
        userEntries.push({ token: existingToken, createdAt: existingEntry.createdAt });
      }
    }

    // Evict oldest entries until we're under the limit (leaving room for the new one)
    if (userEntries.length >= MAX_PENDING_PER_USER) {
      userEntries.sort((a, b) => a.createdAt - b.createdAt);
      const toEvict = userEntries.length - MAX_PENDING_PER_USER + 1;
      for (let i = 0; i < toEvict; i++) {
        this.cache.delete(userEntries[i].token);
        logger.info(`Evicted oldest pending upload for user ${entry.userId} (token: ${userEntries[i].token})`);
      }
    }

    this.cache.set(token, entry);
  }

  /**
   * Retrieve a pending upload entry if it exists and has not expired.
   * Returns null for expired or non-existent tokens.
   */
  retrieve(token: string): PendingUploadEntry | null {
    const entry = this.cache.get(token);
    if (!entry) {
      return null;
    }

    if (Date.now() - entry.createdAt > TTL_MS) {
      this.cache.delete(token);
      return null;
    }

    return entry;
  }

  /**
   * Remove a specific entry from the cache.
   */
  delete(token: string): void {
    this.cache.delete(token);
  }

  /**
   * Remove all expired entries from the cache.
   */
  cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [token, entry] of this.cache) {
      if (now - entry.createdAt > TTL_MS) {
        this.cache.delete(token);
        removed++;
      }
    }
    if (removed > 0) {
      logger.info(`PendingUploadCache cleanup: removed ${removed} expired entries`);
    }
  }

  /**
   * Start the periodic cleanup interval.
   * Separated from constructor so tests can control timing.
   */
  startCleanup(): void {
    if (this.cleanupTimer) {
      return;
    }
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    // Allow the Node.js process to exit even if the timer is still running
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop the periodic cleanup interval.
   * Useful for tests and graceful shutdown.
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Get the current number of entries in the cache (for testing/monitoring).
   */
  get size(): number {
    return this.cache.size;
  }
}

export const pendingUploadCache = new PendingUploadCache();
pendingUploadCache.startCleanup();
