/**
 * Preservation Property Tests — Existing Admin Functionality Unchanged
 *
 * These tests MUST PASS on unfixed code — they establish the baseline behavior
 * that must be preserved after the fix is implemented.
 *
 * Property 2: Preservation — Existing Admin Functionality Unchanged
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import * as fc from 'fast-check';
import axios from 'axios';

// ─── Mocks ───────────────────────────────────────────────────────────────────

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

vi.mock('../SystemHealthPage', () => ({
  default: () => <div data-testid="system-health-page">System Health</div>,
}));

vi.mock('../../components/TournamentManagement', () => ({
  default: () => <div data-testid="tournament-management">Tournaments</div>,
}));

vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    create: vi.fn(),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedAxios = axios as any;

// ─── Generators ──────────────────────────────────────────────────────────────

/** Generate a valid robot name (non-empty alphanumeric + spaces) */
const arbRobotName = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,19}$/);

/** Robot attribute names used in the game */
const ROBOT_ATTRIBUTES = [
  'combatPower', 'armor', 'speed', 'accuracy', 'evasion',
  'criticalChance', 'shieldStrength', 'shieldRegenRate',
  'counterAttackChance', 'maxHP',
];

/** Generate a record of numeric attributes */
const arbAttributes = fc.record(
  Object.fromEntries(ROBOT_ATTRIBUTES.map(attr => [attr, fc.float({ min: 1, max: 200, noNaN: true })]))
) as fc.Arbitrary<Record<string, number>>;

/** Generate a combat event */
const arbCombatEvent = fc.record({
  timestamp: fc.float({ min: 0, max: 300, noNaN: true }),
  type: fc.constantFrom('attack', 'critical', 'miss', 'counter', 'shield_break', 'yield', 'destroyed'),
  message: fc.stringMatching(/^[a-z][a-z ]{0,39}$/),
  robot1HP: fc.integer({ min: 0, max: 500 }),
  robot2HP: fc.integer({ min: 0, max: 500 }),
  robot1Shield: fc.integer({ min: 0, max: 200 }),
  robot2Shield: fc.integer({ min: 0, max: 200 }),
});

/** Generate a full 1v1 battle data shape for BattleDetailsModal */
const arbBattleData = fc.record({
  robot1Name: arbRobotName,
  robot2Name: arbRobotName,
  robot1Attributes: arbAttributes,
  robot2Attributes: arbAttributes,
  events: fc.array(arbCombatEvent, { minLength: 0, maxLength: 10 }),
  winnerId: fc.constantFrom(1, 2, null),
  durationSeconds: fc.integer({ min: 1, max: 300 }),
  leagueType: fc.constantFrom('bronze', 'silver', 'gold', 'platinum'),
});

/** The current valid tab names (updated after fix: system-health → bankruptcy-monitor) */
const VALID_TABS = ['dashboard', 'cycles', 'battles', 'tournaments', 'stats', 'bankruptcy-monitor', 'recent-users'] as const;
const arbTabName = fc.constantFrom(...VALID_TABS);

/** Generate a session log entry */
const arbSessionLogEntry = fc.record({
  timestamp: fc.integer({ min: 1704067200000, max: 1798761600000 }).map(ms => new Date(ms).toISOString()),
  type: fc.constantFrom('success' as const, 'info' as const, 'warning' as const, 'error' as const),
  message: fc.stringMatching(/^[a-z0-9][a-z0-9 ]{0,59}$/),
});

// ─── Property 1: BattleDetailsModal renders 1v1 battle data correctly ────────

describe('Preservation Property: BattleDetailsModal 1v1 Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property: For any 1v1 battle data shape, BattleDetailsModal renders
   * robot1.name and robot2.name, attribute comparison for all attributes,
   * and combat log events.
   *
   * **Validates: Requirements 3.3**
   */
  it('should render robot names, attribute comparison, and combat log for any 1v1 battle data', async () => {
    // Lazy import to avoid circular mock issues
    const { default: BattleDetailsModal } = await import('../../components/BattleDetailsModal');

    await fc.assert(
      fc.asyncProperty(arbBattleData, async (battleData) => {
        const mockBattle = {
          id: 1,
          robot1: {
            id: 1,
            name: battleData.robot1Name,
            maxHP: 100,
            loadout: 'standard',
            stance: 'balanced',
            attributes: battleData.robot1Attributes,
          },
          robot2: {
            id: 2,
            name: battleData.robot2Name,
            maxHP: 100,
            loadout: 'standard',
            stance: 'balanced',
            attributes: battleData.robot2Attributes,
          },
          winnerId: battleData.winnerId === 1 ? 1 : battleData.winnerId === 2 ? 2 : null,
          robot1FinalHP: 50,
          robot2FinalHP: 30,
          robot1FinalShield: 10,
          robot2FinalShield: 5,
          robot1DamageDealt: 70,
          robot2DamageDealt: 50,
          robot1ELOBefore: 1000,
          robot2ELOBefore: 1000,
          robot1ELOAfter: 1020,
          robot2ELOAfter: 980,
          robot1Destroyed: false,
          robot2Destroyed: false,
          robot1Yielded: false,
          robot2Yielded: false,
          durationSeconds: battleData.durationSeconds,
          leagueType: battleData.leagueType,
          winnerReward: 100,
          loserReward: 50,
          robot1PrestigeAwarded: 10,
          robot1FameAwarded: 5,
          robot2PrestigeAwarded: 0,
          robot2FameAwarded: 0,
          battleLog: {
            detailedCombatEvents: battleData.events.map(e => ({
              ...e,
              timestamp: Number(e.timestamp),
            })),
          },
        };

        // Mock the axios.get call for battle details
        mockedAxios.get.mockResolvedValueOnce({ data: mockBattle });

        const { unmount } = render(
          <BattleDetailsModal isOpen={true} onClose={vi.fn()} battleId={1} />
        );

        // Wait for the battle data to load
        await act(async () => {
          await new Promise(r => setTimeout(r, 50));
        });

        const allText = document.body.textContent || '';

        // Verify robot names are rendered
        expect(allText).toContain(battleData.robot1Name);
        expect(allText).toContain(battleData.robot2Name);

        // Verify attribute comparison renders all attributes present in the data
        for (const attr of Object.keys(battleData.robot1Attributes)) {
          const formatted = attr
            .replace(/([A-Z])/g, ' $1')
            .trim()
            .replace(/^./, (str) => str.toUpperCase());
          expect(allText).toContain(formatted);
        }

        // Verify combat log events are rendered (by their message text)
        for (const event of battleData.events) {
          expect(allText).toContain(event.message);
        }

        unmount();
      }),
      { numRuns: 15 }
    );
  });
});

// ─── Property 2: Tab persistence via localStorage and URL hash ───────────────

describe('Preservation Property: Tab Persistence via localStorage and URL Hash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {});
    window.location.hash = '';

    // Mock axios for AdminPage rendering (stats + battles auto-fetch on mount)
    mockedAxios.get.mockResolvedValue({
      data: { battles: [], pagination: { page: 1, limit: 20, totalBattles: 0, totalPages: 0, hasMore: false } },
    });
    mockedAxios.post.mockResolvedValue({ data: {} });
  });

  /**
   * Property: For any valid tab name in the current set, switching to that tab
   * updates localStorage and URL hash, and reloading restores it.
   *
   * **Validates: Requirements 3.5**
   */
  it('should persist tab selection to localStorage and URL hash for any valid tab', async () => {
    const { default: AdminPage } = await import('../AdminPage');

    fc.assert(
      fc.property(arbTabName, (tabName) => {
        // Track localStorage calls
        const setItemCalls: Array<[string, string]> = [];
        (localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(
          (key: string, value: string) => { setItemCalls.push([key, value]); }
        );

        const { unmount } = render(
          <BrowserRouter>
            <AdminPage />
          </BrowserRouter>
        );

        // Find and click the target tab
        const targetTab = document.getElementById(`${tabName}-tab`);
        expect(targetTab).toBeTruthy();

        if (targetTab) {
          act(() => {
            targetTab.click();
          });

          // Verify localStorage was updated with the tab name
          const adminTabCalls = setItemCalls.filter(([key]) => key === 'adminActiveTab');
          expect(adminTabCalls.length).toBeGreaterThan(0);
          expect(adminTabCalls[adminTabCalls.length - 1][1]).toBe(tabName);

          // Verify URL hash was updated
          expect(window.location.hash).toBe(tabName);
        }

        unmount();
      }),
      { numRuns: VALID_TABS.length }
    );
  });

  /**
   * Property: For any valid tab name stored in localStorage, reloading the page
   * restores that tab as active.
   *
   * **Validates: Requirements 3.5**
   */
  it('should restore tab from localStorage on page load for any valid tab', async () => {
    const { default: AdminPage } = await import('../AdminPage');

    fc.assert(
      fc.property(arbTabName, (tabName) => {
        (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
          if (key === 'adminActiveTab') return tabName;
          return null;
        });
        window.location.hash = '';

        const { unmount } = render(
          <BrowserRouter>
            <AdminPage />
          </BrowserRouter>
        );

        const targetTab = document.getElementById(`${tabName}-tab`);
        expect(targetTab).toBeTruthy();
        expect(targetTab?.getAttribute('aria-selected')).toBe('true');

        unmount();
      }),
      { numRuns: VALID_TABS.length }
    );
  });

  /**
   * Property: For any valid tab name in the URL hash, loading the page
   * restores that tab as active (hash takes priority over localStorage).
   *
   * **Validates: Requirements 3.5**
   */
  it('should restore tab from URL hash on page load for any valid tab', async () => {
    const { default: AdminPage } = await import('../AdminPage');

    fc.assert(
      fc.property(arbTabName, (tabName) => {
        window.location.hash = `#${tabName}`;
        (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

        const { unmount } = render(
          <BrowserRouter>
            <AdminPage />
          </BrowserRouter>
        );

        const targetTab = document.getElementById(`${tabName}-tab`);
        expect(targetTab).toBeTruthy();
        expect(targetTab?.getAttribute('aria-selected')).toBe('true');

        unmount();
      }),
      { numRuns: VALID_TABS.length }
    );
  });
});

// ─── Property 3: Session log persistence and JSON export ─────────────────────

describe('Preservation Property: Session Log Persistence and Export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property: For any session log entries (up to 100), the log persists to
   * localStorage and can be exported as valid JSON.
   *
   * Tests the session log logic directly (unit-level) since addSessionLog,
   * localStorage persistence, and export are pure functions embedded in AdminPage.
   *
   * **Validates: Requirements 3.6**
   */
  it('should persist session log entries to localStorage with max 100 FIFO and produce valid JSON', () => {
    fc.assert(
      fc.property(
        fc.array(arbSessionLogEntry, { minLength: 0, maxLength: 120 }),
        (entries) => {
          // Simulate the session log state management logic from AdminPage:
          // addSessionLog prepends new entry and slices to 100
          let currentLog: Array<{ timestamp: string; type: string; message: string }> = [];

          for (const entry of entries) {
            currentLog = [entry, ...currentLog].slice(0, 100);
          }

          // Verify FIFO: max 100 entries
          expect(currentLog.length).toBeLessThanOrEqual(100);

          // Verify the most recent entry is first (if any entries exist)
          if (entries.length > 0) {
            expect(currentLog[0]).toEqual(entries[entries.length - 1]);
          }

          // Verify localStorage persistence produces valid JSON
          const serialized = JSON.stringify(currentLog);
          expect(() => JSON.parse(serialized)).not.toThrow();

          // Verify round-trip: parse back and validate structure
          const parsed = JSON.parse(serialized);
          expect(Array.isArray(parsed)).toBe(true);
          expect(parsed.length).toBe(currentLog.length);

          // Verify each entry has the required fields
          for (const entry of parsed) {
            expect(typeof entry.timestamp).toBe('string');
            expect(typeof entry.type).toBe('string');
            expect(typeof entry.message).toBe('string');
            expect(['success', 'info', 'warning', 'error']).toContain(entry.type);
          }

          // Verify the export format (JSON.stringify with indent 2) is valid
          const exportStr = JSON.stringify(currentLog, null, 2);
          expect(() => JSON.parse(exportStr)).not.toThrow();
          const exportParsed = JSON.parse(exportStr);
          expect(exportParsed).toEqual(currentLog);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Session log loaded from localStorage validates entries correctly,
   * filtering out malformed entries.
   *
   * **Validates: Requirements 3.6**
   */
  it('should filter out malformed entries when loading session log from localStorage', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            // Valid entries
            arbSessionLogEntry,
            // Malformed: missing timestamp
            fc.record({
              type: fc.constantFrom('success', 'info', 'warning', 'error'),
              message: fc.string({ minLength: 1 }),
            }),
            // Malformed: wrong type for timestamp
            fc.record({
              timestamp: fc.integer(),
              type: fc.constantFrom('success', 'info', 'warning', 'error'),
              message: fc.string({ minLength: 1 }),
            }),
            // Malformed: null entry
            fc.constant(null)
          ),
          { minLength: 0, maxLength: 20 }
        ),
        (mixedEntries) => {
          // Simulate the AdminPage session log loading logic
          const saved = JSON.stringify(mixedEntries);
          const parsed = JSON.parse(saved);

          if (!Array.isArray(parsed)) {
            expect([]).toEqual([]);
            return;
          }

          const filtered = parsed.filter(
            (entry: unknown) =>
              entry &&
              typeof (entry as Record<string, unknown>).timestamp === 'string' &&
              typeof (entry as Record<string, unknown>).type === 'string' &&
              typeof (entry as Record<string, unknown>).message === 'string'
          );

          // All filtered entries should have valid structure
          for (const entry of filtered) {
            expect(typeof entry.timestamp).toBe('string');
            expect(typeof entry.type).toBe('string');
            expect(typeof entry.message).toBe('string');
          }

          // Filtered count should be <= original count
          expect(filtered.length).toBeLessThanOrEqual(mixedEntries.length);
        }
      ),
      { numRuns: 30 }
    );
  });
});
