import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addRecentSearch,
  clearRecentSearches,
  clearSearchHistory,
  MAXIMUM_QUERY_LENGTH,
  MAX_RECENT_SEARCHES,
  normalizeRecentSearch,
  readRecentSearches,
  RECENT_SEARCH_STORAGE_KEY,
  sanitizeRecentSearches,
  writeRecentSearches,
} from '../searchHistory';

const storage = window.localStorage;

describe('searchHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.getItem).mockReset();
    vi.mocked(storage.setItem).mockReset();
    vi.mocked(storage.removeItem).mockReset();
  });

  describe('pure history functions', () => {
    it('trims edge whitespace while preserving internal whitespace', () => {
      expect(normalizeRecentSearch('  Iron   Fist  ')).toBe('Iron   Fist');
      expect(normalizeRecentSearch('\trobot\n')).toBe('robot');
    });

    it('rejects non-strings, blank values, and values over the query limit', () => {
      expect(normalizeRecentSearch(null)).toBeNull();
      expect(normalizeRecentSearch(undefined)).toBeNull();
      expect(normalizeRecentSearch(42)).toBeNull();
      expect(normalizeRecentSearch({})).toBeNull();
      expect(normalizeRecentSearch('')).toBeNull();
      expect(normalizeRecentSearch('   ')).toBeNull();
      expect(normalizeRecentSearch('a'.repeat(MAXIMUM_QUERY_LENGTH + 1))).toBeNull();
      expect(normalizeRecentSearch('a'.repeat(MAXIMUM_QUERY_LENGTH))).toHaveLength(MAXIMUM_QUERY_LENGTH);
    });

    it('sanitizes invalid entries, removes case-insensitive duplicates, and preserves newest-first order', () => {
      expect(sanitizeRecentSearches([
        '  Newest  ',
        'newest',
        123,
        null,
        '',
        '   ',
        'a'.repeat(MAXIMUM_QUERY_LENGTH + 1),
        'Second',
        'SECOND',
        'Third',
      ])).toEqual(['Newest', 'Second', 'Third']);
    });

    it('moves a repeated search to the front and bounds history at five entries', () => {
      const history = ['one', 'two', 'three', 'four', 'five'];

      expect(addRecentSearch(history, ' THREE ')).toEqual([
        'THREE',
        'one',
        'two',
        'four',
        'five',
      ]);
      expect(addRecentSearch(history, 'six')).toEqual([
        'six',
        'one',
        'two',
        'three',
        'four',
      ]);
      expect(addRecentSearch(history, '   ')).toEqual(history);
      expect(addRecentSearch([' ONE ', 42, 'two'], 'one')).toEqual(['one', 'two']);
      expect(MAX_RECENT_SEARCHES).toBe(5);
    });

    it('returns a new empty history for pure clearing', () => {
      expect(clearSearchHistory()).toEqual([]);
    });
  });

  describe('localStorage adapter', () => {
    it('reads a valid JSON array and sanitizes it before returning history', () => {
      vi.mocked(storage.getItem).mockReturnValue(JSON.stringify(['  robot ', 'Guide']));

      expect(readRecentSearches()).toEqual(['robot', 'Guide']);
      expect(storage.getItem).toHaveBeenCalledTimes(1);
      expect(storage.getItem).toHaveBeenCalledWith(RECENT_SEARCH_STORAGE_KEY);
    });

    it('treats malformed JSON as empty history', () => {
      vi.mocked(storage.getItem).mockReturnValue('{not-json');

      expect(readRecentSearches()).toEqual([]);
      expect(storage.getItem).toHaveBeenCalledWith(RECENT_SEARCH_STORAGE_KEY);
    });

    it('treats a non-array JSON payload as empty history', () => {
      vi.mocked(storage.getItem).mockReturnValue(JSON.stringify({ value: 'robot' }));

      expect(readRecentSearches()).toEqual([]);
    });

    it('discards non-string, blank, and overlength entries from stored arrays', () => {
      vi.mocked(storage.getItem).mockReturnValue(JSON.stringify([
        '  robot ',
        123,
        null,
        '',
        '   ',
        'a'.repeat(MAXIMUM_QUERY_LENGTH + 1),
        'guide',
      ]));

      expect(readRecentSearches()).toEqual(['robot', 'guide']);
    });

    it('returns empty history when the storage key is absent', () => {
      vi.mocked(storage.getItem).mockReturnValue(null);

      expect(readRecentSearches()).toEqual([]);
    });

    it('writes only normalized, unique, valid, bounded history', () => {
      const written = writeRecentSearches([
        ' one ',
        'TWO',
        'two',
        'three',
        4,
        '',
        'a'.repeat(MAXIMUM_QUERY_LENGTH + 1),
        'four',
        'five',
        'six',
      ]);

      expect(written).toEqual(['one', 'TWO', 'three', 'four', 'five']);
      expect(storage.setItem).toHaveBeenCalledTimes(1);
      expect(storage.setItem).toHaveBeenCalledWith(
        RECENT_SEARCH_STORAGE_KEY,
        JSON.stringify(written),
      );
    });

    it('clears only the configured history entry', () => {
      clearRecentSearches();

      expect(storage.removeItem).toHaveBeenCalledTimes(1);
      expect(storage.removeItem).toHaveBeenCalledWith(RECENT_SEARCH_STORAGE_KEY);
    });

    it('continues with empty history when reading storage is unavailable', () => {
      vi.mocked(storage.getItem).mockImplementation(() => {
        throw new Error('storage unavailable');
      });

      expect(readRecentSearches()).toEqual([]);
      expect(storage.getItem).toHaveBeenCalledWith(RECENT_SEARCH_STORAGE_KEY);
    });

    it('continues with normalized history when writing storage is unavailable', () => {
      vi.mocked(storage.setItem).mockImplementation(() => {
        throw new Error('storage unavailable');
      });

      expect(writeRecentSearches(['  robot  ', 'ROBOT', 'guide'])).toEqual(['robot', 'guide']);
      expect(storage.setItem).toHaveBeenCalledWith(
        RECENT_SEARCH_STORAGE_KEY,
        JSON.stringify(['robot', 'guide']),
      );
    });

    it('does not throw when removing from storage is unavailable', () => {
      vi.mocked(storage.removeItem).mockImplementation(() => {
        throw new Error('storage unavailable');
      });

      expect(() => clearRecentSearches()).not.toThrow();
      expect(storage.removeItem).toHaveBeenCalledWith(RECENT_SEARCH_STORAGE_KEY);
    });

    it('uses browser-local storage only and does not invoke backend or analytics transports', () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const sendBeaconMock = vi.fn();
      const existingSendBeacon = Object.getOwnPropertyDescriptor(navigator, 'sendBeacon');
      Object.defineProperty(navigator, 'sendBeacon', {
        configurable: true,
        value: sendBeaconMock,
      });

      try {
        writeRecentSearches(['robot']);
        readRecentSearches();
        clearRecentSearches();

        expect(fetchMock).not.toHaveBeenCalled();
        expect(sendBeaconMock).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllGlobals();
        if (existingSendBeacon) {
          Object.defineProperty(navigator, 'sendBeacon', existingSendBeacon);
        } else {
          delete (navigator as { sendBeacon?: unknown }).sendBeacon;
        }
      }
    });
  });
});
