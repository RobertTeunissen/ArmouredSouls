/**
 * Unit tests for the changelog auto-generator script.
 *
 * Tests spec scanning, commit aggregation, category heuristics,
 * idempotency, and skip behavior.
 *
 * Requirements: 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.10
 */

import {
  categorizeSpec,
  parseCommits,
  generateDrafts,
  DraftEntry,
} from '../generate-changelog-drafts';

describe('generate-changelog-drafts', () => {
  // -----------------------------------------------------------------------
  // categorizeSpec
  // -----------------------------------------------------------------------
  describe('categorizeSpec', () => {
    it('should return bugfix when name contains "fix"', () => {
      expect(categorizeSpec('15-hotfix-combat-damage')).toBe('bugfix');
    });

    it('should return bugfix when name contains "bug"', () => {
      expect(categorizeSpec('12-bug-negative-credits')).toBe('bugfix');
    });

    it('should return balance when name contains "balance"', () => {
      expect(categorizeSpec('8-weapon-balance-pass')).toBe('balance');
    });

    it('should return feature for generic spec names', () => {
      expect(categorizeSpec('24-in-game-changelog')).toBe('feature');
    });

    it('should be case-insensitive', () => {
      expect(categorizeSpec('10-BugFix-Something')).toBe('bugfix');
      expect(categorizeSpec('11-BALANCE-update')).toBe('balance');
    });

    it('should prioritize fix/bug over balance when both present', () => {
      expect(categorizeSpec('13-fix-balance-issue')).toBe('bugfix');
    });
  });

  // -----------------------------------------------------------------------
  // parseCommits
  // -----------------------------------------------------------------------
  describe('parseCommits', () => {
    it('should parse git log output into commit objects', () => {
      const output = 'abc1234 Fix combat damage\ndef5678 Add new weapon';
      const commits = parseCommits(output);
      expect(commits).toEqual([
        { sha: 'abc1234', message: 'Fix combat damage' },
        { sha: 'def5678', message: 'Add new weapon' },
      ]);
    });

    it('should return empty array for empty input', () => {
      expect(parseCommits('')).toEqual([]);
      expect(parseCommits('   ')).toEqual([]);
    });

    it('should handle single commit', () => {
      const commits = parseCommits('abc1234 Single commit');
      expect(commits).toHaveLength(1);
      expect(commits[0]).toEqual({ sha: 'abc1234', message: 'Single commit' });
    });

    it('should handle commit with no message', () => {
      const commits = parseCommits('abc1234');
      expect(commits).toEqual([{ sha: 'abc1234', message: '' }]);
    });

    it('should handle messages with multiple spaces', () => {
      const commits = parseCommits('abc1234 Fix  multiple  spaces');
      expect(commits[0].message).toBe('Fix  multiple  spaces');
    });
  });

  // -----------------------------------------------------------------------
  // generateDrafts
  // -----------------------------------------------------------------------
  describe('generateDrafts', () => {
    const mockReadIntro = (specDir: string): string => {
      if (specDir.includes('changelog')) {
        return 'Adds an in-game changelog for players.';
      }
      if (specDir.includes('fix')) {
        return 'Fixes a critical combat bug.';
      }
      return 'Generic spec description.';
    };

    it('should create one draft per completed spec', () => {
      const specDirs = [
        '.kiro/specs/done-april26/24-in-game-changelog',
        '.kiro/specs/done-april26/25-weapon-balance',
      ];
      const drafts = generateDrafts(specDirs, [], new Set(), mockReadIntro);

      expect(drafts).toHaveLength(2);
      expect(drafts[0].sourceType).toBe('spec');
      expect(drafts[0].sourceRef).toBe('24-in-game-changelog');
      expect(drafts[0].category).toBe('feature');
      expect(drafts[1].sourceRef).toBe('25-weapon-balance');
      expect(drafts[1].category).toBe('balance');
    });

    it('should create aggregated commit entry for non-spec commits', () => {
      const commits = [
        { sha: 'abc1234567', message: 'Fix typo in readme' },
        { sha: 'def5678901', message: 'Update dependencies' },
      ];
      const drafts = generateDrafts([], commits, new Set(), mockReadIntro);

      expect(drafts).toHaveLength(1);
      expect(drafts[0].sourceType).toBe('commit');
      expect(drafts[0].category).toBe('bugfix');
      expect(drafts[0].title).toMatch(/^Deploy \d{4}-\d{2}-\d{2}$/);
      expect(drafts[0].body).toContain('Fix typo in readme');
      expect(drafts[0].body).toContain('Update dependencies');
    });

    it('should set correct sourceRef for commit entries', () => {
      const commits = [
        { sha: 'abc1234567', message: 'First' },
        { sha: 'def5678901', message: 'Last' },
      ];
      const drafts = generateDrafts([], commits, new Set(), mockReadIntro);

      expect(drafts[0].sourceRef).toBe('abc1234..def5678');
    });

    it('should use spec introduction as body', () => {
      const specDirs = ['.kiro/specs/done-april26/24-in-game-changelog'];
      const drafts = generateDrafts(specDirs, [], new Set(), mockReadIntro);

      expect(drafts[0].body).toBe('Adds an in-game changelog for players.');
    });

    it('should format spec title from directory name', () => {
      const specDirs = ['.kiro/specs/done-april26/24-in-game-changelog'];
      const drafts = generateDrafts(specDirs, [], new Set(), mockReadIntro);

      expect(drafts[0].title).toBe('In Game Changelog');
    });

    it('should assign bugfix category for fix specs', () => {
      const specDirs = ['.kiro/specs/done-april26/15-hotfix-combat'];
      const drafts = generateDrafts(specDirs, [], new Set(), mockReadIntro);

      expect(drafts[0].category).toBe('bugfix');
    });

    it('should skip specs with existing sourceRef (idempotency)', () => {
      const specDirs = [
        '.kiro/specs/done-april26/24-in-game-changelog',
        '.kiro/specs/done-april26/25-weapon-balance',
      ];
      const existing = new Set(['24-in-game-changelog']);
      const drafts = generateDrafts(specDirs, [], existing, mockReadIntro);

      expect(drafts).toHaveLength(1);
      expect(drafts[0].sourceRef).toBe('25-weapon-balance');
    });

    it('should skip commit entry with existing sourceRef (idempotency)', () => {
      const commits = [
        { sha: 'abc1234567', message: 'Fix typo' },
        { sha: 'def5678901', message: 'Update deps' },
      ];
      const existing = new Set(['abc1234..def5678']);
      const drafts = generateDrafts([], commits, existing, mockReadIntro);

      expect(drafts).toHaveLength(0);
    });

    it('should return empty array when no specs or commits', () => {
      const drafts = generateDrafts([], [], new Set(), mockReadIntro);
      expect(drafts).toHaveLength(0);
    });

    it('should set all drafts to status draft', () => {
      const specDirs = ['.kiro/specs/done-april26/24-in-game-changelog'];
      const commits = [{ sha: 'abc1234567', message: 'Fix typo' }];
      const drafts = generateDrafts(specDirs, commits, new Set(), mockReadIntro);

      for (const draft of drafts) {
        expect(draft.status).toBe('draft');
      }
    });

    it('should use fallback body when readIntro returns empty', () => {
      const specDirs = ['.kiro/specs/done-april26/99-unknown-spec'];
      const emptyReader = (): string => '';
      const drafts = generateDrafts(specDirs, [], new Set(), emptyReader);

      expect(drafts[0].body).toBe('Changes from spec: 99-unknown-spec');
    });

    it('should filter out [spec] tagged commits from aggregated entry', () => {
      const commits = [
        { sha: 'abc1234567', message: '[spec] Add changelog feature' },
        { sha: 'def5678901', message: 'Fix typo in readme' },
      ];
      const drafts = generateDrafts([], commits, new Set(), mockReadIntro);

      expect(drafts).toHaveLength(1);
      expect(drafts[0].body).not.toContain('[spec]');
      expect(drafts[0].body).toContain('Fix typo in readme');
    });
  });
});
