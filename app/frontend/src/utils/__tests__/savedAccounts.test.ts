/**
 * Saved-accounts storage (#611 follow-up: Switch Account).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  listSavedAccounts,
  saveAccount,
  removeSavedAccount,
  getSavedAccount,
  type SavedAccount,
  type SavedAccountsStorage,
} from '../savedAccounts';

/** In-memory storage stub implementing the injectable contract. */
function makeStorage(initial: Record<string, string> = {}): SavedAccountsStorage {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
  };
}

const alice: SavedAccount = { userId: 1, label: 'Iron Wolves', username: 'alice', token: 'tok-a' };
const bob: SavedAccount = { userId: 2, label: 'Steel Hawks', username: 'bob', token: 'tok-b' };

describe('savedAccounts', () => {
  let storage: SavedAccountsStorage;

  beforeEach(() => {
    storage = makeStorage();
  });

  it('starts empty', () => {
    expect(listSavedAccounts(storage)).toEqual([]);
  });

  it('adds accounts, newest first', () => {
    saveAccount(alice, storage);
    saveAccount(bob, storage);
    expect(listSavedAccounts(storage)).toEqual([bob, alice]);
  });

  it('dedupes by userId and refreshes token/label, moving the entry to the front', () => {
    saveAccount(alice, storage);
    saveAccount(bob, storage);
    const refreshedAlice: SavedAccount = { ...alice, label: 'Iron Wolves Reborn', token: 'tok-a2' };
    saveAccount(refreshedAlice, storage);

    const list = listSavedAccounts(storage);
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual(refreshedAlice);
    expect(list[1]).toEqual(bob);
  });

  it('removes an account by userId', () => {
    saveAccount(alice, storage);
    saveAccount(bob, storage);
    const remaining = removeSavedAccount(1, storage);
    expect(remaining).toEqual([bob]);
    expect(listSavedAccounts(storage)).toEqual([bob]);
  });

  it('getSavedAccount finds a stored account or returns null', () => {
    saveAccount(alice, storage);
    expect(getSavedAccount(1, storage)).toEqual(alice);
    expect(getSavedAccount(999, storage)).toBeNull();
  });

  it('tolerates corrupt storage by treating it as empty', () => {
    const corrupt = makeStorage({ 'armouredsouls.savedAccounts': 'not json {' });
    expect(listSavedAccounts(corrupt)).toEqual([]);
  });

  it('filters out malformed entries', () => {
    const mixed = makeStorage({
      'armouredsouls.savedAccounts': JSON.stringify([
        alice,
        { userId: 'nope', label: 2 },
        bob,
      ]),
    });
    expect(listSavedAccounts(mixed)).toEqual([alice, bob]);
  });

  it('does not touch the active-session token key', () => {
    const backing: Record<string, string> = {};
    const spyStorage: SavedAccountsStorage = {
      getItem: (k) => backing[k] ?? null,
      setItem: (k, v) => {
        backing[k] = v;
      },
    };
    saveAccount(alice, spyStorage);
    expect(backing).not.toHaveProperty('token');
    expect(Object.keys(backing)).toEqual(['armouredsouls.savedAccounts']);
  });
});
