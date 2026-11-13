/**
 * Saved-accounts storage for the Switch Account feature.
 *
 * ACC players commonly run several stables, each a separate account. This module
 * keeps a small list of accounts the player has signed into, so they can hop
 * between them from the navbar without typing credentials every time.
 *
 * Deliberate boundaries:
 *   - Stored under a DEDICATED key (`armouredsouls.savedAccounts`), never the
 *     active-session key `token`. The axios interceptor, `AuthContext` session
 *     restore, and `refreshUser` all assume `localStorage['token']` is the one
 *     active token; overloading it would corrupt the session.
 *   - A saved token is a best-effort convenience. It can be expired or
 *     `tokenVersion`-revoked by the backend at any time, so callers MUST handle a
 *     rejected switch by falling back to the login form. This module does not
 *     validate tokens — it only stores and lists them.
 *   - Pure and testable: the storage backend is injected, defaulting to
 *     `window.localStorage`, so tests can pass an in-memory stub.
 *
 * This is explicitly NOT server-side multi-session management: there is no
 * refresh token, no session table, and no server logout. See the Switch Account
 * implementation note.
 */

import { createLogger } from './logger';

const log = createLogger('savedAccounts');

const STORAGE_KEY = 'armouredsouls.savedAccounts';

/** One remembered account. `token` is that account's JWT at save time. */
export interface SavedAccount {
  /** The account's user id — the dedupe key. */
  userId: number;
  /** Display label: stable name when set, otherwise username. */
  label: string;
  /** Username, used for the "log in as" fallback when the saved token is stale. */
  username: string;
  /** The account's JWT. May be expired or revoked; treat as best-effort. */
  token: string;
}

/**
 * Minimal storage contract — the slice of the Web Storage API this module needs.
 * Injectable so tests can supply an in-memory stub.
 */
export interface SavedAccountsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): SavedAccountsStorage | null {
  try {
    return window.localStorage;
  } catch {
    // Storage can throw in locked-down privacy modes; the feature then degrades
    // to "no saved accounts" rather than crashing.
    return null;
  }
}

function isSavedAccount(value: unknown): value is SavedAccount {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.userId === 'number' &&
    typeof v.label === 'string' &&
    typeof v.username === 'string' &&
    typeof v.token === 'string'
  );
}

/** Read the saved accounts, tolerating absent or corrupt storage. */
export function listSavedAccounts(storage: SavedAccountsStorage | null = defaultStorage()): SavedAccount[] {
  if (!storage) return [];
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedAccount);
  } catch {
    // Corrupt JSON: behave as if there were no saved accounts rather than throw.
    log.warn('Saved accounts store was unreadable; ignoring it');
    return [];
  }
}

function write(storage: SavedAccountsStorage, accounts: SavedAccount[]): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

/**
 * Add or refresh an account. Dedupes by `userId`: an existing entry is replaced
 * (updating its label and latest token) and moved to the front, so the most
 * recently used account is listed first.
 */
export function saveAccount(
  account: SavedAccount,
  storage: SavedAccountsStorage | null = defaultStorage(),
): SavedAccount[] {
  if (!storage) return [];
  const rest = listSavedAccounts(storage).filter((a) => a.userId !== account.userId);
  const next = [account, ...rest];
  write(storage, next);
  return next;
}

/** Remove a saved account by user id. Returns the remaining list. */
export function removeSavedAccount(
  userId: number,
  storage: SavedAccountsStorage | null = defaultStorage(),
): SavedAccount[] {
  if (!storage) return [];
  const next = listSavedAccounts(storage).filter((a) => a.userId !== userId);
  write(storage, next);
  return next;
}

/** Look up a single saved account by user id, or null when absent. */
export function getSavedAccount(
  userId: number,
  storage: SavedAccountsStorage | null = defaultStorage(),
): SavedAccount | null {
  return listSavedAccounts(storage).find((a) => a.userId === userId) ?? null;
}
