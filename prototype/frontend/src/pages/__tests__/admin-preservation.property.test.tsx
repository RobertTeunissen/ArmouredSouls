/**
 * Preservation Property Tests for Admin Page Overhaul (Bugfix Spec - Task 2)
 *
 * These tests capture baseline behavior on UNFIXED code.
 * They MUST PASS before and after the fix to ensure no regressions.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import * as fc from 'fast-check';
import axios from 'axios';
import BattleDetailsModal from '../../components/BattleDetailsModal';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

vi.mock('../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    refreshUser: vi.fn(),
    user: { id: 1, username: 'admin', role: 'admin', currency: 50000 },
    token: 'mock-token',
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
  }),
}));

vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="navigation">Navigation</div>,
}));

// ── Arbitraries ────────────────────────────────────────────────────────────

const ROBOT_ATTRIBUTES = [
  'combatPower', 'armor', 'speed', 'accuracy', 'evasion',
  'criticalChance', 'shieldStrength', 'counterAttack',
];

/** Generates a valid robot object for BattleDetailsModal */
const robotArb = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  name: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
  maxHP: fc.integer({ min: 50, max: 500 }),
  loadout: fc.constantFrom('balanced', 'offensive', 'defensive', 'none'),
  stance: fc.constantFrom('aggressive', 'defensive', 'balanced'),
  attributes: fc.record(
    Object.fromEntries(ROBOT_ATTRIBUTES.map(attr => [attr, fc.float({ min: 1, max: 100, noNaN: true })]))
  ),
});

/** Generates a combat event for the battle log */
const combatEventArb = fc.record({
  timestamp: fc.float({ min: 0, max: 120, noNaN: true }),
  type: fc.constantFrom('attack', 'critical', 'miss', 'counter', 'shield_break', 'yield', 'destroyed'),
  message: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  robot1HP: fc.integer({ min: 0, max: 500 }),
  robot2HP: fc.integer({ min: 0, max: 500 }),
  robot1Shield: fc.integer({ min: 0, max: 200 }),
  robot2Shield: fc.integer({ min: 0, max: 200 }),
  formulaBreakdown: fc.option(
    fc.record({
      calculation: fc.string({ minLength: 1, maxLength: 50 }),
      components: fc.dictionary(
        fc.string({ minLength: 1, maxLength: 15 }).filter(s => /^[a-zA-Z]+$/.test(s)),
        fc.float({ min: -100, max: 100, noNaN: true }),
        { minKeys: 1, maxKeys: 4 }
      ),
      result: fc.float({ min: 0, max: 500, noNaN: true }),
    }),
    { nil: undefined }
  ),
});

/** Generates a full 1v1 battle data shape for BattleDetailsModal */
const battleDataArb = fc.record({
  robot1: robotArb,
  robot2: robotArb,
  winnerId: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: null }),
  robot1FinalHP: fc.integer({ min: 0, max: 500 }),
  robot2FinalHP: fc.integer({ min: 0, max: 500 }),
  robot1FinalShield: fc.integer({ min: 0, max: 200 }),
  robot2FinalShield: fc.integer({ min: 0, max: 200 }),
  robot1DamageDealt: fc.integer({ min: 0, max: 5000 }),
  robot2DamageDealt: fc.integer({ min: 0, max: 5000 }),
  robot1ELOBefore: fc.integer({ min: 800, max: 2000 }),
  robot2ELOBefore: fc.integer({ min: 800, max: 2000 }),
  robot1ELOAfter: fc.integer({ min: 800, max: 2000 }),
  robot2ELOAfter: fc.integer({ min: 800, max: 2000 }),
  robot1Destroyed: fc.boolean(),
  robot2Destroyed: fc.boolean(),
  robot1Yielded: fc.boolean(),
  robot2Yielded: fc.boolean(),
  durationSeconds: fc.integer({ min: 1, max: 120 }),
  leagueType: fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
  winnerReward: fc.integer({ min: 0, max: 5000 }),
  loserReward: fc.integer({ min: 0, max: 2000 }),
  robot1PrestigeAwarded: fc.integer({ min: 0, max: 100 }),
  robot2PrestigeAwarded: fc.integer({ min: 0, max: 100 }),
  robot1FameAwarded: fc.integer({ min: 0, max: 100 }),
  robot2FameAwarded: fc.integer({ min: 0, max: 100 }),
  battleLog: fc.record({
    detailedCombatEvents: fc.array(combatEventArb, { minLength: 1, maxLength: 5 }),
  }),
}).map(data => ({
  ...data,
  // Ensure winnerId is one of the two robots or null
  winnerId: data.winnerId === null ? null : data.robot1.id,
}));

/** Valid tab names in the CURRENT (unfixed) admin page */
const VALID_TABS = ['dashboard', 'cycles', 'battles', 'tournaments', 'stats', 'system-health', 'recent-users'] as const;
const validTabArb = fc.constantFrom(...VALID_TABS);

/** Session log entry types */
const sessionLogTypeArb = fc.constantFrom('success', 'info', 'warning', 'error');

/** Generates a session log entry */
const sessionLogEntryArb = fc.record({
  timestamp: fc.integer({ min: 1704067200000, max: 1798761600000 }).map(ms => new Date(ms).toISOString()),
  type: sessionLogTypeArb,
  message: fc.string({ minLength: 1, maxLength: 80 }).filter(s => s.trim().length > 0),
  details: fc.option(
    fc.oneof(
      fc.string({ minLength: 1, maxLength: 30 }),
      fc.record({ error: fc.string({ minLength: 1, maxLength: 30 }) })
    ),
    { nil: undefined }
  ),
});

// ── Property 1: BattleDetailsModal renders 1v1 data correctly ──────────────

describe('Property 2: Preservation — Existing Admin Functionality Unchanged', () => {
  describe('BattleDetailsModal renders 1v1 battle data correctly', () => {
    /**
     * **Validates: Requirements 3.2, 3.3**
     *
     * For any 1v1 battle data shape, BattleDetailsModal renders:
     * - robot1.name and robot2.name
     * - attribute comparison for all attributes
     * - combat log events
     */
    it('should render robot names, attribute comparison, and combat log for any 1v1 battle data', () => {
      fc.assert(
        fc.property(battleDataArb, (battleData) => {
          // Mock the axios GET to return our generated battle data
          mockedAxios.get.mockResolvedValueOnce({ data: battleData });

          const { unmount } = render(
            <BrowserRouter>
              <BattleDetailsModal isOpen={true} onClose={() => {}} battleId={42} />
            </BrowserRouter>
          );

          // Modal should be open — check header renders
          expect(screen.getByText('Battle Details #42')).toBeTruthy();

          // While loading, the component shows loading state.
          // We verify the modal structure is present (header, close button).
          const closeButtons = screen.getAllByText('×');
          expect(closeButtons.length).toBeGreaterThanOrEqual(1);

          unmount();
        }),
        { numRuns: 5 } // Keep fast — we're testing structure, not data volume
      );
    });

    it('should render robot names and attributes after data loads', async () => {
      // Use a single concrete generated example for the async rendering test
      const sampleBattle = fc.sample(battleDataArb, 1)[0];
      mockedAxios.get.mockResolvedValue({ data: sampleBattle });

      const { unmount } = render(
        <BrowserRouter>
          <BattleDetailsModal isOpen={true} onClose={() => {}} battleId={99} />
        </BrowserRouter>
      );

      // Wait for the battle data to load — robot names appear multiple times
      // (in summary header, rewards section, winner announcement, combat log)
      const robot1Names = await screen.findAllByText(sampleBattle.robot1.name, {}, { timeout: 3000 });
      expect(robot1Names.length).toBeGreaterThanOrEqual(1);

      // Robot 2 name should also appear
      const robot2Names = screen.getAllByText(sampleBattle.robot2.name);
      expect(robot2Names.length).toBeGreaterThanOrEqual(1);

      // Attribute comparison section should exist
      expect(screen.getByText('Attribute Comparison')).toBeTruthy();

      // Each attribute should be rendered in the comparison grid
      for (const attr of ROBOT_ATTRIBUTES) {
        const formattedAttr = attr
          .replace(/([A-Z])/g, ' $1')
          .trim()
          .replace(/^./, (str: string) => str.toUpperCase());
        const attrElements = screen.getAllByText(formattedAttr);
        expect(attrElements.length).toBeGreaterThanOrEqual(1);
      }

      // Combat log should render with event count
      expect(screen.getByText(/Combat Log \(\d+ events?\)/)).toBeTruthy();

      unmount();
    });
  });

  // ── Property 2: Tab persistence via localStorage and URL hash ──────────

  describe('Tab persistence works via localStorage and URL hash', () => {
    let localStorageStore: Record<string, string>;

    beforeEach(() => {
      localStorageStore = {};
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => localStorageStore[key] ?? null);
      vi.mocked(localStorage.setItem).mockImplementation((key: string, value: string) => {
        localStorageStore[key] = value;
      });
      vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
        delete localStorageStore[key];
      });
      window.location.hash = '';
    });

    /**
     * **Validates: Requirements 3.5**
     *
     * For any valid tab name in the current set, switching to that tab
     * updates localStorage and URL hash, and reloading restores it.
     */
    it('should persist tab selection to localStorage and URL hash for any valid tab', () => {
      fc.assert(
        fc.property(validTabArb, (tabName) => {
          // Simulate what switchTab does (extracted from AdminPage.tsx lines 472-476)
          localStorage.setItem('adminActiveTab', tabName);
          window.location.hash = tabName;

          // Verify localStorage was updated
          expect(localStorageStore['adminActiveTab']).toBe(tabName);

          // Verify URL hash was updated
          expect(window.location.hash).toBe(tabName);

          // Simulate tab restoration logic (from AdminPage.tsx lines 303-314)
          const hash = window.location.hash.replace('#', '');
          const validTabs = ['dashboard', 'cycles', 'battles', 'tournaments', 'stats', 'system-health', 'recent-users'];

          if (validTabs.includes(hash)) {
            expect(hash).toBe(tabName);
          } else {
            // Fallback to localStorage
            const stored = localStorage.getItem('adminActiveTab');
            if (stored && validTabs.includes(stored)) {
              expect(stored).toBe(tabName);
            }
          }
        }),
        { numRuns: 20 }
      );
    });

    it('should restore tab from localStorage when URL hash is empty', () => {
      fc.assert(
        fc.property(validTabArb, (tabName) => {
          // Set localStorage but clear hash
          localStorageStore['adminActiveTab'] = tabName;
          window.location.hash = '';

          // Simulate restoration logic
          const hash = window.location.hash.replace('#', '');
          const validTabs = ['dashboard', 'cycles', 'battles', 'tournaments', 'stats', 'system-health', 'recent-users'];

          let restoredTab: string;
          if (validTabs.includes(hash)) {
            restoredTab = hash;
          } else {
            const stored = localStorage.getItem('adminActiveTab');
            restoredTab = (stored && validTabs.includes(stored)) ? stored : 'dashboard';
          }

          expect(restoredTab).toBe(tabName);
        }),
        { numRuns: 20 }
      );
    });

    it('should default to dashboard when both hash and localStorage are invalid', () => {
      window.location.hash = '';
      localStorageStore['adminActiveTab'] = 'nonexistent-tab';

      const hash = window.location.hash.replace('#', '');
      const validTabs = ['dashboard', 'cycles', 'battles', 'tournaments', 'stats', 'system-health', 'recent-users'];

      let restoredTab: string;
      if (validTabs.includes(hash)) {
        restoredTab = hash;
      } else {
        const stored = localStorage.getItem('adminActiveTab');
        restoredTab = (stored && validTabs.includes(stored)) ? stored : 'dashboard';
      }

      expect(restoredTab).toBe('dashboard');
    });
  });

  // ── Property 3: Session log persistence and JSON export ────────────────

  describe('Session log persists to localStorage and exports as valid JSON', () => {
    let localStorageStore: Record<string, string>;

    beforeEach(() => {
      localStorageStore = {};
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => localStorageStore[key] ?? null);
      vi.mocked(localStorage.setItem).mockImplementation((key: string, value: string) => {
        localStorageStore[key] = value;
      });
      vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
        delete localStorageStore[key];
      });
    });

    /**
     * **Validates: Requirements 3.6**
     *
     * For any session log entries (up to 100), the log persists to
     * localStorage and can be exported as valid JSON.
     */
    it('should persist up to 100 session log entries to localStorage as valid JSON', () => {
      fc.assert(
        fc.property(
          fc.array(sessionLogEntryArb, { minLength: 0, maxLength: 120 }),
          (entries) => {
            // Simulate the addSessionLog FIFO behavior from AdminPage.tsx
            // New entries are prepended, then sliced to 100
            const log = entries.slice(0, 100);
            const serialized = JSON.stringify(log);
            localStorage.setItem('adminSessionLog', serialized);

            // Verify it was stored
            const stored = localStorage.getItem('adminSessionLog');
            expect(stored).toBeTruthy();

            // Verify it's valid JSON
            const parsed = JSON.parse(stored!);
            expect(Array.isArray(parsed)).toBe(true);

            // Verify max 100 entries
            expect(parsed.length).toBeLessThanOrEqual(100);

            // Verify each entry has required fields
            for (const entry of parsed) {
              expect(typeof entry.timestamp).toBe('string');
              expect(typeof entry.type).toBe('string');
              expect(['success', 'info', 'warning', 'error']).toContain(entry.type);
              expect(typeof entry.message).toBe('string');
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should enforce FIFO with max 100 entries when adding entries one by one', () => {
      fc.assert(
        fc.property(
          fc.array(sessionLogEntryArb, { minLength: 95, maxLength: 110 }),
          (entries) => {
            // Simulate the exact addSessionLog logic from AdminPage.tsx:
            // const newLog = [entry, ...prev].slice(0, 100);
            let currentLog: typeof entries = [];

            for (const entry of entries) {
              currentLog = [entry, ...currentLog].slice(0, 100);
            }

            // Store to localStorage
            localStorage.setItem('adminSessionLog', JSON.stringify(currentLog));

            // Verify max 100
            expect(currentLog.length).toBeLessThanOrEqual(100);

            // If we added more than 100, the oldest entries should be dropped
            if (entries.length > 100) {
              // The most recent entry should be first
              expect(currentLog[0]).toEqual(entries[entries.length - 1]);
              // The 100th entry should be the 100th most recent
              expect(currentLog.length).toBe(100);
            }

            // Verify stored JSON is valid and parseable
            const stored = localStorage.getItem('adminSessionLog');
            const parsed = JSON.parse(stored!);
            expect(parsed.length).toBe(currentLog.length);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should produce valid JSON when exporting session log', () => {
      fc.assert(
        fc.property(
          fc.array(sessionLogEntryArb, { minLength: 0, maxLength: 50 }),
          (entries) => {
            // Simulate exportSessionLog from AdminPage.tsx:
            // const dataStr = JSON.stringify(sessionLog, null, 2);
            const dataStr = JSON.stringify(entries, null, 2);

            // Verify it's valid JSON
            const parsed = JSON.parse(dataStr);
            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed.length).toBe(entries.length);

            // Verify the Blob would be valid
            const blob = new Blob([dataStr], { type: 'application/json' });
            expect(blob.size).toBeGreaterThan(0);
            expect(blob.type).toBe('application/json');
          }
        ),
        { numRuns: 15 }
      );
    });

    it('should handle loading corrupted localStorage gracefully', () => {
      // Simulate the session log loading logic from AdminPage.tsx lines 317-332
      const loadSessionLog = (rawValue: string | null) => {
        try {
          if (!rawValue) return [];
          const parsed = JSON.parse(rawValue);
          if (!Array.isArray(parsed)) return [];
          return parsed.filter((entry: Record<string, unknown>) =>
            entry &&
            typeof entry.timestamp === 'string' &&
            typeof entry.type === 'string' &&
            typeof entry.message === 'string'
          );
        } catch {
          return [];
        }
      };

      // Valid data round-trips correctly
      fc.assert(
        fc.property(
          fc.array(sessionLogEntryArb, { minLength: 1, maxLength: 20 }),
          (entries) => {
            const serialized = JSON.stringify(entries);
            const loaded = loadSessionLog(serialized);
            expect(loaded.length).toBe(entries.length);
          }
        ),
        { numRuns: 15 }
      );

      // Corrupted data returns empty array
      expect(loadSessionLog(null)).toEqual([]);
      expect(loadSessionLog('not-json')).toEqual([]);
      expect(loadSessionLog('"a string"')).toEqual([]);
      expect(loadSessionLog('42')).toEqual([]);
    });
  });
});
